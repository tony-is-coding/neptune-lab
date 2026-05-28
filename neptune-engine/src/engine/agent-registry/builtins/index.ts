/**
 * Built-in Agent Manifests — substrate baseline 4 agents
 *
 * 设计目的（Stage B1.3 + B3）：
 * - substrate 默认提供 cc 已证明的 4 个内置 agent 模板
 * - product 可以选择 register 这些 baseline 到自己的 registry，或完全 override
 * - 这 4 个 agent 是 LLM 自创建 agent 时的参考形态（用户强调：未来 LLM 越强，
 *   越需要这些 baseline 当 anchor）
 *
 * 与 cc 行为差异：
 * - cc BuiltInAgentDefinition 含 baseDir / source / color / background / criticalSystemReminder_EXPERIMENTAL
 *   等业务装饰；substrate AgentManifest 仅保留稳定核心字段（type / name / description /
 *   systemPrompt / tools / modelHint / metadata）
 * - cc systemPrompt 通过 getSystemPrompt(toolUseContext) 动态生成（含 hasEmbeddedSearchTools
 *   等 cc 业务分支）；substrate 改为静态字符串（剥 cc 分支，product 注入自定义 prompt）
 * - cc 引用 cc 业务 NotebookEditTool 等；substrate 仅引用 substrate 内的 toolName 常量
 *
 * 4 个 baseline 来源（cc cc-tools/AgentTool/built-in/）：
 * - generalPurposeAgent.ts → general-purpose
 * - exploreAgent.ts → Explore
 * - planAgent.ts → Plan
 * - verificationAgent.ts → verification
 */

import type {AgentManifest} from '../AgentRegistry.js'
import {GENERAL_PURPOSE_AGENT_MANIFEST} from './generalPurposeAgent.js'
import {EXPLORE_AGENT_MANIFEST} from './exploreAgent.js'
import {PLAN_AGENT_MANIFEST} from './planAgent.js'
import {VERIFICATION_AGENT_MANIFEST} from './verificationAgent.js'

export const BUILT_IN_AGENT_MANIFESTS: readonly AgentManifest[] = Object.freeze([
	GENERAL_PURPOSE_AGENT_MANIFEST,
	EXPLORE_AGENT_MANIFEST,
	PLAN_AGENT_MANIFEST,
	VERIFICATION_AGENT_MANIFEST,
])

export {
	GENERAL_PURPOSE_AGENT_MANIFEST,
	EXPLORE_AGENT_MANIFEST,
	PLAN_AGENT_MANIFEST,
	VERIFICATION_AGENT_MANIFEST,
}
