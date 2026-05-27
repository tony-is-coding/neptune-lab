/**
 * ControlledEngine 关账受控检查场景单元测试
 *
 * 验证 SSE 流契约（不涉及 DB / 路由）：
 *   - 触发条件：prompt 以 `[closing-check]` 开头
 *   - 每个 checklist code 产生一对 tool_use(LedgerCheck) + tool_result
 *   - tool_result.output 形如 {code, status, findings: []}
 *   - general-ledger-basic 数据集下 unposted_vouchers 必须 failed + 1 个 blocking finding
 *
 * 这层契约稳定后，上层 closing-workbench 才能解析 SSE 流写真实 Finding。
 */

import {describe, expect, test} from 'bun:test';
import {
    ControlledEngineFactory,
    parseClosingCheckPrompt,
    closingCheckResultFor,
    buildClosingCheckPrompt,
} from '../src/services/controlled-engine-factory.js';

interface ToolUseEvent {
    type: 'tool_use';
    id: string;
    name: string;
    input: {code: string; dataset: string};
}

interface ToolResultEvent {
    type: 'tool_result';
    toolUseId: string;
    output: {
        code: string;
        status: 'passed' | 'failed';
        findings: Array<{title: string; severity: string; impactedCount: number; amountCents?: number}>;
    };
}

async function collectEvents(prompt: string): Promise<unknown[]> {
    const factory = new ControlledEngineFactory();
    const {engine, sdkSessionId} = await factory.createAndLoad({
        tenantId: 'tenant-test',
        workspace: '/tmp/closing-test',
    });
    const events: unknown[] = [];
    for await (const event of engine.query(sdkSessionId, prompt)) {
        events.push(event);
    }
    return events;
}

describe('ControlledEngine closing-check scenario', () => {
    test('parseClosingCheckPrompt 正确解析 dataset 与 codes', () => {
        const result = parseClosingCheckPrompt(
            '[closing-check] dataset=general-ledger-basic codes=unposted_vouchers,period_status',
        );
        expect(result.dataset).toBe('general-ledger-basic');
        expect(result.codes).toEqual(['unposted_vouchers', 'period_status']);
    });

    test('parseClosingCheckPrompt 容忍缺失键', () => {
        const result = parseClosingCheckPrompt('[closing-check]');
        expect(result.dataset).toBe('');
        expect(result.codes).toEqual([]);
    });

    test('buildClosingCheckPrompt 与 parseClosingCheckPrompt 互逆', () => {
        const built = buildClosingCheckPrompt({
            dataset: 'general-ledger-basic',
            codes: ['unposted_vouchers', 'period_status'],
        });
        const parsed = parseClosingCheckPrompt(built);
        expect(parsed.dataset).toBe('general-ledger-basic');
        expect(parsed.codes).toEqual(['unposted_vouchers', 'period_status']);
    });

    test('closingCheckResultFor general-ledger-basic + unposted_vouchers 返回 failed + 1 个 blocking finding', () => {
        const result = closingCheckResultFor('general-ledger-basic', 'unposted_vouchers');
        expect(result.status).toBe('failed');
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]).toMatchObject({
            severity: 'blocking',
            impactedCount: 3,
            amountCents: 1280000,
        });
        expect(result.sourceUri).toContain('mock://erp/general-ledger-basic/unposted_vouchers');
    });

    test('closingCheckResultFor 未知 code 默认 passed 无 finding', () => {
        const result = closingCheckResultFor('general-ledger-basic', 'voucher_sequence');
        expect(result.status).toBe('passed');
        expect(result.findings).toHaveLength(0);
    });

    test('closingCheckResultFor 未知 dataset 默认 passed 无 finding', () => {
        const result = closingCheckResultFor('unknown-dataset', 'unposted_vouchers');
        expect(result.status).toBe('passed');
        expect(result.findings).toHaveLength(0);
    });

    test('SSE 流：每个 code 输出 tool_use + tool_result 配对', async () => {
        const prompt = buildClosingCheckPrompt({
            dataset: 'general-ledger-basic',
            codes: ['unposted_vouchers', 'period_status', 'voucher_sequence'],
        });
        const events = await collectEvents(prompt);

        const toolUses = events.filter((e: any): e is ToolUseEvent => e?.type === 'tool_use');
        const toolResults = events.filter((e: any): e is ToolResultEvent => e?.type === 'tool_result');

        expect(toolUses).toHaveLength(3);
        expect(toolResults).toHaveLength(3);

        // 顺序与 codes 保持一致
        expect(toolUses.map(e => e.input.code)).toEqual(['unposted_vouchers', 'period_status', 'voucher_sequence']);
        // 每个 tool_use 都用 LedgerCheck 工具
        toolUses.forEach(use => {
            expect(use.name).toBe('LedgerCheck');
            expect(use.input.dataset).toBe('general-ledger-basic');
        });
        // 每个 tool_result 都关联到对应的 tool_use（通过 toolUseId 配对验证 SSE 不丢事件）
        toolResults.forEach((result, idx) => {
            expect(result.toolUseId).toBe(toolUses[idx].id);
        });
    });

    test('SSE 流：unposted_vouchers tool_result 含 1 个 blocking finding', async () => {
        const prompt = buildClosingCheckPrompt({
            dataset: 'general-ledger-basic',
            codes: ['unposted_vouchers'],
        });
        const events = await collectEvents(prompt);
        const toolResults = events.filter((e: any): e is ToolResultEvent => e?.type === 'tool_result');

        expect(toolResults).toHaveLength(1);
        const output = toolResults[0].output;
        expect(output.code).toBe('unposted_vouchers');
        expect(output.status).toBe('failed');
        expect(output.findings).toHaveLength(1);
        expect(output.findings[0].severity).toBe('blocking');
    });

    test('SSE 流：以 system init 开头、以 result success 结尾', async () => {
        const prompt = buildClosingCheckPrompt({
            dataset: 'general-ledger-basic',
            codes: ['period_status'],
        });
        const events = await collectEvents(prompt);

        expect((events[0] as any).type).toBe('system');
        expect((events[0] as any).subtype).toBe('init');

        const last = events[events.length - 1] as any;
        expect(last.type).toBe('result');
        expect(last.subtype).toBe('success');
        expect(last.is_error).toBe(false);
    });

    test('SSE 流：包含 query:complete 事件触发 token usage 上报', async () => {
        // 通过事件订阅检测：emit 在 yield assistant 之后、yield result 之前
        const factory = new ControlledEngineFactory();
        const {engine, sdkSessionId} = await factory.createAndLoad({
            tenantId: 'tenant-test',
            workspace: '/tmp/closing-test',
        });
        let usageCaptured: any = null;
        engine.on('query:complete', (payload: any) => {
            usageCaptured = payload;
        });
        const prompt = buildClosingCheckPrompt({
            dataset: 'general-ledger-basic',
            codes: ['unposted_vouchers', 'period_status'],
        });
        for await (const _ of engine.query(sdkSessionId, prompt)) {
            // drain
        }
        expect(usageCaptured).not.toBeNull();
        expect(usageCaptured.modelUsage['neptune-controlled-model']).toMatchObject({
            inputTokens: expect.any(Number),
            outputTokens: expect.any(Number),
        });
    });

    test('非 closing-check prompt 走默认场景（不进入 closing 分支）', async () => {
        const events = await collectEvents('hello world');
        const toolUses = events.filter((e: any): e is ToolUseEvent => e?.type === 'tool_use');
        // 默认场景使用 E2EControlledTool，不是 LedgerCheck
        const ledgerCheckCalls = toolUses.filter(use => use.name === 'LedgerCheck');
        expect(ledgerCheckCalls).toHaveLength(0);
    });
});
