import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CustomerProjectDto } from "@shared/neptune-ai";
import type { AgentTemplate } from "../types/chat";
import { archiveProject, createProject, listProjects } from "../api/projects";
import { listAgents } from "../api/agents";
import { createRun } from "../api/runs";
import { getQuotaStatus, type PlatformQuotaStatus } from "../api/platformFacts";
import { ApiClientError, formatApiErrorForDisplay } from "../api/client";

type CreateProjectForm = {
  name: string;
  description: string;
  environment: string;
  solutionPack: string;
};

type RunForm = {
  agentId: string;
  title: string;
  input: string;
};

const initialForm: CreateProjectForm = {
  name: "",
  description: "",
  environment: "sandbox",
  solutionPack: "close_readiness",
};

const initialRunForm: RunForm = {
  agentId: "",
  title: "",
  input: "",
};

function projectStatusLabel(status: CustomerProjectDto["status"]): string {
  return status === "archived" ? "已归档" : "交付中";
}

function environmentLabel(environment: string): string {
  const labels: Record<string, string> = {
    sandbox: "沙箱环境",
    pilot: "试点环境",
    production: "生产环境",
  };
  return labels[environment] ?? environment;
}

function quotaBlockText(status: PlatformQuotaStatus): string {
  if (status.allowed) return "允许发起新运行";
  if (status.reason === "CONCURRENT_SESSION_LIMIT") {
    return "运行中并发已达到租户上限，等待现有运行结束后再发起。";
  }
  return "今日 token 已达到租户配额上限，暂不能发起新运行。";
}

function quotaReasonText(reason: unknown): string {
  if (reason === "CONCURRENT_SESSION_LIMIT") {
    return "运行中并发已达到租户上限，等待现有运行结束后再发起。";
  }
  return "今日 token 已达到租户配额上限，暂不能发起新运行。";
}

function formatQuotaNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<CustomerProjectDto[]>([]);
  const [agents, setAgents] = useState<AgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isAgentsLoading, setIsAgentsLoading] = useState(false);
  const [isQuotaLoading, setIsQuotaLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunSubmitting, setIsRunSubmitting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CustomerProjectDto | null>(null);
  const [error, setError] = useState("");
  const [runError, setRunError] = useState("");
  const [quotaStatus, setQuotaStatus] = useState<PlatformQuotaStatus | null>(null);
  const [quotaError, setQuotaError] = useState("");
  const [form, setForm] = useState<CreateProjectForm>(initialForm);
  const [runForm, setRunForm] = useState<RunForm>(initialRunForm);

  const activeCount = useMemo(() => projects.filter(project => project.status === "active").length, [projects]);
  const archivedCount = projects.length - activeCount;

  async function loadProjects() {
    setIsLoading(true);
    setError("");
    try {
      const res = await listProjects({ limit: 50, offset: 0 });
      setProjects(res.data);
    } catch (err) {
      setError(formatApiErrorForDisplay(err, "客户项目加载失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAgents() {
    setIsAgentsLoading(true);
    setRunError("");
    try {
      const res = await listAgents({ active: true, limit: 100, offset: 0 });
      setAgents(res.data);
      setRunForm(prev => ({
        ...prev,
        agentId: prev.agentId || res.data[0]?.id || "",
      }));
    } catch (err) {
      setRunError(formatApiErrorForDisplay(err, "智能体列表加载失败"));
    } finally {
      setIsAgentsLoading(false);
    }
  }

  async function loadQuotaStatus() {
    setIsQuotaLoading(true);
    setQuotaError("");
    try {
      setQuotaStatus(await getQuotaStatus());
    } catch (err) {
      setQuotaError(formatApiErrorForDisplay(err, "租户配额状态加载失败"));
      setQuotaStatus(null);
    } finally {
      setIsQuotaLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("客户项目名称不能为空");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const project = await createProject({
        name: form.name,
        description: form.description || null,
        environment: form.environment,
        solutionPack: form.solutionPack || null,
        metadataSummary: {
          source: "delivery_console",
        },
      });
      setProjects(prev => [project, ...prev]);
      setForm(initialForm);
      setIsCreating(false);
    } catch (err) {
      setError(formatApiErrorForDisplay(err, "客户项目创建失败"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function openRunModal(agentId?: string) {
    setRunForm(prev => ({ ...prev, agentId: agentId || prev.agentId }));
    setRunError("");
    setQuotaError("");
    setQuotaStatus(null);
    setIsRunModalOpen(true);
    void loadAgents();
    void loadQuotaStatus();
  }

  async function handleCreateRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isQuotaLoading) {
      setRunError("正在读取租户配额状态。");
      return;
    }
    if (quotaStatus && !quotaStatus.allowed) {
      setRunError(`本次受控运行暂不可发起：${quotaBlockText(quotaStatus)}`);
      return;
    }
    if (!quotaStatus) {
      setRunError(quotaError || "租户配额状态未确认，暂不能发起受控运行。");
      return;
    }
    const input = runForm.input.trim();
    if (!input) {
      setRunError("运行输入不能为空");
      return;
    }
    if (!runForm.agentId) {
      setRunError("请选择智能体");
      return;
    }

    setIsRunSubmitting(true);
    setRunError("");
    try {
      const run = await createRun({
        agentId: runForm.agentId,
        title: runForm.title.trim() || null,
        input,
      });
      setRunForm(initialRunForm);
      setIsRunModalOpen(false);
      navigate(`/governance?tab=runs&runId=${run.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.error === "QUOTA_EXCEEDED") {
        const reasonText = quotaReasonText(err.details.reason);
        setRunError([
          `本次受控运行被租户配额拒绝：${reasonText}`,
          err.requestId ? `请求编号：${err.requestId}` : "",
        ].filter(Boolean).join("\n"));
        void loadQuotaStatus();
      } else {
        setRunError(formatApiErrorForDisplay(err, "受控运行创建失败"));
      }
    } finally {
      setIsRunSubmitting(false);
    }
  }

  async function confirmArchiveProject() {
    if (!archiveTarget) return;

    setIsSubmitting(true);
    setError("");
    try {
      const archived = await archiveProject(archiveTarget.id);
      setProjects(prev => prev.map(project => project.id === archived.id ? archived : project));
      setArchiveTarget(null);
    } catch (err) {
      setError(formatApiErrorForDisplay(err, "客户项目归档失败"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-parchment text-charcoal">
      <header className="sticky top-0 z-30 border-b border-border-cream bg-parchment/90 px-8 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
          <div>
            <p className="text-[12px] font-medium text-olive">Neptune AgentOps</p>
            <h1 className="font-serif text-[32px] font-medium leading-tight text-charcoal">交付台</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openRunModal()}
              className="inline-flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2 text-[14px] font-medium text-ivory ring-shadow-interactive transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              发起受控运行
            </button>
            <button
              type="button"
              data-testid="create-project-button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[14px] font-medium text-ivory ring-shadow-interactive transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              新建客户项目
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border-cream bg-ivory p-5 ring-shadow">
            <p className="text-[13px] text-olive">客户项目</p>
            <p className="mt-2 font-serif text-[30px] font-medium leading-tight">{projects.length}</p>
          </div>
          <div className="rounded-xl border border-border-cream bg-ivory p-5 ring-shadow">
            <p className="text-[13px] text-olive">交付中</p>
            <p className="mt-2 font-serif text-[30px] font-medium leading-tight">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-border-cream bg-ivory p-5 ring-shadow">
            <p className="text-[13px] text-olive">已归档</p>
            <p className="mt-2 font-serif text-[30px] font-medium leading-tight">{archivedCount}</p>
          </div>
        </section>

        {error && (
          <div className="whitespace-pre-line rounded-xl border border-border-warm bg-ivory p-4 text-[14px] leading-6 text-error ring-shadow">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-border-cream bg-ivory p-5 ring-shadow">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-[24px] font-medium leading-tight text-charcoal">客户项目</h2>
              <p className="mt-1 text-[14px] leading-6 text-olive">
                客户项目是智能体模板、受控运行、证据、审计和关账工作台的共同归属入口。
              </p>
            </div>
            <button
              type="button"
              onClick={loadProjects}
              className="inline-flex items-center gap-2 rounded-lg bg-sand px-3 py-2 text-[13px] font-medium text-charcoal ring-shadow-interactive"
            >
              <span className="material-symbols-outlined text-[17px]">refresh</span>
              刷新
            </button>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-border-cream bg-parchment p-8 text-center text-[14px] text-olive">
              正在加载客户项目...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-lg border border-border-cream bg-parchment p-8 text-center">
              <p className="font-serif text-[22px] font-medium text-charcoal">还没有客户项目</p>
              <p className="mx-auto mt-2 max-w-xl text-[14px] leading-6 text-olive">
                请先创建客户项目，再配置智能体、技能、数据源和受控运行。
              </p>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[14px] font-medium text-ivory"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                新建客户项目
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map(project => (
                <article
                  key={project.id}
                  data-testid="project-card"
                  className="rounded-lg border border-border-cream bg-parchment p-4 ring-shadow"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-[20px] font-medium leading-tight text-charcoal">{project.name}</h3>
                        <span className="rounded-full bg-sand px-2.5 py-1 text-[12px] font-medium text-charcoal">
                          {projectStatusLabel(project.status)}
                        </span>
                        <span className="rounded-full border border-border-warm px-2.5 py-1 text-[12px] text-olive">
                          {environmentLabel(project.environment)}
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-[14px] leading-6 text-olive">
                        {project.description || "暂无项目说明。"}
                      </p>
                      {project.status === "archived" && (
                        <p className="mt-3 rounded-lg border border-border-warm bg-ivory px-3 py-2 text-[13px] leading-5 text-olive">
                          该客户项目已归档。历史运行、成果文件和审计事件仍会保留。
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href="/governance"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sand px-3 py-2 text-[13px] font-medium text-charcoal ring-shadow-interactive"
                      >
                        <span className="material-symbols-outlined text-[16px]">policy</span>
                        查看治理
                      </a>
                      <button
                        type="button"
                        disabled={project.status === "archived"}
                        onClick={() => openRunModal()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-3 py-2 text-[13px] font-medium text-ivory ring-shadow-interactive disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                        发起受控运行
                      </button>
                      <button
                        type="button"
                        disabled={project.status === "archived"}
                        onClick={() => setArchiveTarget(project)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-ivory px-3 py-2 text-[13px] font-medium text-charcoal ring-shadow-interactive disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">archive</span>
                        归档项目
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 px-4">
          <form onSubmit={handleCreateProject} className="w-full max-w-xl rounded-xl border border-border-cream bg-ivory p-6 ring-shadow">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-[24px] font-medium leading-tight">新建客户项目</h2>
                <p className="mt-1 text-[14px] leading-6 text-olive">先建立客户项目，再承载智能体、运行、证据和治理事实。</p>
              </div>
              <button type="button" onClick={() => setIsCreating(false)} className="rounded-lg p-1.5 text-stone hover:bg-sand hover:text-charcoal">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1.5 text-[13px] font-medium text-charcoal">
                客户项目名称
                <input
                  value={form.name}
                  onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                  className="rounded-xl border border-border-warm bg-parchment px-3 py-2 text-[14px] outline-none focus:border-[#3898ec]"
                  placeholder="例如：华东共享服务中心月结项目"
                />
              </label>

              <label className="grid gap-1.5 text-[13px] font-medium text-charcoal">
                项目说明
                <textarea
                  value={form.description}
                  onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
                  className="min-h-24 rounded-xl border border-border-warm bg-parchment px-3 py-2 text-[14px] leading-6 outline-none focus:border-[#3898ec]"
                  placeholder="说明客户、业务范围、验收目标或数据边界"
                />
              </label>

              <label className="grid gap-1.5 text-[13px] font-medium text-charcoal">
                运行环境
                <select
                  value={form.environment}
                  onChange={event => setForm(prev => ({ ...prev, environment: event.target.value }))}
                  className="rounded-xl border border-border-warm bg-parchment px-3 py-2 text-[14px] outline-none focus:border-[#3898ec]"
                >
                  <option value="sandbox">沙箱环境</option>
                  <option value="pilot">试点环境</option>
                  <option value="production">生产环境</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreating(false)} className="rounded-lg bg-sand px-4 py-2 text-[14px] font-medium text-charcoal">
                取消
              </button>
              <button type="submit" disabled={isSubmitting} className="rounded-lg bg-brand px-4 py-2 text-[14px] font-medium text-ivory disabled:opacity-50">
                {isSubmitting ? "创建中..." : "创建项目"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 px-4">
          <form onSubmit={handleCreateRun} className="w-full max-w-xl rounded-xl border border-border-cream bg-ivory p-6 ring-shadow">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-[24px] font-medium leading-tight">发起受控运行</h2>
                <p className="mt-1 text-[14px] leading-6 text-olive">
                  本次运行会绑定智能体版本、请求编号和审计事件。
                </p>
              </div>
              <button type="button" onClick={() => setIsRunModalOpen(false)} className="rounded-lg p-1.5 text-stone hover:bg-sand hover:text-charcoal">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {runError && (
              <div className="mb-4 rounded-xl border border-border-warm bg-parchment px-3 py-3 text-[13px] leading-5 text-error">
                <div className="whitespace-pre-line">{runError}</div>
                {runError.includes("租户配额") && (
                  <a
                    href="/governance?tab=costs"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sand px-3 py-1.5 text-[12px] font-medium text-charcoal ring-shadow-interactive"
                  >
                    <span className="material-symbols-outlined text-[16px]">query_stats</span>
                    查看治理台配额状态
                  </a>
                )}
              </div>
            )}

            <div className={`mb-4 rounded-xl border px-3 py-3 text-[13px] leading-5 ${
              quotaStatus?.allowed === false ? "border-error/20 bg-parchment text-error" : "border-border-cream bg-parchment text-olive"
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">
                  {isQuotaLoading ? "progress_activity" : quotaStatus?.allowed === false ? "block" : "check_circle"}
                </span>
                <span className="font-medium">
                  {isQuotaLoading
                    ? "正在读取租户配额状态。"
                    : quotaError
                      ? quotaError
                      : quotaStatus?.allowed === false
                        ? `本次受控运行暂不可发起：${quotaBlockText(quotaStatus)}`
                        : quotaStatus?.allowed
                          ? "允许发起新运行"
                          : "正在读取租户配额状态。"}
                </span>
              </div>
              {quotaStatus && (
                <p className="mt-2 text-[12px] text-stone">
                  今日已用 {formatQuotaNumber(quotaStatus.usage.totalTokensToday)} / {formatQuotaNumber(quotaStatus.quota.maxTokensPerDay)} token · 运行中并发 {quotaStatus.usage.runningSessions}/{quotaStatus.quota.maxConcurrentSessions}
                </p>
              )}
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1.5 text-[13px] font-medium text-charcoal">
                智能体
                <select
                  value={runForm.agentId}
                  onChange={event => setRunForm(prev => ({ ...prev, agentId: event.target.value }))}
                  disabled={isAgentsLoading}
                  className="rounded-xl border border-border-warm bg-parchment px-3 py-2 text-[14px] outline-none focus:border-[#3898ec]"
                >
                  <option value="">{isAgentsLoading ? "正在加载智能体..." : "请选择智能体"}</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-[13px] font-medium text-charcoal">
                运行标题
                <input
                  value={runForm.title}
                  onChange={event => setRunForm(prev => ({ ...prev, title: event.target.value }))}
                  className="rounded-xl border border-border-warm bg-parchment px-3 py-2 text-[14px] outline-none focus:border-[#3898ec]"
                  placeholder="例如：客户验收前置检查"
                />
              </label>

              <label className="grid gap-1.5 text-[13px] font-medium text-charcoal">
                运行输入
                <textarea
                  value={runForm.input}
                  onChange={event => setRunForm(prev => ({ ...prev, input: event.target.value }))}
                  className="min-h-32 rounded-xl border border-border-warm bg-parchment px-3 py-2 text-[14px] leading-6 outline-none focus:border-[#3898ec]"
                  placeholder="描述本次运行要完成的任务、输入边界和期望结果"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsRunModalOpen(false)} className="rounded-lg bg-sand px-4 py-2 text-[14px] font-medium text-charcoal">
                取消
              </button>
              <button type="submit" disabled={isRunSubmitting || isQuotaLoading || !quotaStatus || quotaStatus.allowed === false} className="rounded-lg bg-brand px-4 py-2 text-[14px] font-medium text-ivory disabled:opacity-50">
                {isRunSubmitting ? "运行中..." : "开始运行"}
              </button>
            </div>
          </form>
        </div>
      )}

      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border-cream bg-ivory p-6 ring-shadow">
            <h2 className="font-serif text-[24px] font-medium leading-tight">确认归档客户项目？</h2>
            <p className="mt-3 text-[14px] leading-6 text-olive">
              归档不会删除运行、成果文件和审计事件。归档后项目将标记为已归档。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setArchiveTarget(null)} className="rounded-lg bg-sand px-4 py-2 text-[14px] font-medium text-charcoal">
                取消
              </button>
              <button type="button" disabled={isSubmitting} onClick={confirmArchiveProject} className="rounded-lg bg-charcoal px-4 py-2 text-[14px] font-medium text-ivory disabled:opacity-50">
                确认归档
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
