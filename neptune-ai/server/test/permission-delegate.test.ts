import {describe, expect, test} from 'bun:test'
import {TenantPermissionDelegate} from '../src/services/permission-delegate.js'
import type {
    PolicyDecisionDenyInput,
    PolicyDecisionRecorder,
} from '../src/services/policy-decision.js'
import type {PolicyDecision} from '../src/db'

describe('TenantPermissionDelegate', () => {
    const workspace = '/tmp/neptune/tenants/t1/agents/a1/threads/th1'

    /**
     * 测试用 recorder：捕获每次写入的 deny / review_required 决策，
     * 让我们能在测试里直接断言"哪种 policyType 在哪个 subjectId 上被拒了"。
     */
    class CapturingRecorder implements PolicyDecisionRecorder {
        public denies: PolicyDecisionDenyInput[] = []
        public reviews: PolicyDecisionDenyInput[] = []

        async recordDeny(input: PolicyDecisionDenyInput): Promise<PolicyDecision> {
            this.denies.push(input)
            return {} as PolicyDecision
        }

        async recordReviewRequired(input: PolicyDecisionDenyInput): Promise<PolicyDecision> {
            this.reviews.push(input)
            return {} as PolicyDecision
        }
    }

    function createDelegate(
        tools: string[] = ['Read', 'Write'],
        recorder?: PolicyDecisionRecorder,
        runId: string = 'run-test-uuid',
    ) {
        return new TenantPermissionDelegate(
            {
                tenantId: 'tenant-1',
                workspace,
                mcpServers: ['docs'],
            },
            {tools},
            recorder ? {runId, requestId: 'req-test-uuid', recorder} : {},
        )
    }

    test('allows whitelisted file tool inside workspace', async () => {
        const delegate = createDelegate(['Read'])

        await expect(delegate.onToolAccess('Read', {
            file_path: `${workspace}/notes.md`,
        })).resolves.toBe('allow')
    })

    test('denies tool outside whitelist', async () => {
        const delegate = createDelegate(['Read'])

        await expect(delegate.onToolAccess('Write', {
            file_path: `${workspace}/notes.md`,
        })).resolves.toBe('deny')
    })

    test('denies relative path escape from workspace', async () => {
        const delegate = createDelegate(['Read'])

        await expect(delegate.onToolAccess('Read', {
            file_path: `${workspace}/../secret.md`,
        })).resolves.toBe('deny')
    })

    test('denies sibling-prefix workspace path', async () => {
        const delegate = createDelegate(['Read'])

        await expect(delegate.onToolAccess('Read', {
            file_path: `${workspace}2/secret.md`,
        })).resolves.toBe('deny')
    })

    test('denies unregistered MCP server', async () => {
        const delegate = createDelegate([])

        await expect(delegate.onToolAccess('mcp__private__search', {})).resolves.toBe('deny')
    })

    test('allows registered MCP server', async () => {
        const delegate = createDelegate([])

        await expect(delegate.onToolAccess('mcp__docs__search', {})).resolves.toBe('allow')
    })

    /**
     * Policy Decision recording — 关键治理事实，必须有
     */
    describe('PolicyDecision 写入', () => {
        test('全局禁用工具 deny 写入 PolicyDecision (policyType=tool)', async () => {
            const recorder = new CapturingRecorder()
            const delegate = createDelegate(['Bash', 'Read'], recorder)

            await expect(delegate.onToolAccess('Bash', {})).resolves.toBe('deny')

            // 写入是 fire-and-forget；让 microtask 执行
            await Promise.resolve()
            await Promise.resolve()

            expect(recorder.denies).toHaveLength(1)
            const deny = recorder.denies[0]
            expect(deny.policyType).toBe('tool')
            expect(deny.subjectType).toBe('tool')
            expect(deny.subjectId).toBe('Bash')
            expect(deny.tenantId).toBe('tenant-1')
            expect(deny.runId).toBe('run-test-uuid')
            expect(deny.requestId).toBe('req-test-uuid')
            expect(deny.reason).toContain('全局禁用')
            expect(deny.details?.rule).toBe('global_denied_tools')
        })

        test('MCP server 白名单 deny 写入 PolicyDecision (policyType=mcp_server)', async () => {
            const recorder = new CapturingRecorder()
            const delegate = createDelegate([], recorder)

            await expect(delegate.onToolAccess('mcp__private__search', {})).resolves.toBe('deny')

            await Promise.resolve()
            await Promise.resolve()

            expect(recorder.denies).toHaveLength(1)
            const deny = recorder.denies[0]
            expect(deny.policyType).toBe('mcp_server')
            expect(deny.subjectType).toBe('mcp_server')
            expect(deny.subjectId).toBe('private')
            expect(deny.reason).toContain('租户白名单')
            expect(deny.details?.rule).toBe('tenant_mcp_whitelist')
            expect(Array.isArray(deny.details?.allowedServers)).toBe(true)
        })

        test('Agent 模板工具白名单 deny 写入 PolicyDecision (policyType=tool)', async () => {
            const recorder = new CapturingRecorder()
            const delegate = createDelegate(['Read'], recorder)

            await expect(delegate.onToolAccess('Write', {file_path: `${workspace}/x.md`})).resolves.toBe('deny')

            await Promise.resolve()
            await Promise.resolve()

            expect(recorder.denies).toHaveLength(1)
            const deny = recorder.denies[0]
            expect(deny.policyType).toBe('tool')
            expect(deny.subjectType).toBe('tool')
            expect(deny.subjectId).toBe('Write')
            expect(deny.reason).toContain('Agent 模板白名单')
            expect(deny.details?.rule).toBe('agent_template_tools_whitelist')
        })

        test('文件路径越界 deny 写入 PolicyDecision (policyType=file_path)', async () => {
            const recorder = new CapturingRecorder()
            const delegate = createDelegate(['Read'], recorder)

            const escapePath = `${workspace}/../secret.md`
            await expect(delegate.onToolAccess('Read', {file_path: escapePath})).resolves.toBe('deny')

            await Promise.resolve()
            await Promise.resolve()

            expect(recorder.denies).toHaveLength(1)
            const deny = recorder.denies[0]
            expect(deny.policyType).toBe('file_path')
            expect(deny.subjectType).toBe('file_path')
            expect(deny.subjectId).toBe(escapePath)
            expect(deny.reason).toContain('越界')
            expect(deny.details?.rule).toBe('tenant_workspace_path_boundary')
        })

        test('allow 不写 PolicyDecision（避免噪声）', async () => {
            const recorder = new CapturingRecorder()
            const delegate = createDelegate(['Read'], recorder)

            await expect(delegate.onToolAccess('Read', {file_path: `${workspace}/x.md`})).resolves.toBe('allow')
            await expect(delegate.onToolAccess('mcp__docs__search', {})).resolves.toBe('allow')

            await Promise.resolve()
            await Promise.resolve()

            expect(recorder.denies).toHaveLength(0)
            expect(recorder.reviews).toHaveLength(0)
        })

        test('Task* 自动放行不写 PolicyDecision', async () => {
            const recorder = new CapturingRecorder()
            const delegate = createDelegate(['Read'], recorder)

            await expect(delegate.onToolAccess('TaskCreate', {})).resolves.toBe('allow')

            await Promise.resolve()
            await Promise.resolve()

            expect(recorder.denies).toHaveLength(0)
        })

        test('未注入 recorder 时不报错（向后兼容）', async () => {
            const delegate = createDelegate(['Read']) // 不传 recorder

            await expect(delegate.onToolAccess('Bash', {})).resolves.toBe('deny')
            await expect(delegate.onToolAccess('mcp__bad__x', {})).resolves.toBe('deny')

            // 没有 recorder 也应该返回 deny；不应抛出
        })

        test('recorder.recordDeny 抛错不阻塞决策返回', async () => {
            const recorder: PolicyDecisionRecorder = {
                async recordDeny() {
                    throw new Error('DB unavailable')
                },
                async recordReviewRequired() {
                    throw new Error('DB unavailable')
                },
            }
            const delegate = new TenantPermissionDelegate(
                {tenantId: 'tenant-1', workspace, mcpServers: ['docs']},
                {tools: ['Read']},
                {runId: 'run-test', requestId: 'req-test', recorder},
            )

            await expect(delegate.onToolAccess('Bash', {})).resolves.toBe('deny')
            // 即使 recorder 异步抛错也不能让 onToolAccess reject
        })
    })
})
