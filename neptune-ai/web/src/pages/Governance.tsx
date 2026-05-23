import {useCallback, useEffect, useMemo, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  createHumanReview,
  decideHumanReview,
  exportAuditEventsCsv,
  listAgentVersions,
  listAuditEvents,
  getCostSummary,
  getQuotaStatus,
  getRunObservability,
  listPlatformRuns,
  listHumanReviews,
  listPolicyDecisions,
  listRunArtifacts,
  listRunEvidenceArtifacts,
  listRunEvents,
  listToolInvocations,
  type AgentTemplateVersion,
  type PlatformArtifact,
  type PlatformAuditEvent,
  type PlatformCostSummary,
  type PlatformEvidenceArtifact,
  type PlatformHumanReview,
  type PlatformPolicyDecision,
  type PlatformQuotaStatus,
  type PlatformRun,
  type PlatformRunEvent,
  type PlatformRunObservability,
  type PlatformToolInvocation,
} from '../api/platformFacts';
import {cancelRun, getRunDetail, retryRun} from '../api/runs';
import {formatApiErrorForDisplay} from '../api/client';
import {useRunEventStream} from '../hooks/useRunEventStream';
import type {RunRuntimeEvent} from '@shared/neptune-ai';

type GovernanceTab = 'runs' | 'audit' | 'versions' | 'policy' | 'costs' | 'reviews';
type ReviewModalMode = 'create' | 'approve' | 'reject' | 'waive';

const tabs: Array<{id: GovernanceTab; label: string; icon: string}> = [
  {id: 'runs', label: '运行记录', icon: 'history'},
  {id: 'costs', label: '成本概览', icon: 'account_balance_wallet'},
  {id: 'reviews', label: '复核队列', icon: 'approval'},
  {id: 'audit', label: '审计事件', icon: 'policy'},
  {id: 'versions', label: '智能体版本', icon: 'difference'},
  {id: 'policy', label: '策略决策', icon: 'gavel'},
];

const auditResourceTypeOptions = [
  {value: '', label: '全部资源'},
  {value: 'run', label: '运行'},
  {value: 'agent', label: '智能体'},
  {value: 'agent_version', label: '智能体版本'},
  {value: 'skill', label: '技能'},
  {value: 'agent_skill_binding', label: '技能绑定关系'},
  {value: 'agent_document', label: '智能体材料'},
  {value: 'human_review', label: '人工复核'},
  {value: 'policy_decision', label: '策略决策'},
];

const auditOutcomeOptions = [
  {value: '', label: '全部结果'},
  {value: 'success', label: '成功'},
  {value: 'failure', label: '失败'},
];

function parseGovernanceTab(value: string | null): GovernanceTab {
  return tabs.some(tab => tab.id === value) ? value as GovernanceTab : 'runs';
}

function formatDate(value: string | null | undefined) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTokens(run: PlatformRun) {
  const input = run.inputTokens ?? 0;
  const output = run.outputTokens ?? 0;
  return `${input + output}（入 ${input} / 出 ${output}）`;
}

function formatTokenNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN').format(value ?? 0);
}

function formatCostCents(value: number | null | undefined) {
  return `¥${((value ?? 0) / 100).toFixed(2)}`;
}

function formatDurationMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '未记录';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} 秒`;
}

function quotaStatusText(status: PlatformQuotaStatus): string {
  if (status.allowed) return '允许发起新运行';
  if (status.reason === 'CONCURRENT_SESSION_LIMIT') {
    return '运行中并发已达到租户上限，等待现有运行结束后再发起。';
  }
  return '今日 token 已达到租户配额上限，暂不能发起新运行。';
}

function formatDuration(run: PlatformRun) {
  if (!run.completedAt) return '未结束';
  const started = new Date(run.startedAt).getTime();
  const completed = new Date(run.completedAt).getTime();
  if (Number.isNaN(started) || Number.isNaN(completed) || completed < started) return '未记录';
  return `${Math.round((completed - started) / 1000)} 秒`;
}

function formatEventType(type: string) {
  const labels: Record<string, string> = {
    'run.started': '运行开始',
    'run.output.delta': '输出增量',
    'run.output.completed': '输出完成',
    'tool.invocation.started': '工具开始',
    'tool.invocation.completed': '工具完成',
    'tool.invocation.failed': '工具失败',
    'run.completed': '运行完成',
    'run.failed': '运行失败',
    'skill.created': '技能创建',
    'skill.updated': '技能更新',
    'skill.deleted': '技能删除',
    'skill.bound_to_agent': '技能绑定',
    'skill.unbound_from_agent': '技能移除',
    'agent_document.uploaded': '材料上传',
    'agent_document.deleted': '材料删除',
  };
  return labels[type] ?? type;
}

function auditResourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    run: '运行',
    agent: '智能体',
    agent_version: '智能体版本',
    skill: '技能',
    agent_skill_binding: '技能绑定关系',
    agent_document: '智能体材料',
    memory: '记忆材料',
    knowledge: '知识材料',
    human_review: '人工复核',
    policy_decision: '策略决策',
  };
  return labels[type] ?? type;
}

function auditFilterSummary(resourceType: string | null, resourceId: string | null) {
  const parts: string[] = [];
  if (resourceType) parts.push(auditResourceTypeLabel(resourceType));
  if (resourceId) parts.push(resourceId);
  return parts.length > 0 ? `筛选：${parts.join(' / ')}` : null;
}

function hasAuditFilters(filters: {
  action: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: string | null;
}) {
  return Boolean(filters.action || filters.resourceType || filters.resourceId || filters.outcome);
}

function policyDecisionLabel(decision: string) {
  const labels: Record<string, string> = {
    allow: '允许',
    deny: '拒绝',
    review_required: '需复核',
  };
  return labels[decision] ?? decision;
}

function policyTypeLabel(type: string) {
  const labels: Record<string, string> = {
    model: '模型',
    tool: '工具',
    quota: '配额',
    human_review: '人工复核',
    mcp: 'MCP',
    path: '路径',
    data_boundary: '数据边界',
  };
  return labels[type] ?? type;
}

function reviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待复核',
    approved: '已批准',
    rejected: '已退回',
    waived: '已豁免',
  };
  return labels[status] ?? status;
}

function reviewDecisionLabel(decision: string | null | undefined) {
  const labels: Record<string, string> = {
    approve: '批准',
    reject: '退回处理',
    waive: '批准豁免',
  };
  return decision ? labels[decision] ?? decision : '未处理';
}

function reviewTypeLabel(type: string) {
  const labels: Record<string, string> = {
    run_result: '运行结果',
    policy_decision: '策略决策',
    artifact: '成果文件',
    evidence: '证据',
  };
  return labels[type] ?? type;
}

function artifactTypeLabel(type: string) {
  const labels: Record<string, string> = {
    file: '文件',
    report: '报告',
    table: '表格',
    dataset: '数据集',
    evidence: '证据',
    other: '其他',
  };
  return labels[type] ?? type;
}

function sourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    runtime_tool: '运行工具',
    upload: '上传',
    connector: '连接器',
    generated_report: '生成报告',
    manual: '手工',
    other: '其他',
  };
  return labels[type] ?? type;
}

function evidenceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    source_file: '源文件',
    connector_snapshot: '连接器快照',
    generated_extract: '生成摘录',
    runtime_observation: '运行观察',
    other: '其他',
  };
  return labels[type] ?? type;
}

function shortId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '无';
  const text = String(value);
  return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function shortHash(value: string | null | undefined) {
  if (!value) return '未记录';
  const [algorithm, digest] = value.split(':');
  if (algorithm && digest && digest.length > 12) {
    return `${algorithm}:${digest.slice(0, 1)}...${digest.slice(-4)}`;
  }
  return shortId(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    success: '成功',
    failure: '失败',
  };
  return labels[status] ?? status;
}

function snapshotName(version: AgentTemplateVersion) {
  const name = version.snapshotSummary.name;
  return typeof name === 'string' && name.trim() ? name : '未命名智能体';
}

function snapshotModel(version: AgentTemplateVersion) {
  const {modelProvider, model} = version.snapshotSummary;
  if (modelProvider && model) return `${modelProvider} / ${model}`;
  return model ?? modelProvider ?? '未记录';
}

function EmptyState({icon, title, description}: {icon: string; title: string; description: string}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-cream bg-ivory px-6 py-12 text-center">
      <span className="material-symbols-outlined mb-3 text-[32px] text-stone">{icon}</span>
      <p className="text-[14px] font-medium text-charcoal">{title}</p>
      <p className="mt-1 max-w-[420px] text-[12px] leading-relaxed text-stone">{description}</p>
    </div>
  );
}

function ErrorState({message}: {message: string}) {
  return (
    <div className="rounded-xl border border-error/20 bg-ivory px-4 py-3 text-[13px] text-error">
      {`加载失败：${message}`.split('\n').map((line, index) => (
        <p key={line || index}>{line}</p>
      ))}
    </div>
  );
}

function MetricCard({label, value, helper}: {label: string; value: string; helper: string}) {
  return (
    <div className="rounded-xl border border-border-cream bg-ivory px-4 py-4">
      <p className="text-[12px] text-stone">{label}</p>
      <p className="mt-2 font-serif text-[24px] font-medium leading-tight text-charcoal">{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-stone">{helper}</p>
    </div>
  );
}

function RunStreamStatusBadge({
  status,
  endReason,
}: {
  status: ReturnType<typeof useRunEventStream>['status'];
  endReason: ReturnType<typeof useRunEventStream>['endReason'];
}) {
  let label: string;
  let dotClass: string;
  if (endReason) {
    label = endReason === 'completed' ? '已完成' : endReason === 'failed' ? '已失败' : '已取消';
    dotClass = 'bg-stone';
  } else if (status === 'connecting') {
    label = '正在连接';
    dotClass = 'bg-amber-500';
  } else if (status === 'connected') {
    label = '实时';
    dotClass = 'bg-emerald-500 animate-pulse';
  } else if (status === 'reconnecting') {
    label = '正在重连';
    dotClass = 'bg-amber-500';
  } else if (status === 'failed') {
    label = '连接失败';
    dotClass = 'bg-red-500';
  } else {
    label = '已断开';
    dotClass = 'bg-stone';
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2 py-0.5 text-[11px] text-charcoal"
      data-testid="run-stream-status"
      data-status={status}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function QuotaStatusPanel({status}: {status: PlatformQuotaStatus}) {
  const allowed = status.allowed;

  return (
    <div className={`rounded-xl border px-4 py-4 ${
      allowed ? 'border-border-cream bg-surface-container-low' : 'border-error/20 bg-ivory'
    }`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[12px] font-medium text-stone">新 Run 放行状态</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`material-symbols-outlined text-[20px] ${allowed ? 'text-olive' : 'text-error'}`}>
              {allowed ? 'check_circle' : 'block'}
            </span>
            <p className={`text-[15px] font-medium ${allowed ? 'text-charcoal' : 'text-error'}`}>
              {quotaStatusText(status)}
            </p>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-stone">
            准入状态来自后端配额 gate，与实际创建受控运行前置检查同源。
          </p>
        </div>
        <div className="grid min-w-[360px] gap-3 sm:grid-cols-4">
          <QuotaMiniMetric label="今日已用" value={`${formatTokenNumber(status.usage.totalTokensToday)} token`} />
          <QuotaMiniMetric label="每日 token 限额" value={`${formatTokenNumber(status.quota.maxTokensPerDay)} token`} />
          <QuotaMiniMetric label="运行中并发" value={String(status.usage.runningSessions)} />
          <QuotaMiniMetric label="最大并发" value={String(status.quota.maxConcurrentSessions)} />
        </div>
      </div>
    </div>
  );
}

function QuotaMiniMetric({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-lg border border-border-cream bg-ivory px-3 py-2">
      <p className="text-[11px] text-stone">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-charcoal">{value}</p>
    </div>
  );
}

function RunObservabilityPanel({
  observability,
  loading,
  error,
  onOpenAudit,
}: {
  observability: PlatformRunObservability | null;
  loading: boolean;
  error: string | null;
  onOpenAudit: () => void;
}) {
  if (error) return <ErrorState message={error} />;
  if (loading) {
    return (
      <EmptyState
        icon="hub"
        title="正在加载可观测性关联"
        description="正在读取请求、运行、线程、版本和平台事实计数。"
      />
    );
  }
  if (!observability) {
    return (
      <EmptyState
        icon="hub"
        title="当前运行还没有沉淀完整观测事实"
        description="运行开始后会逐步关联请求、线程、事件、工具、成果、证据和审计事实。"
      />
    );
  }

  return (
    <div className="rounded-xl border border-border-cream bg-surface-container-low px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[12px] font-medium text-stone">可观测性关联</p>
          <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-olive">
            这次运行已关联请求、线程、智能体版本、事件、工具调用、成果文件和证据元数据。
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-stone">{observability.trace.message}</p>
        </div>
        <button
          type="button"
          onClick={onOpenAudit}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border-cream bg-ivory px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-sand"
        >
          <span className="material-symbols-outlined text-[16px]">policy</span>
          查看审计事件
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ObservationKey label="请求 ID" value={shortId(observability.requestId)} />
        <ObservationKey label="运行 ID" value={shortId(observability.runId)} />
        <ObservationKey label="线程 ID" value={shortId(observability.threadId)} />
        <ObservationKey label="智能体版本" value={observability.agentVersion ? `v${observability.agentVersion.version}` : shortId(observability.agentVersionId)} />
        <ObservationKey label="版本指纹" value={shortHash(observability.agentVersion?.versionHash)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <ObservationKey label="事件" value={`${observability.factCounts.events} 条`} compactText={`事件 ${observability.factCounts.events} 条`} />
        <ObservationKey label="工具调用" value={`${observability.factCounts.toolInvocations} 次`} compactText={`工具调用 ${observability.factCounts.toolInvocations} 次`} />
        <ObservationKey label="成果文件" value={`${observability.factCounts.artifacts} 个`} compactText={`成果文件 ${observability.factCounts.artifacts} 个`} />
        <ObservationKey label="证据元数据" value={`${observability.factCounts.evidenceArtifacts} 条`} compactText={`证据元数据 ${observability.factCounts.evidenceArtifacts} 条`} />
        <ObservationKey label="策略决策" value={`${observability.factCounts.policyDecisions} 条`} />
        <ObservationKey label="审计事件" value={`${observability.factCounts.auditEvents} 条`} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <ObservationKey label="模型" value={observability.model || '未记录'} />
        <ObservationKey label="运行耗时" value={formatDurationMs(observability.durationMs)} />
        <ObservationKey label="Token" value={formatTokenNumber(observability.tokenUsage.totalTokens)} />
      </div>
    </div>
  );
}

function ObservationKey({label, value, compactText}: {label: string; value: string; compactText?: string}) {
  return (
    <div className="rounded-lg border border-border-cream bg-ivory px-3 py-2">
      <p className="text-[11px] text-stone">{label}</p>
      <p className="mt-1 break-words text-[13px] font-medium text-charcoal">{compactText ?? value}</p>
    </div>
  );
}

function ReviewModal({
  mode,
  review,
  selectedRun,
  reason,
  error,
  submitting,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  mode: ReviewModalMode;
  review: PlatformHumanReview | null;
  selectedRun: PlatformRun | null;
  reason: string;
  error: string | null;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = {
    create: {
      title: '提交复核',
      description: '确认提交复核？系统会创建待复核记录，并写入审计事件。',
      button: '提交复核',
      placeholder: '说明为什么这次运行需要人工复核。',
    },
    approve: {
      title: '批准复核项',
      description: '确认批准该复核项？批准结果会写入审计事件，并可用于后续放行。',
      button: '批准',
      placeholder: '填写批准原因。',
    },
    reject: {
      title: '退回处理',
      description: '确认退回处理？退回原因会写入审计事件，相关执行不会被批准。',
      button: '退回处理',
      placeholder: '填写退回原因。',
    },
    waive: {
      title: '批准豁免',
      description: '确认批准豁免？豁免原因、范围和有效期会写入审计事件，请确认符合治理要求。',
      button: '批准豁免',
      placeholder: '填写豁免原因、范围和有效期。',
    },
  }[mode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 px-4">
      <div className="w-full max-w-[520px] rounded-xl border border-border-cream bg-ivory p-5 shadow-[0_0_0_1px_rgba(232,230,220,0.9)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-[24px] font-medium leading-tight text-charcoal">{copy.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-stone">{copy.description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border-cream px-2 py-1 text-[12px] text-stone hover:bg-surface-container"
          >
            关闭
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-border-cream bg-surface-container-low px-3 py-3 text-[12px] text-stone">
          {mode === 'create'
            ? `运行：${shortId(selectedRun?.id)} · 请求：${shortId(selectedRun?.requestId)}`
            : `复核项：${review?.title ?? '未命名'} · 状态：${reviewStatusLabel(review?.status ?? '')}`}
        </div>

        <label className="mt-4 block text-[12px] font-medium text-charcoal" htmlFor="review-reason">
          原因
        </label>
        <textarea
          id="review-reason"
          value={reason}
          onChange={event => onReasonChange(event.target.value)}
          placeholder={copy.placeholder}
          className="mt-2 min-h-[112px] w-full rounded-xl border border-border-cream bg-ivory px-3 py-3 text-[13px] leading-relaxed text-charcoal outline-none focus:border-[#3898ec]"
        />
        {error && <p className="mt-2 text-[12px] text-error">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-border-cream px-4 py-2 text-[13px] font-medium text-charcoal hover:bg-surface-container disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-lg bg-charcoal px-4 py-2 text-[13px] font-medium text-ivory hover:bg-[#30302e] disabled:opacity-60"
          >
            {submitting ? '正在提交' : copy.button}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Governance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const auditResourceType = searchParams.get('resourceType');
  const auditResourceId = searchParams.get('resourceId');
  const auditAction = searchParams.get('action');
  const auditOutcome = searchParams.get('outcome');
  const [activeTab, setActiveTab] = useState<GovernanceTab>(() => parseGovernanceTab(searchParams.get('tab')));
  const [runs, setRuns] = useState<PlatformRun[]>([]);
  const [runEvents, setRunEvents] = useState<PlatformRunEvent[]>([]);
  const [toolInvocations, setToolInvocations] = useState<PlatformToolInvocation[]>([]);
  const [artifacts, setArtifacts] = useState<PlatformArtifact[]>([]);
  const [evidenceArtifacts, setEvidenceArtifacts] = useState<PlatformEvidenceArtifact[]>([]);
  const [runObservability, setRunObservability] = useState<PlatformRunObservability | null>(null);
  const [costSummary, setCostSummary] = useState<PlatformCostSummary | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<PlatformQuotaStatus | null>(null);
  const [policyDecisions, setPolicyDecisions] = useState<PlatformPolicyDecision[]>([]);
  const [humanReviews, setHumanReviews] = useState<PlatformHumanReview[]>([]);
  const [auditEvents, setAuditEvents] = useState<PlatformAuditEvent[]>([]);
  const [versions, setVersions] = useState<AgentTemplateVersion[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{mode: ReviewModalMode; review: PlatformHumanReview | null} | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [runActionError, setRunActionError] = useState<string | null>(null);
  const [runActionMessage, setRunActionMessage] = useState<string | null>(null);
  const [runActionSubmitting, setRunActionSubmitting] = useState(false);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryInput, setRetryInput] = useState('');
  const [auditFilterDraft, setAuditFilterDraft] = useState({
    resourceType: auditResourceType ?? '',
    resourceId: auditResourceId ?? '',
    action: auditAction ?? '',
    outcome: auditOutcome ?? '',
  });
  const [auditExporting, setAuditExporting] = useState(false);

  const [runsLoading, setRunsLoading] = useState(true);
  const [runFactsLoading, setRunFactsLoading] = useState(false);
  const [runObservabilityLoading, setRunObservabilityLoading] = useState(false);
  const [costLoading, setCostLoading] = useState(true);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runFactsError, setRunFactsError] = useState<string | null>(null);
  const [runObservabilityError, setRunObservabilityError] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditActionMessage, setAuditActionMessage] = useState<string | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const loadHumanReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const res = await listHumanReviews({limit: 50});
      setHumanReviews(res.data);
    } catch (error) {
      setReviewsError(formatApiErrorForDisplay(error));
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const auditSummary = useMemo(
    () => auditFilterSummary(auditResourceType, auditResourceId),
    [auditResourceType, auditResourceId],
  );
  const auditHasFilters = hasAuditFilters({
    action: auditAction,
    resourceType: auditResourceType,
    resourceId: auditResourceId,
    outcome: auditOutcome,
  });

  const selectTab = useCallback((tab: GovernanceTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, {replace: true});
  }, [searchParams, setSearchParams]);

  const loadAuditEvents = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await listAuditEvents({
        action: auditAction ?? undefined,
        resourceType: auditResourceType ?? undefined,
        resourceId: auditResourceId ?? undefined,
        outcome: auditOutcome ?? undefined,
        limit: 50,
      });
      setAuditEvents(res.data);
    } catch (error) {
      setAuditError(formatApiErrorForDisplay(error));
    } finally {
      setAuditLoading(false);
    }
  }, [auditAction, auditOutcome, auditResourceId, auditResourceType]);

  useEffect(() => {
    setActiveTab(parseGovernanceTab(searchParams.get('tab')));
    const runId = searchParams.get('runId');
    if (runId) setSelectedRunId(runId);
    setAuditFilterDraft({
      resourceType: searchParams.get('resourceType') ?? '',
      resourceId: searchParams.get('resourceId') ?? '',
      action: searchParams.get('action') ?? '',
      outcome: searchParams.get('outcome') ?? '',
    });
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    setRunsLoading(true);
    setRunsError(null);
    listPlatformRuns({limit: 50})
      .then(res => {
        if (cancelled) return;
        setRuns(res.data);
        setSelectedAgentId(current => current ?? res.data[0]?.agentId ?? null);
        const deepLinkedRunId = searchParams.get('runId');
        setSelectedRunId(current => current ?? deepLinkedRunId ?? res.data[0]?.id ?? null);
      })
      .catch(error => {
        if (!cancelled) setRunsError(formatApiErrorForDisplay(error));
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunEvents([]);
      setToolInvocations([]);
      setArtifacts([]);
      setEvidenceArtifacts([]);
      setRunFactsError(null);
      setRunObservability(null);
      setRunObservabilityError(null);
      return;
    }

    let cancelled = false;
    setRunFactsLoading(true);
    setRunFactsError(null);
    getRunDetail(selectedRunId)
      .then(async detail => {
        if (cancelled) return;
        setRuns(prev => {
          const exists = prev.some(run => run.id === detail.run.id);
          return exists ? prev.map(run => run.id === detail.run.id ? detail.run : run) : [detail.run, ...prev];
        });
        setSelectedAgentId(detail.run.agentId);
        setRunEvents(detail.events.data);
        setToolInvocations(detail.toolInvocations.data);

        const [artifactsRes, evidenceRes] = await Promise.allSettled([
          listRunArtifacts(selectedRunId, {limit: 100}),
          listRunEvidenceArtifacts(selectedRunId, {limit: 100}),
        ]);
        setArtifacts(artifactsRes.status === 'fulfilled' ? artifactsRes.value.data : []);
        setEvidenceArtifacts(evidenceRes.status === 'fulfilled' ? evidenceRes.value.data : []);
      })
      .catch(error => {
        if (!cancelled) setRunFactsError(formatApiErrorForDisplay(error));
      })
      .finally(() => {
        if (!cancelled) setRunFactsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunObservability(null);
      setRunObservabilityError(null);
      return;
    }

    let cancelled = false;
    setRunObservabilityLoading(true);
    setRunObservabilityError(null);
    getRunObservability(selectedRunId)
      .then(res => {
        if (!cancelled) setRunObservability(res);
      })
      .catch(error => {
        if (!cancelled) setRunObservabilityError(formatApiErrorForDisplay(error));
      })
      .finally(() => {
        if (!cancelled) setRunObservabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    let cancelled = false;

    setCostLoading(true);
    setCostError(null);
    getCostSummary('all_time')
      .then(res => {
        if (!cancelled) setCostSummary(res);
      })
      .catch(error => {
        if (!cancelled) setCostError(formatApiErrorForDisplay(error));
      })
      .finally(() => {
        if (!cancelled) setCostLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setQuotaLoading(true);
    setQuotaError(null);
    getQuotaStatus()
      .then(res => {
        if (!cancelled) setQuotaStatus(res);
      })
      .catch(error => {
        if (!cancelled) setQuotaError(formatApiErrorForDisplay(error));
      })
      .finally(() => {
        if (!cancelled) setQuotaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setPolicyLoading(true);
    setPolicyError(null);
    listPolicyDecisions({limit: 50})
      .then(res => {
        if (!cancelled) setPolicyDecisions(res.data);
      })
      .catch(error => {
        if (!cancelled) setPolicyError(formatApiErrorForDisplay(error));
      })
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadHumanReviews();
  }, [loadHumanReviews]);

  useEffect(() => {
    void loadAuditEvents();
  }, [loadAuditEvents]);

  useEffect(() => {
    if (!selectedAgentId) {
      setVersions([]);
      setVersionsError(null);
      return;
    }

    let cancelled = false;
    setVersionsLoading(true);
    setVersionsError(null);
    listAgentVersions(selectedAgentId, {limit: 50})
      .then(res => {
        if (!cancelled) setVersions(res.data);
      })
      .catch(error => {
        if (!cancelled) setVersionsError(formatApiErrorForDisplay(error));
      })
      .finally(() => {
        if (!cancelled) setVersionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  const selectedRun = useMemo(
    () => runs.find(run => run.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  // 实时事件流：仅当选中的 Run 处于 running 状态时启用，避免对终态运行
  // 维持空闲长连接。useRunEventStream 内部会处理订阅/续传/重连。
  const runStreamEnabled = Boolean(selectedRunId && selectedRun?.status === 'running');
  const runStream = useRunEventStream(selectedRunId, {enabled: runStreamEnabled});

  // 历史快照（来自 getRunDetail）+ 实时增量事件合并去重，按 sequence 升序。
  const mergedRunEvents = useMemo(() => {
    const map = new Map<number, PlatformRunEvent | RunRuntimeEvent>();
    for (const ev of runEvents) map.set(ev.sequence, ev);
    for (const ev of runStream.events) {
      // RunRuntimeEvent 与 PlatformRunEvent 字段重叠（id/sequence/runId/eventType/
      // requestId/payloadSummary/occurredAt），渲染层只用这些字段，可直接合并。
      map.set(ev.sequence, ev as unknown as PlatformRunEvent);
    }
    return Array.from(map.values()).sort((a, b) => a.sequence - b.sequence);
  }, [runEvents, runStream.events]);

  function updateSelectedRun(run: PlatformRun) {
    setRuns(prev => prev.map(item => item.id === run.id ? {...item, ...run} : item));
    setSelectedAgentId(run.agentId);
  }

  function openSelectedRunAudit() {
    if (!selectedRun) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'audit');
    next.set('resourceType', 'run');
    next.set('resourceId', selectedRun.id);
    setActiveTab('audit');
    setSearchParams(next, {replace: true});
  }

  function applyAuditFilters() {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'audit');
    ([
      ['resourceType', auditFilterDraft.resourceType.trim()],
      ['resourceId', auditFilterDraft.resourceId.trim()],
      ['action', auditFilterDraft.action.trim()],
      ['outcome', auditFilterDraft.outcome.trim()],
    ] as const).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setActiveTab('audit');
    setSearchParams(next, {replace: true});
  }

  function clearAuditFilters() {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'audit');
    ['resourceType', 'resourceId', 'action', 'outcome'].forEach(key => next.delete(key));
    setAuditFilterDraft({resourceType: '', resourceId: '', action: '', outcome: ''});
    setActiveTab('audit');
    setSearchParams(next, {replace: true});
  }

  async function handleExportAuditCsv() {
    setAuditExporting(true);
    setAuditActionMessage(null);
    setAuditError(null);
    try {
      const exported = await exportAuditEventsCsv({
        action: auditAction ?? undefined,
        resourceType: auditResourceType ?? undefined,
        resourceId: auditResourceId ?? undefined,
        outcome: auditOutcome ?? undefined,
      });
      const url = window.URL.createObjectURL(exported.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exported.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setAuditActionMessage('审计事件 CSV 已开始下载，导出动作已写入审计链。');
      void loadAuditEvents();
    } catch (error) {
      setAuditError(formatApiErrorForDisplay(error, '导出审计事件失败，请稍后重试'));
    } finally {
      setAuditExporting(false);
    }
  }

  const handleCancelRun = async () => {
    if (!selectedRun || runActionSubmitting) return;
    setRunActionSubmitting(true);
    setRunActionError(null);
    setRunActionMessage(null);
    try {
      const cancelled = await cancelRun(selectedRun.id);
      updateSelectedRun({...selectedRun, ...cancelled});
      setRunActionMessage('运行已取消');
    } catch (error) {
      setRunActionError(formatApiErrorForDisplay(error, '取消运行失败'));
    } finally {
      setRunActionSubmitting(false);
    }
  };

  const handleRetryRun = async () => {
    if (!selectedRun || runActionSubmitting) return;
    const input = retryInput.trim();
    if (!input) {
      setRunActionError('运行输入不能为空');
      return;
    }
    setRunActionSubmitting(true);
    setRunActionError(null);
    setRunActionMessage(null);
    try {
      const run = await retryRun(selectedRun.id, {input});
      setRuns(prev => [run, ...prev]);
      setSelectedRunId(run.id);
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'runs');
      next.set('runId', run.id);
      setSearchParams(next, {replace: true});
      setRetryInput('');
      setRetryModalOpen(false);
      setRunActionMessage('受控运行已创建');
    } catch (error) {
      setRunActionError(formatApiErrorForDisplay(error, '重试运行失败'));
    } finally {
      setRunActionSubmitting(false);
    }
  };

  const openReviewModal = (mode: ReviewModalMode, review: PlatformHumanReview | null = null) => {
    setReviewModal({mode, review});
    setReviewReason('');
    setReviewActionError(null);
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) return;
    setReviewModal(null);
    setReviewReason('');
    setReviewActionError(null);
  };

  const confirmReviewAction = async () => {
    if (!reviewModal) return;
    const reason = reviewReason.trim();
    if (!reason) {
      setReviewActionError('请填写原因，复核动作必须留下可审计说明。');
      return;
    }

    setReviewSubmitting(true);
    setReviewActionError(null);
    try {
      if (reviewModal.mode === 'create') {
        if (!selectedRun) throw new Error('请先选择一条运行记录');
        await createHumanReview({
          runId: selectedRun.id,
          requestId: selectedRun.requestId,
          reviewType: 'run_result',
          subjectType: 'run',
          subjectId: selectedRun.id,
          title: '运行结果复核',
          reason,
          metadataSummary: {
            source: 'governance_console',
            agentId: selectedRun.agentId,
            agentVersionId: selectedRun.agentVersionId,
            status: selectedRun.status,
          },
        });
        setActiveTab('reviews');
      } else {
        if (!reviewModal.review) throw new Error('复核项不存在');
        const decision = reviewModal.mode === 'approve'
          ? 'approve'
          : reviewModal.mode === 'reject'
            ? 'reject'
            : 'waive';
        await decideHumanReview(reviewModal.review.id, {
          decision,
          reason,
          decisionSummary: {
            source: 'governance_console',
            previousStatus: reviewModal.review.status,
          },
        });
      }

      await Promise.all([loadHumanReviews(), loadAuditEvents()]);
      setReviewModal(null);
      setReviewReason('');
    } catch (error) {
      setReviewActionError(formatApiErrorForDisplay(error, '提交失败'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-container-low">
      <header className="sticky top-0 z-30 border-b border-surface-container-highest bg-surface-container-low/90 px-8 py-5 backdrop-blur-md">
        <p className="mb-2 text-[11px] font-medium tracking-[0.12px] text-stone">AgentOps 治理</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px] font-medium leading-tight text-charcoal">治理台</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-olive">
              查看并处理平台事实：运行、成本、审计、智能体版本、策略决策、成果、证据与人工复核。
            </p>
          </div>
          <div className="rounded-xl border border-border-cream bg-ivory px-4 py-3 text-[12px] text-stone">
            复核、批准、退回和豁免都会写入审计事件。
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-8">
        <div className="flex flex-wrap gap-2 rounded-xl border border-border-cream bg-ivory p-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
                  isActive ? 'bg-charcoal text-ivory' : 'text-stone hover:bg-surface-container-high hover:text-charcoal'
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'runs' && (
          <section className="rounded-xl border border-border-cream bg-ivory">
            <div className="flex items-center justify-between border-b border-border-cream px-5 py-4">
              <div>
                <h2 className="font-serif text-[22px] font-medium text-charcoal">运行记录</h2>
                <p className="mt-1 text-[12px] text-stone">选择一条运行记录后，可在智能体版本中查看对应模板快照。</p>
              </div>
              <span className="text-[12px] text-stone">{runs.length} 条</span>
            </div>
            <div className="p-5">
              {runsError ? <ErrorState message={runsError} /> : runsLoading ? (
                <EmptyState icon="progress_activity" title="正在加载运行记录" description="正在从平台事实 API 获取最近运行。" />
              ) : runs.length === 0 ? (
                <EmptyState icon="history" title="暂无运行记录" description="当智能体产生受控执行后，运行事实会显示在这里。" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-[12px]">
                    <thead className="text-stone">
                      <tr className="border-b border-border-cream">
                        <th className="px-3 py-2 font-medium">开始时间</th>
                        <th className="px-3 py-2 font-medium">状态</th>
                        <th className="px-3 py-2 font-medium">智能体</th>
                        <th className="px-3 py-2 font-medium">版本</th>
                        <th className="px-3 py-2 font-medium">线程</th>
                        <th className="px-3 py-2 font-medium">模型</th>
                        <th className="px-3 py-2 font-medium">耗时</th>
                        <th className="px-3 py-2 font-medium">用量</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-cream text-charcoal">
                      {runs.map(run => {
                        const isSelected = selectedRunId === run.id;
                        return (
                          <tr
                            key={run.id}
                            onClick={() => {
                              setSelectedAgentId(run.agentId);
                              setSelectedRunId(run.id);
                              const next = new URLSearchParams(searchParams);
                              next.set('tab', 'runs');
                              next.set('runId', run.id);
                              setSearchParams(next, {replace: true});
                            }}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-surface-container-high' : 'hover:bg-surface-container'}`}
                          >
                            <td className="px-3 py-3">{formatDate(run.startedAt)}</td>
                            <td className="px-3 py-3">{statusLabel(run.status)}</td>
                            <td className="px-3 py-3 font-medium">{shortId(run.agentId)}</td>
                            <td className="px-3 py-3">{shortId(run.agentVersionId)}</td>
                            <td className="px-3 py-3">{shortId(run.threadId)}</td>
                            <td className="px-3 py-3">{run.model || '未记录'}</td>
                            <td className="px-3 py-3">{formatDuration(run)}</td>
                            <td className="px-3 py-3">{formatTokens(run)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'runs' && selectedRun && (
          <section className="rounded-xl border border-border-cream bg-ivory">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-cream px-5 py-4">
              <div>
                <h2 className="font-serif text-[22px] font-medium text-charcoal">运行详情</h2>
                <p className="mt-1 text-[12px] text-stone">
                  请求 {shortId(selectedRun.requestId)} · 发起人 {shortId(selectedRun.userId)} · 运行 {shortId(selectedRun.id)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedRun.status === 'running' && (
                  <button
                    type="button"
                    onClick={handleCancelRun}
                    disabled={runActionSubmitting}
                    className="rounded-lg bg-charcoal px-3 py-2 text-[12px] font-medium text-ivory hover:bg-[#30302e] disabled:opacity-60"
                  >
                    取消运行
                  </button>
                )}
                {(selectedRun.status === 'failed' || selectedRun.status === 'cancelled') && (
                  <button
                    type="button"
                    onClick={() => {
                      setRetryModalOpen(true);
                      setRunActionError(null);
                    }}
                    className="rounded-lg border border-border-cream px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container"
                  >
                    重试运行
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openReviewModal('create')}
                  className="rounded-lg bg-charcoal px-3 py-2 text-[12px] font-medium text-ivory hover:bg-[#30302e]"
                >
                  提交复核
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAgentId(selectedRun.agentId);
                    setActiveTab('versions');
                  }}
                  className="rounded-lg border border-border-cream px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container"
                >
                  查看智能体版本
                </button>
              </div>
            </div>
            {(runActionMessage || runActionError) && (
              <div className={`mx-5 mt-4 whitespace-pre-line rounded-xl border px-4 py-3 text-[13px] ${
                runActionError ? 'border-error/20 bg-ivory text-error' : 'border-border-cream bg-surface-container-low text-olive'
              }`}>
                {runActionError ?? runActionMessage}
              </div>
            )}
            <div className="border-b border-border-cream p-5">
              <RunObservabilityPanel
                observability={runObservability}
                loading={runObservabilityLoading}
                error={runObservabilityError}
                onOpenAudit={openSelectedRunAudit}
              />
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[14px] font-medium text-charcoal">运行事件时间线</h3>
                  <div className="flex items-center gap-2 text-[12px] text-stone">
                    {runStreamEnabled && (
                      <RunStreamStatusBadge
                        status={runStream.status}
                        endReason={runStream.endReason}
                      />
                    )}
                    <span>{mergedRunEvents.length} 条</span>
                  </div>
                </div>
                {runFactsError ? <ErrorState message={runFactsError} /> : runFactsLoading ? (
                  <EmptyState icon="progress_activity" title="正在加载运行事实" description="正在读取该运行的事件时间线和工具调用。" />
                ) : mergedRunEvents.length === 0 ? (
                  <EmptyState icon="timeline" title="暂无运行事件" description="后续受控运行会在这里沉淀可解释时间线。" />
                ) : (
                  <div className="divide-y divide-border-cream rounded-lg border border-border-cream">
                    {mergedRunEvents.map(event => (
                      <div key={event.id} className="grid grid-cols-[72px_1fr] gap-3 px-3 py-3 text-[12px]">
                        <span className="text-stone">#{event.sequence}</span>
                        <div>
                          <p className="font-medium text-charcoal">{formatEventType(event.eventType)}</p>
                          <p className="mt-1 text-stone">{formatDate(event.occurredAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-charcoal">工具调用</h3>
                  <span className="text-[12px] text-stone">{toolInvocations.length} 次</span>
                </div>
                {runFactsError ? <ErrorState message={runFactsError} /> : runFactsLoading ? (
                  <EmptyState icon="progress_activity" title="正在加载工具调用" description="正在读取工具调用摘要。" />
                ) : toolInvocations.length === 0 ? (
                  <EmptyState icon="build" title="暂无工具调用" description="该运行没有产生可展示的工具调用事实。" />
                ) : (
                  <div className="divide-y divide-border-cream rounded-lg border border-border-cream">
                    {toolInvocations.map(tool => (
                      <div key={tool.id} className="px-3 py-3 text-[12px]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-charcoal">{tool.toolName}</p>
                          <span className="text-stone">{statusLabel(tool.status)}</span>
                        </div>
                        <p className="mt-1 text-stone">
                          {shortId(tool.toolUseId)} · {formatDate(tool.startedAt)} - {formatDate(tool.completedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-5 border-t border-border-cream p-5 lg:grid-cols-[1fr_1fr]">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-charcoal">成果文件</h3>
                  <span className="text-[12px] text-stone">{artifacts.length} 个</span>
                </div>
                {runFactsError ? <ErrorState message={runFactsError} /> : runFactsLoading ? (
                  <EmptyState icon="progress_activity" title="正在加载成果文件" description="正在读取该运行生成的成果元数据。" />
                ) : artifacts.length === 0 ? (
                  <EmptyState icon="draft" title="暂无成果文件" description="该运行没有产生可治理的成果文件元数据。" />
                ) : (
                  <div className="divide-y divide-border-cream rounded-lg border border-border-cream">
                    {artifacts.map(artifact => (
                      <div key={artifact.id} className="px-3 py-3 text-[12px]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-charcoal">{artifact.title}</p>
                          <span className="text-stone">{artifactTypeLabel(artifact.artifactType)}</span>
                        </div>
                        <p className="mt-1 text-stone">
                          {sourceTypeLabel(artifact.sourceType)} · hash {shortId(artifact.sha256)} · {formatDate(artifact.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-charcoal">证据元数据</h3>
                  <span className="text-[12px] text-stone">{evidenceArtifacts.length} 条</span>
                </div>
                {runFactsError ? <ErrorState message={runFactsError} /> : runFactsLoading ? (
                  <EmptyState icon="progress_activity" title="正在加载证据元数据" description="正在读取该运行沉淀的证据索引。" />
                ) : evidenceArtifacts.length === 0 ? (
                  <EmptyState icon="fact_check" title="暂无证据元数据" description="证据只记录来源、hash 和关联关系，不保存正文内容。" />
                ) : (
                  <div className="divide-y divide-border-cream rounded-lg border border-border-cream">
                    {evidenceArtifacts.map(evidence => (
                      <div key={evidence.id} className="px-3 py-3 text-[12px]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-charcoal">{evidenceTypeLabel(evidence.evidenceType)}</p>
                          <span className="text-stone">{evidence.sourceSystem || '未记录来源系统'}</span>
                        </div>
                        <p className="mt-1 text-stone">
                          hash {shortId(evidence.sourceHash)} · 捕获 {formatDate(evidence.capturedAt ?? evidence.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'costs' && (
          <section className="rounded-xl border border-border-cream bg-ivory">
            <div className="flex items-center justify-between border-b border-border-cream px-5 py-4">
              <div>
                <h2 className="font-serif text-[22px] font-medium text-charcoal">成本概览</h2>
                <p className="mt-1 text-[12px] text-stone">基于计费记录聚合租户级用量；当前不承诺单次 Run 精确成本归因。</p>
              </div>
              <span className="text-[12px] text-stone">{costSummary ? `更新于 ${formatDate(costSummary.updatedAt)}` : '未加载'}</span>
            </div>
            <div className="p-5">
              {costError ? <ErrorState message={costError} /> : costLoading ? (
                <EmptyState icon="progress_activity" title="正在加载成本概览" description="正在读取租户用量、费用估算与配额状态。" />
              ) : !costSummary ? (
                <EmptyState icon="account_balance_wallet" title="暂无成本数据" description="当受控运行产生 token 用量后，成本概览会显示在这里。" />
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard label="累计 token" value={formatTokenNumber(costSummary.totalTokens)} helper={`输入 ${formatTokenNumber(costSummary.totalInputTokens)} / 输出 ${formatTokenNumber(costSummary.totalOutputTokens)}`} />
                    <MetricCard label="估算费用" value={formatCostCents(costSummary.totalCostCents)} helper={`${costSummary.recordCount} 条计费记录`} />
                    <MetricCard label="今日配额使用" value={formatTokenNumber(costSummary.quotaUsage.totalTokensToday)} helper={`每日上限 ${formatTokenNumber(costSummary.quota.maxTokensPerDay)} token`} />
                    <MetricCard label="运行并发" value={`${costSummary.quotaUsage.runningSessions}/${costSummary.quota.maxConcurrentSessions}`} helper="基于当前 running thread 计数" />
                  </div>

                  {quotaError ? (
                    <ErrorState message={quotaError} />
                  ) : quotaLoading ? (
                    <EmptyState icon="progress_activity" title="正在读取租户配额状态" description="正在确认当前租户是否允许发起新的受控运行。" />
                  ) : quotaStatus ? (
                    <QuotaStatusPanel status={quotaStatus} />
                  ) : null}

                  <div className="overflow-x-auto rounded-lg border border-border-cream">
                    <table className="w-full min-w-[720px] text-left text-[12px]">
                      <thead className="text-stone">
                        <tr className="border-b border-border-cream">
                          <th className="px-3 py-2 font-medium">模型</th>
                          <th className="px-3 py-2 font-medium">输入 token</th>
                          <th className="px-3 py-2 font-medium">输出 token</th>
                          <th className="px-3 py-2 font-medium">总 token</th>
                          <th className="px-3 py-2 font-medium">估算费用</th>
                          <th className="px-3 py-2 font-medium">记录数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-cream text-charcoal">
                        {costSummary.byModel.length === 0 ? (
                          <tr>
                            <td className="px-3 py-5 text-center text-stone" colSpan={6}>暂无模型用量记录</td>
                          </tr>
                        ) : costSummary.byModel.map(row => (
                          <tr key={row.model ?? 'unknown'} className="hover:bg-surface-container">
                            <td className="px-3 py-3 font-medium">{row.model || '未记录'}</td>
                            <td className="px-3 py-3">{formatTokenNumber(row.inputTokens)}</td>
                            <td className="px-3 py-3">{formatTokenNumber(row.outputTokens)}</td>
                            <td className="px-3 py-3">{formatTokenNumber(row.totalTokens)}</td>
                            <td className="px-3 py-3">{formatCostCents(row.costCents)}</td>
                            <td className="px-3 py-3">{row.recordCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'reviews' && (
          <section className="rounded-xl border border-border-cream bg-ivory">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-cream px-5 py-4">
              <div>
                <h2 className="font-serif text-[22px] font-medium text-charcoal">复核队列</h2>
                <p className="mt-1 text-[12px] text-stone">
                  人工复核是受控运行的责任事实；批准、退回和豁免都会进入审计链。
                </p>
              </div>
              <span className="text-[12px] text-stone">{humanReviews.length} 条</span>
            </div>
            <div className="p-5">
              {reviewsError ? <ErrorState message={reviewsError} /> : reviewsLoading ? (
                <EmptyState icon="progress_activity" title="正在加载复核队列" description="正在读取待复核、已批准、已退回和已豁免记录。" />
              ) : humanReviews.length === 0 ? (
                <EmptyState icon="approval" title="暂无复核项" description="当运行结果、策略决策、成果或证据需要人工确认时，复核项会显示在这里。" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-left text-[12px]">
                    <thead className="text-stone">
                      <tr className="border-b border-border-cream">
                        <th className="px-3 py-2 font-medium">提交时间</th>
                        <th className="px-3 py-2 font-medium">状态</th>
                        <th className="px-3 py-2 font-medium">复核对象</th>
                        <th className="px-3 py-2 font-medium">触发原因</th>
                        <th className="px-3 py-2 font-medium">运行</th>
                        <th className="px-3 py-2 font-medium">请求 ID</th>
                        <th className="px-3 py-2 font-medium">提交人</th>
                        <th className="px-3 py-2 font-medium">处理人</th>
                        <th className="px-3 py-2 font-medium">动作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-cream text-charcoal">
                      {humanReviews.map(review => (
                        <tr key={review.id} className="hover:bg-surface-container">
                          <td className="px-3 py-3">{formatDate(review.createdAt)}</td>
                          <td className="px-3 py-3 font-medium">{reviewStatusLabel(review.status)}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{reviewTypeLabel(review.reviewType)}</div>
                            <div className="mt-1 text-stone">
                              {review.subjectType} / {shortId(review.subjectId)}
                            </div>
                          </td>
                          <td className="max-w-[220px] px-3 py-3 leading-relaxed">{review.reason}</td>
                          <td className="px-3 py-3">{shortId(review.runId)}</td>
                          <td className="px-3 py-3">{shortId(review.requestId)}</td>
                          <td className="px-3 py-3">{shortId(review.requestedBy)}</td>
                          <td className="px-3 py-3">
                            <div>{shortId(review.decidedBy)}</div>
                            <div className="mt-1 text-stone">{reviewDecisionLabel(review.decision)}</div>
                          </td>
                          <td className="px-3 py-3">
                            {review.status === 'pending' ? (
                              <div className="flex min-w-[220px] flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openReviewModal('approve', review)}
                                  className="rounded-lg border border-border-cream px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container"
                                >
                                  批准
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReviewModal('reject', review)}
                                  className="rounded-lg border border-border-cream px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container"
                                >
                                  退回处理
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReviewModal('waive', review)}
                                  className="rounded-lg border border-border-cream px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container"
                                >
                                  批准豁免
                                </button>
                              </div>
                            ) : (
                              <span className="text-stone">{formatDate(review.decidedAt)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'audit' && (
          <section className="rounded-xl border border-border-cream bg-ivory">
            <div className="flex items-center justify-between border-b border-border-cream px-5 py-4">
              <div>
                <h2 className="font-serif text-[22px] font-medium text-charcoal">审计事件</h2>
                {auditSummary ? (
                  <p className="mt-1 text-[12px] text-stone">{auditSummary}</p>
                ) : (
                  <p className="mt-1 text-[12px] text-stone">查看关键动作留下的 append-only 责任事实。</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-stone">{auditEvents.length} 条</span>
                <button
                  type="button"
                  onClick={handleExportAuditCsv}
                  disabled={auditExporting}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-cream bg-ivory px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  {auditExporting ? '正在导出' : '导出 CSV'}
                </button>
              </div>
            </div>
            <div className="p-5">
              <div className="mb-5 rounded-xl border border-border-cream bg-surface-container-low p-4">
                <div className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_160px_auto] lg:items-end">
                  <label className="text-[12px] font-medium text-stone">
                    资源类型
                    <select
                      value={auditFilterDraft.resourceType}
                      onChange={event => setAuditFilterDraft(current => ({...current, resourceType: event.target.value}))}
                      className="mt-1 w-full rounded-lg border border-border-cream bg-ivory px-3 py-2 text-[13px] font-normal text-charcoal focus:border-[#3898ec] focus:outline-none"
                    >
                      {auditResourceTypeOptions.map(option => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[12px] font-medium text-stone">
                    资源 ID
                    <input
                      value={auditFilterDraft.resourceId}
                      onChange={event => setAuditFilterDraft(current => ({...current, resourceId: event.target.value}))}
                      placeholder="输入运行、材料或复核 ID"
                      className="mt-1 w-full rounded-lg border border-border-cream bg-ivory px-3 py-2 text-[13px] font-normal text-charcoal placeholder:text-stone focus:border-[#3898ec] focus:outline-none"
                    />
                  </label>
                  <label className="text-[12px] font-medium text-stone">
                    动作
                    <input
                      value={auditFilterDraft.action}
                      onChange={event => setAuditFilterDraft(current => ({...current, action: event.target.value}))}
                      placeholder="例如 agent_document.uploaded"
                      className="mt-1 w-full rounded-lg border border-border-cream bg-ivory px-3 py-2 text-[13px] font-normal text-charcoal placeholder:text-stone focus:border-[#3898ec] focus:outline-none"
                    />
                  </label>
                  <label className="text-[12px] font-medium text-stone">
                    结果
                    <select
                      value={auditFilterDraft.outcome}
                      onChange={event => setAuditFilterDraft(current => ({...current, outcome: event.target.value}))}
                      className="mt-1 w-full rounded-lg border border-border-cream bg-ivory px-3 py-2 text-[13px] font-normal text-charcoal focus:border-[#3898ec] focus:outline-none"
                    >
                      {auditOutcomeOptions.map(option => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={applyAuditFilters}
                      className="rounded-lg bg-charcoal px-3 py-2 text-[12px] font-medium text-ivory hover:bg-[#30302e]"
                    >
                      应用筛选
                    </button>
                    <button
                      type="button"
                      onClick={clearAuditFilters}
                      className="rounded-lg border border-border-cream bg-ivory px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container"
                    >
                      清空筛选
                    </button>
                  </div>
                </div>
                {auditActionMessage ? (
                  <p className="mt-3 text-[12px] text-stone">{auditActionMessage}</p>
                ) : null}
              </div>
              {auditError ? <ErrorState message={auditError} /> : auditLoading ? (
                <EmptyState icon="progress_activity" title="正在加载审计事件" description="正在读取企业治理需要的 append-only 事实。" />
              ) : auditEvents.length === 0 ? (
                <EmptyState
                  icon="policy"
                  title={auditHasFilters ? '没有匹配的审计事件' : '暂无审计事件'}
                  description={auditHasFilters ? '请调整资源、动作或结果条件后重新查询。' : '运行、复核、策略和版本动作留下的责任事实会显示在这里。'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-[12px]">
                    <thead className="text-stone">
                      <tr className="border-b border-border-cream">
                        <th className="px-3 py-2 font-medium">时间</th>
                        <th className="px-3 py-2 font-medium">动作</th>
                        <th className="px-3 py-2 font-medium">资源类型</th>
                        <th className="px-3 py-2 font-medium">资源 ID</th>
                        <th className="px-3 py-2 font-medium">结果</th>
                        <th className="px-3 py-2 font-medium">请求 ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-cream text-charcoal">
                      {auditEvents.map(event => (
                        <tr key={event.id} className="hover:bg-surface-container">
                          <td className="px-3 py-3">{formatDate(event.createdAt)}</td>
                          <td className="px-3 py-3 font-medium">{formatEventType(event.action)}</td>
                          <td className="px-3 py-3">{auditResourceTypeLabel(event.resourceType)}</td>
                          <td className="px-3 py-3">{shortId(event.resourceId)}</td>
                          <td className="px-3 py-3">{statusLabel(event.outcome)}</td>
                          <td className="px-3 py-3">{shortId(event.requestId)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'policy' && (
          <section className="rounded-xl border border-border-cream bg-ivory">
            <div className="flex items-center justify-between border-b border-border-cream px-5 py-4">
              <div>
                <h2 className="font-serif text-[22px] font-medium text-charcoal">策略决策</h2>
                <p className="mt-1 text-[12px] text-stone">查看模型、工具、配额和数据边界的允许、拒绝与复核要求。</p>
              </div>
              <span className="text-[12px] text-stone">{policyDecisions.length} 条</span>
            </div>
            <div className="p-5">
              {policyError ? <ErrorState message={policyError} /> : policyLoading ? (
                <EmptyState icon="progress_activity" title="正在加载策略决策" description="正在读取平台策略预检和治理判断。" />
              ) : policyDecisions.length === 0 ? (
                <EmptyState icon="gavel" title="暂无策略决策" description="当运行触发模型、工具、配额或数据边界判断后，策略事实会显示在这里。" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-[12px]">
                    <thead className="text-stone">
                      <tr className="border-b border-border-cream">
                        <th className="px-3 py-2 font-medium">时间</th>
                        <th className="px-3 py-2 font-medium">策略类型</th>
                        <th className="px-3 py-2 font-medium">对象</th>
                        <th className="px-3 py-2 font-medium">决策</th>
                        <th className="px-3 py-2 font-medium">原因</th>
                        <th className="px-3 py-2 font-medium">运行</th>
                        <th className="px-3 py-2 font-medium">请求 ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-cream text-charcoal">
                      {policyDecisions.map(decision => (
                        <tr key={decision.id} className="hover:bg-surface-container">
                          <td className="px-3 py-3">{formatDate(decision.createdAt)}</td>
                          <td className="px-3 py-3">{policyTypeLabel(decision.policyType)}</td>
                          <td className="px-3 py-3">
                            {decision.subjectType} / {shortId(decision.subjectId)}
                          </td>
                          <td className="px-3 py-3 font-medium">{policyDecisionLabel(decision.decision)}</td>
                          <td className="px-3 py-3">{decision.reason}</td>
                          <td className="px-3 py-3">{shortId(decision.runId)}</td>
                          <td className="px-3 py-3">{shortId(decision.requestId)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'versions' && (
          <section className="rounded-xl border border-border-cream bg-ivory">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-cream px-5 py-4">
              <div>
                <h2 className="font-serif text-[22px] font-medium text-charcoal">智能体版本</h2>
                <p className="mt-1 text-[12px] text-stone">
                  {selectedAgentId ? `当前智能体：${shortId(selectedAgentId)}` : '请先从运行记录选择一个智能体。'}
                </p>
              </div>
              {selectedRun && <span className="text-[12px] text-stone">来源运行：{shortId(selectedRun.id)}</span>}
            </div>
            <div className="p-5">
              {!selectedAgentId ? (
                <EmptyState icon="touch_app" title="请选择智能体" description="打开运行记录，点击任意运行行即可加载该智能体的版本快照。" />
              ) : versionsError ? <ErrorState message={versionsError} /> : versionsLoading ? (
                <EmptyState icon="progress_activity" title="正在加载智能体版本" description="正在读取该智能体的不可变配置快照。" />
              ) : versions.length === 0 ? (
                <EmptyState icon="difference" title="暂无智能体版本" description="该智能体还没有可展示的版本快照，后续生产执行会沉淀版本事实。" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[12px]">
                    <thead className="text-stone">
                      <tr className="border-b border-border-cream">
                        <th className="px-3 py-2 font-medium">版本</th>
                        <th className="px-3 py-2 font-medium">名称</th>
                        <th className="px-3 py-2 font-medium">模型</th>
                        <th className="px-3 py-2 font-medium">工具/技能</th>
                        <th className="px-3 py-2 font-medium">创建时间</th>
                        <th className="px-3 py-2 font-medium">创建人</th>
                        <th className="px-3 py-2 font-medium">版本 hash</th>
                        <th className="px-3 py-2 font-medium">版本 ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-cream text-charcoal">
                      {versions.map(version => (
                        <tr key={version.id} className="hover:bg-surface-container">
                          <td className="px-3 py-3 font-medium">v{version.version}</td>
                          <td className="px-3 py-3">{snapshotName(version)}</td>
                          <td className="px-3 py-3">{snapshotModel(version)}</td>
                          <td className="px-3 py-3">
                            {version.snapshotSummary.toolCount} 工具 / {version.snapshotSummary.skillCount} 技能
                          </td>
                          <td className="px-3 py-3">{formatDate(version.createdAt)}</td>
                          <td className="px-3 py-3">{shortId(version.createdBy)}</td>
                          <td className="px-3 py-3">{shortHash(version.versionHash)}</td>
                          <td className="px-3 py-3">{shortId(version.id)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      {reviewModal && (
        <ReviewModal
          mode={reviewModal.mode}
          review={reviewModal.review}
          selectedRun={selectedRun}
          reason={reviewReason}
          error={reviewActionError}
          submitting={reviewSubmitting}
          onReasonChange={setReviewReason}
          onCancel={closeReviewModal}
          onConfirm={confirmReviewAction}
        />
      )}
      {retryModalOpen && selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 px-4">
          <div className="w-full max-w-[520px] rounded-xl border border-border-cream bg-ivory p-5 shadow-[0_0_0_1px_rgba(232,230,220,0.9)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-[24px] font-medium leading-tight text-charcoal">重试运行</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-stone">
                  将创建新的受控运行，并关联原运行 {shortId(selectedRun.id)}。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRetryModalOpen(false)}
                className="rounded-lg border border-border-cream px-2 py-1 text-[12px] text-stone hover:bg-surface-container"
              >
                关闭
              </button>
            </div>

            <label className="mt-4 block text-[12px] font-medium text-charcoal" htmlFor="retry-run-input">
              运行输入
            </label>
            <textarea
              id="retry-run-input"
              value={retryInput}
              onChange={event => setRetryInput(event.target.value)}
              className="mt-2 min-h-[120px] w-full rounded-xl border border-border-cream bg-ivory px-3 py-3 text-[13px] leading-relaxed text-charcoal outline-none focus:border-[#3898ec]"
              placeholder="说明这次重试要解决的问题和期望输出。"
            />
            {runActionError && <p className="mt-2 whitespace-pre-line text-[12px] text-error">{runActionError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRetryModalOpen(false)}
                disabled={runActionSubmitting}
                className="rounded-lg border border-border-cream px-4 py-2 text-[13px] font-medium text-charcoal hover:bg-surface-container disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleRetryRun}
                disabled={runActionSubmitting}
                className="rounded-lg bg-charcoal px-4 py-2 text-[13px] font-medium text-ivory hover:bg-[#30302e] disabled:opacity-60"
              >
                {runActionSubmitting ? '正在重试' : '确认重试'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
