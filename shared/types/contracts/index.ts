/**
 * shared/types/contracts — 稳定协议层
 *
 * 7 个跨层契约（Run/ToolInvocation/Artifact/EvidenceArtifact/AuditEvent/HumanReview/PolicyDecision）。
 *
 * 设计原则：
 * - 用 zod schema 定义；export Schema (zod) + 类型 (z.infer)
 * - 所有 schema 用 .passthrough() 接受未知字段（向前兼容）
 * - 不承载业务行为（finance / closing / 财务关账等业务语义不在此层）
 *
 * 详见 README.md 的破坏性变更策略。
 */

export {RunSchema, type Run} from './Run.js'
export {ToolInvocationSchema, type ToolInvocation} from './ToolInvocation.js'
export {ArtifactSchema, type Artifact} from './Artifact.js'
export {EvidenceArtifactSchema, type EvidenceArtifact} from './EvidenceArtifact.js'
export {AuditEventSchema, type AuditEvent} from './AuditEvent.js'
export {HumanReviewSchema, type HumanReview} from './HumanReview.js'
export {PolicyDecisionSchema, type PolicyDecision} from './PolicyDecision.js'
