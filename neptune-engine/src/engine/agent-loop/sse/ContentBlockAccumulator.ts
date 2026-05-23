/**
 * ContentBlockAccumulator — 内部累积 in-progress content block 的状态机
 *
 * 算法纲要（参考 cc claude.ts:2046-2266，去除 product 干扰后）：
 *
 *   on content_block_start{index, content_block}:
 *     按 type 分支创建 InProgressContentBlock，存在 slots[index]
 *     - 'text'      → {text: ''}                （content_block_start 偶尔带 text，cc 故意忽略）
 *     - 'tool_use'  → {id, name, partialJson:''} （input 用 string 累积）
 *     - 'thinking'  → {thinking:'', signature:''}（signature 由 signature_delta 填）
 *     - 其他类型     → fail-loud（不抄 advisor / connector_text）
 *
 *   on content_block_delta{index, delta}:
 *     按 delta.type 累加到对应槽位
 *     - 'text_delta'        → text += delta.text     (要求 slot.kind === 'text')
 *     - 'input_json_delta'  → partialJson += delta.partial_json (要求 slot.kind === 'tool_use')
 *     - 'thinking_delta'    → thinking += delta.thinking  (要求 slot.kind === 'thinking')
 *     - 'signature_delta'   → signature = delta.signature (要求 slot.kind === 'thinking')
 *     - 'citations_delta'   → 忽略（cc 也忽略）
 *     - 其他类型             → fail-loud
 *
 *   on content_block_stop{index}:
 *     从 slots[index] emit CompleteContentBlock：
 *     - 'text'      → {type:'text', text}
 *     - 'tool_use'  → {type:'tool_use', id, name, input: JSON.parse(partialJson || '{}')}
 *                       JSON 解析失败 → emit error event（source: invalid_input_json）
 *     - 'thinking'  → {type:'thinking', thinking, signature}
 *     emit 后清空 slots[index]
 *
 * 不实现的 cc 功能（明确拒绝）：
 * - server_tool_use / advisor_tool_result（advisor 业务）
 * - connector_text + connector_text_delta（feature('CONNECTOR_TEXT')，product 关注点）
 * - research 字段提取（USER_TYPE='ant' 内部业务）
 * - tengu_streaming_error 埋点（analytics 关注点；用 EngineError 替代）
 *
 * 与 cc 行为差异都记录在 __tests__/oracle/README.md。
 */

import {EngineError, EngineErrorCode} from '../../errors.js'
import type {CompleteContentBlock, ParsedSSEEvent} from '../types.js'
import type {InProgressContentBlock, RawSSEEvent} from './sseEvents.js'

/**
 * 错误标签，区分 fail-loud 来源（debug 用）。
 */
type AccumulatorErrorSource = 'block_state' | 'unknown_event' | 'invalid_input_json'

/** Accumulator emit 的中间结果（要么是 complete block，要么是 error）。 */
export type AccumulatorOutput =
	| {kind: 'complete'; index: number; block: CompleteContentBlock}
	| {kind: 'error'; index: number | null; source: AccumulatorErrorSource; error: Error}

/**
 * ContentBlockAccumulator
 *
 * 不可变 API：每次 onStart / onDelta / onStop 调用返回 AccumulatorOutput[]
 *  （complete 时返回 1 个 complete；error 时返回 1 个 error；其他时候返回空数组）。
 *
 * 内部状态是 map<index, InProgressContentBlock>，不暴露给上层。
 */
export class ContentBlockAccumulator {
	private readonly slots = new Map<number, InProgressContentBlock>()

	/** 处理 content_block_start。 */
	onStart(event: Extract<RawSSEEvent, {type: 'content_block_start'}>): AccumulatorOutput[] {
		const index = event.index
		const block = event.content_block
		switch (block.type) {
			case 'text':
				// cc 注意点：content_block_start 偶尔带 text 内容，但它会在 content_block_delta 里
				// 重复 emit 同样的 text，所以 cc 故意忽略 start 自带的 text，从空字符串累积。
				this.slots.set(index, {kind: 'text', text: ''})
				return []
			case 'tool_use':
				this.slots.set(index, {
					kind: 'tool_use',
					id: block.id,
					name: block.name,
					partialJson: '',
				})
				return []
			case 'thinking':
				this.slots.set(index, {
					kind: 'thinking',
					thinking: '',
					signature: '',
				})
				return []
			default: {
				// 不抄 server_tool_use / advisor / connector_text。fail-loud。
				const errType = (block as {type?: string}).type ?? 'unknown'
				return [
					{
						kind: 'error',
						index,
						source: 'unknown_event',
						error: new EngineError(
							EngineErrorCode.EXECUTION_ERROR,
							`SSE accumulator: unsupported content_block type '${errType}' at index ${index}`,
						),
					},
				]
			}
		}
	}

	/** 处理 content_block_delta。 */
	onDelta(event: Extract<RawSSEEvent, {type: 'content_block_delta'}>): AccumulatorOutput[] {
		const index = event.index
		const slot = this.slots.get(index)
		if (!slot) {
			return [
				{
					kind: 'error',
					index,
					source: 'block_state',
					error: new EngineError(
						EngineErrorCode.EXECUTION_ERROR,
						`SSE accumulator: content_block_delta for unknown index ${index}`,
					),
				},
			]
		}
		const delta = event.delta as unknown as {type: string; [key: string]: unknown}
		switch (delta.type) {
			case 'text_delta': {
				if (slot.kind !== 'text') {
					return [this.mismatchError(index, 'text_delta', slot.kind)]
				}
				slot.text += String(delta.text ?? '')
				return []
			}
			case 'input_json_delta': {
				if (slot.kind !== 'tool_use') {
					return [this.mismatchError(index, 'input_json_delta', slot.kind)]
				}
				slot.partialJson += String(delta.partial_json ?? '')
				return []
			}
			case 'thinking_delta': {
				if (slot.kind !== 'thinking') {
					return [this.mismatchError(index, 'thinking_delta', slot.kind)]
				}
				slot.thinking += String(delta.thinking ?? '')
				return []
			}
			case 'signature_delta': {
				if (slot.kind !== 'thinking') {
					return [this.mismatchError(index, 'signature_delta', slot.kind)]
				}
				slot.signature = String(delta.signature ?? '')
				return []
			}
			case 'citations_delta':
				// cc 也忽略 citations_delta。如果未来需要支持，再加分支。
				return []
			default:
				return [
					{
						kind: 'error',
						index,
						source: 'unknown_event',
						error: new EngineError(
							EngineErrorCode.EXECUTION_ERROR,
							`SSE accumulator: unsupported delta type '${delta.type}' at index ${index}`,
						),
					},
				]
		}
	}

	/** 处理 content_block_stop。 */
	onStop(event: Extract<RawSSEEvent, {type: 'content_block_stop'}>): AccumulatorOutput[] {
		const index = event.index
		const slot = this.slots.get(index)
		if (!slot) {
			return [
				{
					kind: 'error',
					index,
					source: 'block_state',
					error: new EngineError(
						EngineErrorCode.EXECUTION_ERROR,
						`SSE accumulator: content_block_stop for unknown index ${index}`,
					),
				},
			]
		}
		this.slots.delete(index)
		return [this.finalize(index, slot)]
	}

	/** 把 in-progress 状态转成完整 block；必要时 emit error。 */
	private finalize(index: number, slot: InProgressContentBlock): AccumulatorOutput {
		switch (slot.kind) {
			case 'text':
				return {
					kind: 'complete',
					index,
					block: {type: 'text', text: slot.text},
				}
			case 'tool_use': {
				const raw = slot.partialJson.length > 0 ? slot.partialJson : '{}'
				let parsed: unknown
				try {
					parsed = JSON.parse(raw)
				} catch (err) {
					return {
						kind: 'error',
						index,
						source: 'invalid_input_json',
						error: new EngineError(
							EngineErrorCode.EXECUTION_ERROR,
							`SSE accumulator: tool_use[${slot.id}] input JSON parse failed: ${(err as Error).message}`,
							{cause: err as Error},
						),
					}
				}
				if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
					return {
						kind: 'error',
						index,
						source: 'invalid_input_json',
						error: new EngineError(
							EngineErrorCode.EXECUTION_ERROR,
							`SSE accumulator: tool_use[${slot.id}] input must be an object, got ${typeof parsed}`,
						),
					}
				}
				return {
					kind: 'complete',
					index,
					block: {
						type: 'tool_use',
						id: slot.id,
						name: slot.name,
						input: parsed as Record<string, unknown>,
					},
				}
			}
			case 'thinking':
				return {
					kind: 'complete',
					index,
					block: {
						type: 'thinking',
						thinking: slot.thinking,
						// signature 可能为空字符串，但字段必须存在；cc 同样行为。
						signature: slot.signature,
					},
				}
		}
	}

	private mismatchError(
		index: number,
		deltaType: string,
		actualKind: InProgressContentBlock['kind'],
	): AccumulatorOutput {
		return {
			kind: 'error',
			index,
			source: 'block_state',
			error: new EngineError(
				EngineErrorCode.EXECUTION_ERROR,
				`SSE accumulator: ${deltaType} on incompatible block kind '${actualKind}' at index ${index}`,
			),
		}
	}

	/** 测试用：检查是否还有未完成的 slot（流提前结束时上层会用到）。 */
	hasOpenSlots(): boolean {
		return this.slots.size > 0
	}

	/** 测试用：丢掉所有未完成 slot（在 stream 中断后清理）。 */
	reset(): void {
		this.slots.clear()
	}
}

/** 把 AccumulatorOutput 转成对外的 ParsedSSEEvent。 */
export function accumulatorOutputToParsedEvent(out: AccumulatorOutput): ParsedSSEEvent {
	if (out.kind === 'complete') {
		return {type: 'content_block_complete', index: out.index, block: out.block}
	}
	return {type: 'error', source: out.source, error: out.error}
}
