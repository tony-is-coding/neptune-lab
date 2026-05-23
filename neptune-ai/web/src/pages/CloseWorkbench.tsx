import {useCallback, useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {
  createCloseWorkspace,
  decideCloseReview,
  generateCloseChecks,
  generateCloseReport,
  getCloseOverview,
  getCloseReportDetail,
  importCloseCsvEvidence,
  listCloseChecklist,
  listCloseEvidenceArtifacts,
  listCloseFindings,
  listCloseReports,
  listCloseWorkspaces,
  submitFindingReview,
  type AccountingPeriod,
  type CloseChecklistItem,
  type CloseEvidenceArtifact,
  type CloseFinding,
  type CloseReport,
  type CloseReportDetail,
  type CloseWorkspace,
} from '../api/closing';

type CloseTab = 'overview' | 'checklist' | 'findings' | 'evidence' | 'reviews' | 'report';

const tabs: Array<{id: CloseTab; label: string; icon: string}> = [
  {id: 'overview', label: '期间总览', icon: 'dashboard'},
  {id: 'checklist', label: '检查清单', icon: 'checklist'},
  {id: 'findings', label: '异常发现', icon: 'warning'},
  {id: 'evidence', label: '证据中心', icon: 'fact_check'},
  {id: 'reviews', label: '复核队列', icon: 'approval'},
  {id: 'report', label: '关账报告', icon: 'summarize'},
];

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

function shortId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '无';
  const text = String(value);
  return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function actorLabel(value: string | null | undefined) {
  if (!value) return '未记录';
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value) ? shortId(value) : value;
}

function statusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    active: '运行中',
    open: '待检查',
    checking: '检查中',
    review_pending: '待复核',
    approved: '已批准',
    closed: '已关账',
    pending: '待检查',
    passed: '通过',
    failed: '发现异常',
    waived: '已豁免',
    generated: '已生成',
    open_finding: '待处理',
  };
  return value ? labels[value] ?? value : '未记录';
}

function reviewStatusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: '待复核',
    approved: '已批准',
    rejected: '已退回',
    waived: '已豁免',
  };
  return value ? labels[value] ?? statusLabel(value) : '未提交';
}

function severityLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    blocking: '阻塞',
    warning: '提示',
    info: '提示',
  };
  return value ? labels[value] ?? value : '未记录';
}

function evidenceTypeLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    source_file: '源文件',
    connector_snapshot: '连接器快照',
    generated_extract: '生成摘录',
    runtime_observation: '运行观察',
    other: '其他',
  };
  return value ? labels[value] ?? value : '未记录';
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return '未记录';
}

function auditActionLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    'closing.report_snapshot.generated': '关账报告生成',
    'closing.checks.generated': '关账检查生成',
    'closing.finding.review_submitted': '异常提交复核',
    'human_review.decided': '复核决策',
  };
  return value ? labels[value] ?? value : '未记录';
}

function EmptyState({icon, title, description}: {icon: string; title: string; description: string}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-cream bg-ivory px-6 py-12 text-center">
      <span className="material-symbols-outlined mb-3 text-[32px] text-stone">{icon}</span>
      <p className="text-[14px] font-medium text-charcoal">{title}</p>
      <p className="mt-1 max-w-[440px] text-[12px] leading-relaxed text-stone">{description}</p>
    </div>
  );
}

function ErrorState({message}: {message: string}) {
  return (
    <div className="rounded-xl border border-error/20 bg-ivory px-4 py-3 text-[13px] text-error">
      加载失败：{message}
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

function governanceRunUrl(runId: string) {
  return `/governance?tab=runs&runId=${encodeURIComponent(runId)}`;
}

function governanceRunAuditUrl(runId: string) {
  return `/governance?tab=audit&resourceType=run&resourceId=${encodeURIComponent(runId)}`;
}

function TraceLink({to, icon, children}: {to: string; icon: string; children: ReactNode}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-cream px-3 py-1.5 text-[12px] font-medium text-charcoal hover:bg-surface-container"
    >
      <span className="material-symbols-outlined text-[15px]">{icon}</span>
      {children}
    </Link>
  );
}

function FactChainPanel({
  checklist,
  findings,
  reports,
}: {
  checklist: CloseChecklistItem[];
  findings: CloseFinding[];
  reports: CloseReport[];
}) {
  const runIds = useMemo(() => {
    const ids = new Set<string>();
    checklist.forEach(item => {
      if (item.runId) ids.add(item.runId);
    });
    findings.forEach(finding => {
      if (finding.runId) ids.add(finding.runId);
    });
    reports.forEach(report => report.runIds.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [checklist, findings, reports]);
  const evidenceIds = useMemo(() => {
    const ids = new Set<string>();
    findings.forEach(finding => finding.evidenceArtifactIds.forEach(id => ids.add(id)));
    reports.forEach(report => report.evidenceArtifactIds.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [findings, reports]);
  const reviewIds = useMemo(() => {
    const ids = new Set<string>();
    findings.forEach(finding => {
      if (finding.humanReviewId) ids.add(finding.humanReviewId);
    });
    reports.forEach(report => report.humanReviewIds.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [findings, reports]);
  const auditEventIds = useMemo(() => {
    const ids = new Set<number>();
    reports.forEach(report => report.auditEventIds.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [reports]);

  if (runIds.length === 0 && evidenceIds.length === 0 && findings.length === 0 && reports.length === 0) {
    return (
      <section className="rounded-xl border border-border-cream bg-ivory p-5">
        <EmptyState
          icon="account_tree"
          title="暂无事实链"
          description="发起关账检查后，系统会把运行、证据、异常、复核和审计记录串成可追溯链路。"
        />
      </section>
    );
  }

  const firstRunId = runIds[0] ?? null;

  return (
    <section className="rounded-xl border border-border-cream bg-ivory p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[22px] font-medium text-charcoal">本期受控运行事实链</h2>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-stone">
            从关账检查运行开始，串联证据、异常、复核、审计事件和报告快照；这里只展示来源、状态、hash 和关联关系，不展示未授权原文。
          </p>
        </div>
        {firstRunId && (
          <div className="flex flex-wrap gap-2">
            <TraceLink to={governanceRunUrl(firstRunId)} icon="travel_explore">查看运行追踪</TraceLink>
            <TraceLink to={governanceRunAuditUrl(firstRunId)} icon="policy">查看审计事件</TraceLink>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <FactChainStep icon="play_circle" title="关账检查运行" value={`${runIds.length} 次`} helper={firstRunId ? `运行 ${shortId(firstRunId)}` : '未关联运行'} />
        <FactChainStep icon="fact_check" title="证据链" value={`${evidenceIds.length} 条`} helper="来源与 hash" />
        <FactChainStep icon="warning" title="异常发现" value={`${findings.length} 个`} helper={`${findings.filter(item => item.severity === 'blocking').length} 个阻塞`} />
        <FactChainStep icon="approval" title="复核与审计" value={`${reviewIds.length} 项`} helper={`${auditEventIds.length} 条审计`} />
        <FactChainStep icon="summarize" title="报告依据" value={`${reports.length} 份`} helper={reports[0] ? `快照 ${shortId(reports[0].snapshotHash)}` : '未生成'} />
        <FactChainStep icon="verified" title="关账责任" value={reports.length ? '已固化' : '待固化'} helper="报告生成后锁定依据" />
      </div>
    </section>
  );
}

function FactChainStep({icon, title, value, helper}: {icon: string; title: string; value: string; helper: string}) {
  return (
    <div className="rounded-lg border border-border-cream bg-surface-container-low px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[17px] text-stone">{icon}</span>
        <p className="text-[12px] font-medium text-charcoal">{title}</p>
      </div>
      <p className="mt-3 font-serif text-[22px] font-medium leading-tight text-charcoal">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-stone">{helper}</p>
    </div>
  );
}

function ReportDetailPanel({
  detail,
  checklist,
  loading,
  error,
}: {
  detail: CloseReportDetail | null;
  checklist: CloseChecklistItem[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="mt-5">
        <EmptyState icon="progress_activity" title="正在加载报告依据" description="正在读取报告绑定的运行、证据、异常、复核和审计事实。" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!detail) return null;

  const firstRun = detail.facts.runs[0] ?? null;
  const summary = detail.report.summary;
  const checklistById = new Map(checklist.map(item => [item.id, item]));
  const evidenceById = new Map(detail.facts.evidenceArtifacts.map(item => [item.id, item]));
  const reviewById = new Map(detail.facts.humanReviews.map(item => [item.id, item]));
  const auditByRequestId = new Map(detail.facts.auditEvents
    .filter(event => event.requestId)
    .map(event => [event.requestId!, event]));

  return (
    <section className="mt-5 rounded-xl border border-border-cream bg-surface-container-low p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-[22px] font-medium text-charcoal">报告依据详情</h3>
          <p className="mt-2 max-w-[760px] text-[13px] leading-relaxed text-stone">
            本报告基于以下运行、证据、异常处理、复核记录和审计事件生成；这里只展示可追溯元数据，不展示未授权证据正文。
          </p>
        </div>
        {firstRun && (
          <div className="flex flex-wrap gap-2">
            <TraceLink to={governanceRunUrl(firstRun.id)} icon="travel_explore">查看运行追踪</TraceLink>
            <TraceLink to={governanceRunAuditUrl(firstRun.id)} icon="policy">查看审计事件</TraceLink>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <FactChainStep icon="play_circle" title="运行" value={`${detail.facts.runs.length} 次`} helper={firstRun ? `运行 ${shortId(firstRun.id)}` : '未关联运行'} />
        <FactChainStep icon="fact_check" title="证据" value={`${detail.facts.evidenceArtifacts.length} 条`} helper="来源与 hash" />
        <FactChainStep icon="warning" title="异常" value={`${detail.facts.findings.length} 个`} helper={`${detail.facts.findings.filter(item => item.severity === 'blocking').length} 个阻塞`} />
        <FactChainStep icon="approval" title="复核" value={`${detail.facts.humanReviews.length} 项`} helper={`${detail.facts.humanReviews.filter(item => item.status === 'approved').length} 项已批准`} />
        <FactChainStep icon="policy" title="审计事件" value={`${detail.facts.auditEvents.length} 条`} helper={`报告 ${statusLabel(detail.report.status)}`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <FactList title="报告快照" emptyText="暂无快照摘要">
          <FactRow label="报告标题" value={detail.report.title} />
          <FactRow label="快照 hash" value={detail.report.snapshotHash} />
          <FactRow label="生成时间" value={formatDate(detail.report.generatedAt)} />
          <FactRow label="生成人" value={shortId(detail.report.generatedBy)} />
          <FactRow label="检查项数量" value={formatSummaryNumber(summary.totalChecks)} />
          <FactRow label="异常数量" value={formatSummaryNumber(summary.findingCount)} />
          <FactRow label="证据数量" value={formatSummaryNumber(summary.evidenceCount)} />
        </FactList>

        <FactList title="运行记录" emptyText="暂无关联运行">
          {detail.facts.runs.map(run => (
            <FactItem key={run.id} title={`运行 ${shortId(run.id)}`} meta={`${statusLabel(run.status)} · ${run.model ?? '未记录模型'} · token ${run.inputTokens + run.outputTokens}`}>
              <div className="mt-2 flex flex-wrap gap-2">
                <TraceLink to={governanceRunUrl(run.id)} icon="travel_explore">查看运行追踪</TraceLink>
                <TraceLink to={governanceRunAuditUrl(run.id)} icon="policy">查看审计事件</TraceLink>
              </div>
            </FactItem>
          ))}
        </FactList>

        <FactList title="证据清单" emptyText="暂无关联证据">
          {detail.facts.evidenceArtifacts.map(evidence => (
            <FactItem
              key={evidence.id}
              title={`${evidenceTypeLabel(evidence.evidenceType)} · ${evidence.sourceSystem ?? '未记录来源'}`}
              meta={`hash ${evidence.sourceHash} · 捕获 ${formatDate(evidence.capturedAt ?? evidence.createdAt)}`}
            />
          ))}
        </FactList>

        <FactList title="异常与处理依据" emptyText="暂无异常">
          {detail.facts.findings.map(finding => {
            const review = finding.humanReviewId ? reviewById.get(finding.humanReviewId) : undefined;
            const auditEvent = review?.requestId
              ? auditByRequestId.get(review.requestId) ?? detail.facts.auditEvents.find(event => event.action === 'closing.report_snapshot.generated')
              : detail.facts.auditEvents.find(event => event.action === 'closing.report_snapshot.generated');

            return (
              <FindingFactItem
                key={finding.id}
                finding={finding}
                checklistItem={checklistById.get(finding.checklistItemId)}
                evidences={finding.evidenceArtifactIds.map(id => evidenceById.get(id)).filter(Boolean) as CloseReportDetail['facts']['evidenceArtifacts']}
                review={review}
                auditEvent={auditEvent}
              />
            );
          })}
        </FactList>

        <FactList title="复核与审批记录" emptyText="暂无复核记录">
          {detail.facts.humanReviews.map(review => (
            <FactItem
              key={review.id}
              title={review.title}
              meta={`${reviewStatusLabel(review.status)} · 决策 ${reviewDecisionText(review.decision)} · 审批人 ${actorLabel(review.decidedBy)} · ${formatDate(review.decidedAt ?? review.createdAt)}`}
            >
              {review.decisionReason && (
                <p className="mt-2 text-[12px] leading-relaxed text-stone">决策原因：{review.decisionReason}</p>
              )}
              {review.requestId && (
                <p className="mt-1 text-[12px] leading-relaxed text-stone">请求 {review.requestId}</p>
              )}
            </FactItem>
          ))}
        </FactList>

        <FactList title="审计摘要" emptyText="暂无审计事件">
          {detail.facts.auditEvents.map(event => (
            <FactItem
              key={event.id}
              title={auditActionLabel(event.action)}
              meta={`${event.outcome === 'success' ? '成功' : event.outcome} · 对象 ${event.resourceType}/${shortId(event.resourceId)} · 请求 ${event.requestId ?? '未记录'}`}
            />
          ))}
        </FactList>
      </div>
    </section>
  );
}

function FindingFactItem({
  finding,
  checklistItem,
  evidences,
  review,
  auditEvent,
}: {
  finding: CloseFinding;
  checklistItem?: CloseChecklistItem;
  evidences: CloseReportDetail['facts']['evidenceArtifacts'];
  review?: CloseReportDetail['facts']['humanReviews'][number];
  auditEvent?: CloseReportDetail['facts']['auditEvents'][number];
}) {
  return (
    <FactItem
      title={finding.title}
      meta={`${severityLabel(finding.severity)} · ${statusLabel(finding.status)} · 控制项 ${checklistItem?.code ?? shortId(finding.checklistItemId)} · 证据 ${finding.evidenceCount} 条 · 复核 ${reviewStatusLabel(finding.reviewStatus)}`}
    >
      <p className="mt-2 text-[12px] leading-relaxed text-stone">{finding.summary}</p>
      {evidences.map(evidence => (
        <p key={evidence.id} className="mt-1 break-words text-[12px] leading-relaxed text-stone">
          证据 {evidence.sourceSystem ?? '未记录来源'} · hash {evidence.sourceHash}
        </p>
      ))}
      {review && (
        <p className="mt-1 text-[12px] leading-relaxed text-stone">
          决策 {reviewDecisionText(review.decision)} · 审批人 {actorLabel(review.decidedBy)} · {review.decisionReason ?? '未记录决策原因'}
        </p>
      )}
      {auditEvent && (
        <p className="mt-1 text-[12px] leading-relaxed text-stone">
          审计 {auditActionLabel(auditEvent.action)} · 请求 {auditEvent.requestId ?? '未记录'}
        </p>
      )}
    </FactItem>
  );
}

function formatSummaryNumber(value: unknown) {
  return typeof value === 'number' ? String(value) : '未记录';
}

function reviewDecisionText(value: string | null | undefined) {
  const labels: Record<string, string> = {
    approve: '批准',
    reject: '退回',
    waive: '豁免',
  };
  return value ? labels[value] ?? value : '未决策';
}

function FactList({title, emptyText, children}: {title: string; emptyText: string; children?: ReactNode}) {
  return (
    <div className="rounded-lg border border-border-cream bg-ivory p-4">
      <h4 className="text-[14px] font-medium text-charcoal">{title}</h4>
      <div className="mt-3 space-y-3">
        {children ? children : <p className="text-[12px] leading-relaxed text-stone">{emptyText}</p>}
      </div>
    </div>
  );
}

function FactRow({label, value}: {label: string; value: string}) {
  return (
    <div className="flex items-start justify-between gap-4 text-[12px]">
      <span className="text-stone">{label}</span>
      <span className="max-w-[260px] break-words text-right font-medium text-charcoal">{value}</span>
    </div>
  );
}

function FactItem({title, meta, children}: {title: string; meta: string; children?: ReactNode}) {
  return (
    <div className="border-t border-border-cream pt-3 first:border-t-0 first:pt-0">
      <p className="text-[12px] font-medium text-charcoal">{title}</p>
      <p className="mt-1 break-words text-[12px] leading-relaxed text-stone">{meta}</p>
      {children}
    </div>
  );
}

export function CloseWorkbench() {
  const [activeTab, setActiveTab] = useState<CloseTab>('overview');
  const [workspaces, setWorkspaces] = useState<CloseWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [period, setPeriod] = useState<AccountingPeriod | null>(null);
  const [checklist, setChecklist] = useState<CloseChecklistItem[]>([]);
  const [findings, setFindings] = useState<CloseFinding[]>([]);
  const [evidenceArtifacts, setEvidenceArtifacts] = useState<CloseEvidenceArtifact[]>([]);
  const [reports, setReports] = useState<CloseReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<CloseReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [factsLoading, setFactsLoading] = useState(false);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportDetailError, setReportDetailError] = useState<string | null>(null);
  const [csvImportStatus, setCsvImportStatus] = useState<string | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find(workspace => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCloseWorkspaces({limit: 20});
      if (res.data.length === 0) {
        setWorkspaces([]);
        setSelectedWorkspaceId(null);
        setPeriod(null);
        setChecklist([]);
        setFindings([]);
        setEvidenceArtifacts([]);
        setReports([]);
      } else {
        setWorkspaces(res.data);
        setSelectedWorkspaceId(current => current ?? res.data[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkspaceFacts = useCallback(async (workspaceId: string) => {
    setFactsLoading(true);
    setError(null);
    try {
      const [overviewRes, checklistRes, findingsRes, evidenceRes, reportsRes] = await Promise.all([
        getCloseOverview(workspaceId),
        listCloseChecklist(workspaceId),
        listCloseFindings(workspaceId),
        listCloseEvidenceArtifacts(workspaceId),
        listCloseReports(workspaceId),
      ]);
      setPeriod(overviewRes.currentPeriod);
      setChecklist(checklistRes.data);
      setFindings(findingsRes.data);
      setEvidenceArtifacts(evidenceRes.data);
      setReports(reportsRes.data);
      setSelectedReportId(current => current ?? reportsRes.data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setFactsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (selectedWorkspaceId) void loadWorkspaceFacts(selectedWorkspaceId);
  }, [loadWorkspaceFacts, selectedWorkspaceId]);

  const evidenceCount = useMemo(
    () => evidenceArtifacts.length,
    [evidenceArtifacts],
  );
  const findingsByEvidenceId = useMemo(() => {
    const map = new Map<string, CloseFinding[]>();
    findings.forEach(finding => {
      finding.evidenceArtifactIds.forEach(evidenceId => {
        const current = map.get(evidenceId) ?? [];
        current.push(finding);
        map.set(evidenceId, current);
      });
    });
    return map;
  }, [findings]);
  const pendingReviewCount = findings.filter(finding => finding.reviewStatus === 'pending').length;
  const unresolvedBlockingFindings = findings.filter(finding =>
    finding.severity === 'blocking' && !['approved', 'waived', 'resolved'].includes(finding.status),
  );
  const reviewRequiredFindings = findings.filter(finding => finding.severity === 'blocking');
  const reportBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (checklist.length === 0) blockers.push('请先发起关账检查');
    const notSubmitted = reviewRequiredFindings.filter(finding => !finding.humanReviewId).length;
    const pending = reviewRequiredFindings.filter(finding => finding.reviewStatus === 'pending').length;
    const rejected = reviewRequiredFindings.filter(finding => finding.reviewStatus === 'rejected').length;
    const unresolved = unresolvedBlockingFindings.filter(finding =>
      finding.reviewStatus !== 'approved' && finding.reviewStatus !== 'waived',
    ).length;
    if (notSubmitted > 0) blockers.push(`${notSubmitted} 个阻塞异常尚未提交复核`);
    if (pending > 0) blockers.push(`${pending} 个阻塞异常等待复核决策`);
    if (rejected > 0) blockers.push(`${rejected} 个阻塞异常已退回，需要重新处理`);
    if (unresolved > 0 && pending === 0 && notSubmitted === 0 && rejected === 0) blockers.push(`${unresolved} 个阻塞异常尚未解除`);
    return blockers;
  }, [checklist.length, reviewRequiredFindings, unresolvedBlockingFindings]);
  const canGenerateReport = Boolean(selectedWorkspace && period && reportBlockers.length === 0);
  const passedCount = checklist.filter(item => item.status === 'passed').length;
  const passRate = checklist.length ? Math.round((passedCount / checklist.length) * 100) : 0;

  const createDemoWorkspace = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const created = await createCloseWorkspace({
        name: '华东共享中心 2026-04 月结',
        scope: {
          organizationName: '华东共享中心',
          ledgerName: '总账账套 A',
          bookCode: 'CN-GL-A',
          currency: 'CNY',
        },
        period: {
          periodKey: '2026-04',
          startsAt: '2026-04-01T00:00:00.000Z',
          endsAt: '2026-04-30T23:59:59.000Z',
        },
      });
      setWorkspaces(current => [created.workspace, ...current]);
      setSelectedWorkspaceId(created.workspace.id);
      setPeriod(created.currentPeriod);
      setChecklist([]);
      setFindings([]);
      setEvidenceArtifacts([]);
      setReports([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setActionLoading(false);
    }
  };

  const runChecks = async () => {
    if (!selectedWorkspace || !period) return;
    setActionLoading(true);
    setError(null);
    try {
      await generateCloseChecks(selectedWorkspace.id, {
        periodId: period.id,
        mockDataset: 'general-ledger-basic',
      });
      await loadWorkspaceFacts(selectedWorkspace.id);
      setActiveTab('findings');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发起关账检查失败');
    } finally {
      setActionLoading(false);
    }
  };

  const submitReview = async (finding: CloseFinding) => {
    if (!finding || !selectedWorkspace) return;
    setActionLoading(true);
    setError(null);
    try {
      await submitFindingReview(finding.id, {reason: '阻塞项需要财务负责人复核。'});
      await loadWorkspaceFacts(selectedWorkspace.id);
      setActiveTab('reviews');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交复核失败');
    } finally {
      setActionLoading(false);
    }
  };

  const approveReview = async (finding: CloseFinding) => {
    if (!finding.humanReviewId || !selectedWorkspace) return;
    setActionLoading(true);
    setError(null);
    try {
      await decideCloseReview(finding.humanReviewId, 'approve', {reason: '业务负责人确认该异常可控，允许进入报告快照。'});
      await loadWorkspaceFacts(selectedWorkspace.id);
      setActiveTab('reviews');
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理复核失败');
    } finally {
      setActionLoading(false);
    }
  };

  const createReport = async () => {
    if (!selectedWorkspace || !period || !canGenerateReport) return;
    setActionLoading(true);
    setError(null);
    try {
      await generateCloseReport(selectedWorkspace.id, {periodId: period.id});
      await loadWorkspaceFacts(selectedWorkspace.id);
      setActiveTab('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成关账报告失败');
    } finally {
      setActionLoading(false);
    }
  };

  const importCsvEvidence = async (file: File | null) => {
    if (!file || !selectedWorkspace || !period) return;
    setActionLoading(true);
    setCsvImportStatus(null);
    setError(null);
    try {
      await importCloseCsvEvidence(selectedWorkspace.id, {
        periodId: period.id,
        file,
        sourceSystem: 'manual-upload',
        ledgerName: typeof selectedWorkspace.scope.ledgerName === 'string' ? selectedWorkspace.scope.ledgerName : undefined,
      });
      await loadWorkspaceFacts(selectedWorkspace.id);
      setActiveTab('evidence');
      setCsvImportStatus('CSV 证据已导入');
    } catch (err) {
      setCsvImportStatus(null);
      setError(err instanceof Error ? err.message : '导入 CSV 证据失败');
    } finally {
      setActionLoading(false);
    }
  };

  const openReportDetail = async (reportId: string) => {
    setSelectedReportId(reportId);
    setReportDetailLoading(true);
    setReportDetailError(null);
    try {
      const detail = await getCloseReportDetail(reportId);
      setReportDetail(detail);
    } catch (err) {
      setReportDetail(null);
      setReportDetailError(err instanceof Error ? err.message : '报告详情加载失败');
    } finally {
      setReportDetailLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-container-low">
      <header className="sticky top-0 z-30 border-b border-surface-container-highest bg-surface-container-low/90 px-8 py-5 backdrop-blur-md">
        <p className="mb-2 text-[11px] font-medium tracking-[0.12px] text-stone">中国 ERP 财务月结</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px] font-medium leading-tight text-charcoal">关账工作台</h1>
            <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-olive">
              围绕会计期间、检查清单、异常、证据、复核和报告形成关账就绪闭环。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createDemoWorkspace}
              disabled={actionLoading}
              className="rounded-lg border border-border-cream px-4 py-2 text-[13px] font-medium text-charcoal hover:bg-surface-container disabled:opacity-60"
            >
              新建演示工作区
            </button>
            <button
              type="button"
              onClick={runChecks}
              disabled={!selectedWorkspace || !period || actionLoading}
              className="rounded-lg bg-charcoal px-4 py-2 text-[13px] font-medium text-ivory hover:bg-[#30302e] disabled:opacity-60"
            >
              发起关账检查
            </button>
            <button
              type="button"
              onClick={createReport}
              disabled={!canGenerateReport || actionLoading}
              title={reportBlockers[0] ?? '生成当前期间的关账报告快照'}
              className="rounded-lg border border-border-cream px-4 py-2 text-[13px] font-medium text-charcoal hover:bg-surface-container disabled:opacity-60"
            >
              生成关账报告
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-8">
        {error && <ErrorState message={error} />}

        {loading ? (
          <EmptyState icon="progress_activity" title="正在加载关账工作台" description="正在读取关账工作区、会计期间和业务事实链。" />
        ) : selectedWorkspace && (!period || factsLoading) ? (
          <EmptyState icon="progress_activity" title="正在加载关账事实" description="正在读取会计期间、检查清单、异常、证据、复核和报告快照。" />
        ) : !selectedWorkspace ? (
          <section className="rounded-xl border border-border-cream bg-ivory p-5">
            <EmptyState icon="event_busy" title="还没有关账工作区" description="先显式创建一个工作区，再开始关账检查；打开页面不会自动写入业务数据。" />
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={createDemoWorkspace}
                disabled={actionLoading}
                className="rounded-lg bg-charcoal px-4 py-2 text-[13px] font-medium text-ivory hover:bg-[#30302e] disabled:opacity-60"
              >
                创建演示工作区
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-border-cream bg-ivory p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-[22px] font-medium text-charcoal">{selectedWorkspace.name}</h2>
                  <p className="mt-1 text-[12px] text-stone">
                    {String(selectedWorkspace.scope.ledgerName ?? '未记录账套')} · 会计期间 {period.periodKey} · {statusLabel(period.status)}
                  </p>
                </div>
                <span className="rounded-lg border border-border-cream px-3 py-2 text-[12px] text-stone">
                  最近更新 {formatDate(selectedWorkspace.updatedAt ?? selectedWorkspace.createdAt)}
                </span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <MetricCard label="检查通过率" value={`${passRate}%`} helper={`${passedCount}/${checklist.length || 0} 个控制项通过`} />
                <MetricCard label="高风险异常" value={String(findings.filter(finding => finding.severity === 'blocking').length)} helper="阻塞关账的异常发现" />
                <MetricCard label="待复核数" value={String(pendingReviewCount)} helper="等待人工责任判断" />
                <MetricCard label="证据数量" value={String(evidenceCount)} helper="只展示元数据与 hash" />
                <MetricCard label="报告状态" value={reports[0] ? '已生成' : '未生成'} helper={reports[0] ? `生成于 ${formatDate(reports[0].generatedAt)}` : reportBlockers[0] ?? '已满足生成条件'} />
              </div>
            </section>

            <div className="flex flex-wrap gap-2 rounded-xl border border-border-cream bg-ivory p-1">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
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

            {activeTab === 'overview' && (
              <>
                <section className="rounded-xl border border-border-cream bg-ivory p-5">
                  <h2 className="font-serif text-[22px] font-medium text-charcoal">期间总览</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-stone">
                    本期关账状态由检查清单、异常发现、证据、复核和报告共同决定。AI 只提供检查与取证，不自动批准关账。
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <MetricCard label="期间范围" value={period.periodKey} helper={`${formatDate(period.startsAt)} - ${formatDate(period.endsAt)}`} />
                    <MetricCard label="工作区状态" value={statusLabel(selectedWorkspace.status)} helper="租户内业务工作区" />
                    <MetricCard label="当前动作" value={findings.length ? '处理异常' : '发起检查'} helper="从检查进入复核和报告" />
                  </div>
                </section>
                <FactChainPanel checklist={checklist} findings={findings} reports={reports} />
              </>
            )}

            {activeTab === 'checklist' && (
              <TableSection
                title="检查清单"
                columns={['控制项', '规则编码', '风险等级', '检查状态', '运行追踪']}
                empty={<EmptyState icon="checklist" title="暂无检查结果" description="点击发起关账检查，生成前三条总账完整性检查。" />}
                hasData={checklist.length > 0}
              >
                <tbody className="divide-y divide-border-cream text-charcoal">
                  {checklist.map(item => (
                    <tr key={item.id} className="hover:bg-surface-container">
                      <td className="px-3 py-3 font-medium">{item.title}</td>
                      <td className="px-3 py-3">{item.code}</td>
                      <td className="px-3 py-3">{item.severity === 'blocking' ? '阻塞' : '提示'}</td>
                      <td className="px-3 py-3">{statusLabel(item.status)}</td>
                      <td className="px-3 py-3">
                        {item.runId ? (
                          <TraceLink to={governanceRunUrl(item.runId)} icon="travel_explore">查看运行追踪</TraceLink>
                        ) : <span className="text-stone">未关联</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableSection>
            )}

            {activeTab === 'findings' && (
              <TableSection
                title="异常发现"
                columns={['异常', '风险等级', '状态', '证据', '复核', '事实链']}
                empty={<EmptyState icon="warning" title="当前没有异常发现" description="可以查看检查清单确认各控制项状态。" />}
                hasData={findings.length > 0}
              >
                <tbody className="divide-y divide-border-cream text-charcoal">
                  {findings.map(finding => (
                    <tr key={finding.id} className="hover:bg-surface-container">
                      <td className="px-3 py-3 font-medium">{finding.title}</td>
                      <td className="px-3 py-3">{finding.severity === 'blocking' ? '阻塞' : '提示'}</td>
                      <td className="px-3 py-3">{statusLabel(finding.status)}</td>
                      <td className="px-3 py-3">{finding.evidenceCount} 条</td>
                      <td className="px-3 py-3">
                        {finding.reviewStatus ? (
                          reviewStatusLabel(finding.reviewStatus)
                        ) : (
                          <button
                            type="button"
                            onClick={() => submitReview(finding)}
                            disabled={actionLoading}
                            className="rounded-lg border border-border-cream px-3 py-1.5 text-[12px] font-medium text-charcoal hover:bg-surface-container disabled:opacity-60"
                          >
                            提交复核
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {finding.runId && (
                            <TraceLink to={governanceRunUrl(finding.runId)} icon="travel_explore">查看运行追踪</TraceLink>
                          )}
                          {finding.runId && (
                            <TraceLink to={governanceRunAuditUrl(finding.runId)} icon="policy">查看审计事件</TraceLink>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableSection>
            )}

            {activeTab === 'evidence' && (
              <section className="rounded-xl border border-border-cream bg-ivory p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-[22px] font-medium text-charcoal">证据中心</h2>
                    {csvImportStatus && (
                      <p className="mt-1 text-[12px] text-stone">{csvImportStatus}</p>
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-cream px-3 py-2 text-[12px] font-medium text-charcoal hover:bg-surface-container">
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    {actionLoading ? '正在导入' : '导入 CSV 证据'}
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      aria-label="导入 CSV 证据"
                      className="sr-only"
                      disabled={actionLoading}
                      onChange={event => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        event.currentTarget.value = '';
                        void importCsvEvidence(file);
                      }}
                    />
                  </label>
                </div>
                {evidenceCount === 0 ? (
                  <div className="mt-5">
                    <EmptyState icon="fact_check" title="暂无证据" description="导入 CSV 证据或发起检查生成证据。" />
                  </div>
                ) : (
                  <div className="mt-5 divide-y divide-border-cream rounded-lg border border-border-cream">
                    {evidenceArtifacts.map(evidence => {
                      const linkedFindings = findingsByEvidenceId.get(evidence.id) ?? [];
                      const firstFinding = linkedFindings[0] ?? null;
                      const runId = evidence.runId ?? firstFinding?.runId ?? null;

                      return (
                        <div key={evidence.id} className="px-3 py-3 text-[12px]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-charcoal">
                                {evidenceTypeLabel(evidence.evidenceType)} · {evidence.sourceSystem ?? '未记录来源'}
                              </p>
                              <p className="mt-1 break-words text-stone">
                                hash {evidence.sourceHash} · 捕获 {formatDate(evidence.capturedAt ?? evidence.createdAt)}
                              </p>
                              <p className="mt-1 text-stone">
                                行数 {metadataNumber(evidence.metadataSummary, 'rowCount')} · 列数 {metadataNumber(evidence.metadataSummary, 'columnCount')}
                              </p>
                              <p className="mt-1 text-stone">
                                关联异常：{linkedFindings.length ? linkedFindings.map(item => item.title).join('、') : '未绑定异常'}
                              </p>
                            </div>
                            <span className="rounded-lg border border-border-cream px-2 py-1 text-[11px] text-stone">
                              证据 {shortId(evidence.id)}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {runId && (
                              <TraceLink to={governanceRunUrl(runId)} icon="travel_explore">查看运行追踪</TraceLink>
                            )}
                            {runId && (
                              <TraceLink to={governanceRunAuditUrl(runId)} icon="policy">查看审计事件</TraceLink>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'reviews' && (
              <section className="rounded-xl border border-border-cream bg-ivory p-5">
                <h2 className="font-serif text-[22px] font-medium text-charcoal">复核队列</h2>
                {findings.filter(finding => finding.humanReviewId).length === 0 ? (
                  <div className="mt-5">
                    <EmptyState icon="approval" title="暂无复核项" description="异常提交复核后，会在这里显示待复核或已处理状态。" />
                  </div>
                ) : (
                  <div className="mt-5 divide-y divide-border-cream rounded-lg border border-border-cream">
                    {findings.filter(finding => finding.humanReviewId).map(finding => (
                      <div key={finding.id} className="flex items-center justify-between gap-4 px-3 py-3 text-[12px]">
                        <div>
                          <p className="font-medium text-charcoal">{finding.title}</p>
                          <p className="mt-1 text-stone">复核状态：{reviewStatusLabel(finding.reviewStatus)}</p>
                        </div>
                        {finding.reviewStatus === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => approveReview(finding)}
                            disabled={actionLoading}
                            className="rounded-lg bg-charcoal px-3 py-2 text-[12px] font-medium text-ivory hover:bg-[#30302e] disabled:opacity-60"
                          >
                            批准复核
                          </button>
                        ) : (
                          <span className="text-stone">{finding.humanReviewId?.slice(0, 8)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'report' && (
              <section className="rounded-xl border border-border-cream bg-ivory p-5">
                <h2 className="font-serif text-[22px] font-medium text-charcoal">关账报告</h2>
                {reports.length === 0 ? (
                  <div className="mt-5">
                    <EmptyState icon="summarize" title="暂未生成关账报告" description={reportBlockers[0] ?? '已满足检查和复核条件，可以生成报告快照。'} />
                  </div>
                ) : (
                  <div className="mt-5 divide-y divide-border-cream rounded-lg border border-border-cream">
                    {reports.map(report => (
                      <div key={report.id} className="px-3 py-3 text-[12px]">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-charcoal">{report.title}</p>
                          <span className="text-stone">{statusLabel(report.status)}</span>
                        </div>
                        <p className="mt-1 text-stone">快照 {report.snapshotHash.slice(0, 12)} · 生成 {formatDate(report.generatedAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {report.runIds[0] && (
                            <TraceLink to={governanceRunUrl(report.runIds[0])} icon="travel_explore">查看报告依据</TraceLink>
                          )}
                          {report.runIds[0] && (
                            <TraceLink to={governanceRunAuditUrl(report.runIds[0])} icon="policy">查看审计事件</TraceLink>
                          )}
                          <button
                            type="button"
                            onClick={() => openReportDetail(report.id)}
                            disabled={reportDetailLoading && selectedReportId === report.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border-cream px-3 py-1.5 text-[12px] font-medium text-charcoal hover:bg-surface-container disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-[15px]">account_tree</span>
                            {reportDetailLoading && selectedReportId === report.id ? '正在加载依据' : '展开报告依据'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <ReportDetailPanel
                  detail={reportDetail}
                  checklist={checklist}
                  loading={reportDetailLoading}
                  error={reportDetailError}
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TableSection({
  title,
  columns,
  hasData,
  empty,
  action,
  children,
}: {
  title: string;
  columns: string[];
  hasData: boolean;
  empty: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-cream bg-ivory">
      <div className="flex items-center justify-between border-b border-border-cream px-5 py-4">
        <h2 className="font-serif text-[22px] font-medium text-charcoal">{title}</h2>
        {action}
      </div>
      <div className="p-5">
        {!hasData ? empty : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="text-stone">
                <tr className="border-b border-border-cream">
                  {columns.map(column => (
                    <th key={column} className="px-3 py-2 font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              {children}
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
