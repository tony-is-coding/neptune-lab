/**
 * governance/index.ts — Stage 2.2 治理 Hook 接口 + NoOp 默认实现
 *
 * 4 类 hook：
 * - PolicyHook:       工具调用前策略决策（allow/deny/require_review）
 * - HumanReviewHook:  Finding 后挂起人工复核
 * - EvalHook:         Run 完成后评估
 * - ArtifactHook:     Tool 输出落 EvidenceArtifact
 *
 * 设计原则：
 * - 接口 + 默认 NoOp 实现 + 可注入
 * - NoOp 行为不阻塞 substrate（PolicyHook=allow / HumanReview=approved / Eval=null / Artifact 走默认 hash）
 * - 所有类型来自 shared/contracts（跨层稳定协议）
 */

export {NoOpPolicyHook, noOpPolicyHook} from './PolicyHook.js'
export type {PolicyHook} from './PolicyHook.js'
export {NoOpHumanReviewHook, noOpHumanReviewHook} from './HumanReviewHook.js'
export type {HumanReviewHook, HumanReviewRequest} from './HumanReviewHook.js'
export {NoOpEvalHook, noOpEvalHook} from './EvalHook.js'
export type {EvalHook} from './EvalHook.js'
export {NoOpArtifactHook, noOpArtifactHook} from './ArtifactHook.js'
export type {ArtifactHook, ArtifactInput} from './ArtifactHook.js'

/**
 * GovernanceHooks bag — 注入到 AgentLoop 的容器。
 */
export interface GovernanceHooks {
	policyHook?: import('./PolicyHook.js').PolicyHook
	humanReviewHook?: import('./HumanReviewHook.js').HumanReviewHook
	evalHook?: import('./EvalHook.js').EvalHook
	artifactHook?: import('./ArtifactHook.js').ArtifactHook
}
