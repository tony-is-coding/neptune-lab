/**
 * governance/PolicyHook.ts — 工具调用前注入策略决策
 *
 * Substrate 提供接口，product 注入业务策略（默认 NoOp 总返 allow）。
 * 决策结果 PolicyDecision 来自 shared/contracts。
 */

import {randomUUID} from 'crypto'
import type {PolicyDecision, ToolInvocation} from '@shared/contracts'

/**
 * PolicyHook 接口：在工具调用前执行策略决策。
 */
export interface PolicyHook {
	beforeToolUse(invocation: ToolInvocation): Promise<PolicyDecision>
}

/**
 * NoOpPolicyHook — 默认实现，总返 allow。
 */
export class NoOpPolicyHook implements PolicyHook {
	async beforeToolUse(_invocation: ToolInvocation): Promise<PolicyDecision> {
		return {
			id: randomUUID(),
			decisionAt: new Date().toISOString(),
			behavior: 'allow',
		}
	}
}

/** 单例（测试与默认场景方便引用）。 */
export const noOpPolicyHook: PolicyHook = new NoOpPolicyHook()
