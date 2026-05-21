/**
 * SessionContextBridge — 独立的 ALS 桥接层
 *
 * 设计目的：
 * - 解决 bootstrap/state ↔ SessionContext 的循环依赖问题
 * - bootstrap/state.ts 是 import DAG 的叶子节点，不能反向依赖 engine/
 * - 提供独立的 AsyncLocalStorage 实例，与 engine/ 的 SessionContextStorage 隔离
 *
 * 关键设计约束：
 * - 只能 import Node.js 内置模块（async_hooks）
 * - 不 import 任何 src/ 下的其他模块
 * - 提供同步的 get/set 接口（与 bootstrap/state.ts 的同步 getter 匹配）
 *
 * 使用场景：
 * - Per-session 字段的 ALS 存储（cwd, sessionId, projectRoot 等）
 * - 作为后续任务（T6-T9）的基础设施
 */
/**
 * SessionContext 数据结构
 *
 * 包含 per-session 的核心字段，与 bootstrap/state.ts 中的字段对应。
 */
export interface SessionContextData {
    /** 当前工作目录 */
    cwd?: string;
    /** Session ID */
    sessionId?: string;
    /** 项目根目录（stable，不随 EnterWorktreeTool 变化） */
    projectRoot?: string;
    /** 原始启动目录 */
    originalCwd?: string;
    /** 成本数据（累积） */
    totalCostUSD?: number;
    totalAPIDuration?: number;
    totalAPIDurationWithoutRetries?: number;
    totalToolDuration?: number;
    totalLinesAdded?: number;
    totalLinesRemoved?: number;
    /** 模型使用情况 */
    modelUsage?: Record<string, unknown>;
    /** 主循环模型配置 */
    mainLoopModelOverride?: unknown;
    initialMainLoopModel?: unknown;
    /** Session 级别的 Cron 任务 */
    sessionCronTasks?: Array<{
        id: string;
        cron: string;
        prompt: string;
        createdAt: number;
        recurring?: boolean;
        agentId?: string;
    }>;
    /** Session 创建的团队 */
    sessionCreatedTeams?: Set<string>;
    /** Agent 颜色映射 */
    agentColorMap?: Map<string, string>;
    agentColorIndex?: number;
    /** Session 权限模式 */
    sessionBypassPermissionsMode?: boolean;
    /** Session 来源 */
    sessionSource?: string;
    /** 其他扩展字段 */
    [key: string]: unknown;
}
/**
 * 获取当前 ALS 上下文
 *
 * @returns 当前上下文数据，如果没有 ALS 上下文则返回 undefined
 */
export declare function getContext(): SessionContextData | undefined;
/**
 * 在指定的上下文中运行回调函数
 *
 * @param context 上下文数据
 * @param callback 要执行的回调函数
 * @returns 回调函数的返回值
 */
export declare function runWithContext<T>(context: SessionContextData, callback: () => T): T;
/**
 * 设置当前上下文中的字段值
 *
 * 注意：这个方法只在有 ALS 上下文时生效，否则静默失败。
 *
 * @param key 字段名
 * @param value 字段值
 */
export declare function setContextField<K extends keyof SessionContextData>(key: K, value: SessionContextData[K]): void;
/**
 * 获取当前上下文中的字段值
 *
 * @param key 字段名
 * @returns 字段值，如果没有上下文或字段不存在则返回 undefined
 */
export declare function getContextField<K extends keyof SessionContextData>(key: K): SessionContextData[K] | undefined;
/** Cwd 相关 */
export declare function getCwd(): string | undefined;
export declare function setCwd(cwd: string): void;
/** SessionId 相关 */
export declare function getSessionId(): string | undefined;
export declare function setSessionId(sessionId: string): void;
/** ProjectRoot 相关 */
export declare function getProjectRoot(): string | undefined;
export declare function setProjectRoot(projectRoot: string): void;
/** OriginalCwd 相关 */
export declare function getOriginalCwd(): string | undefined;
export declare function setOriginalCwd(originalCwd: string): void;
export declare function getTotalCostUSD(): number | undefined;
export declare function setTotalCostUSD(cost: number): void;
export declare function getTotalAPIDuration(): number | undefined;
export declare function setTotalAPIDuration(duration: number): void;
export declare function getModelUsage(): Record<string, unknown> | undefined;
export declare function setModelUsage(usage: Record<string, unknown>): void;
export declare function getTotalAPIDurationWithoutRetries(): number | undefined;
export declare function setTotalAPIDurationWithoutRetries(duration: number): void;
export declare function getTotalToolDuration(): number | undefined;
export declare function setTotalToolDuration(duration: number): void;
export declare function getTotalLinesAdded(): number | undefined;
export declare function setTotalLinesAdded(lines: number): void;
export declare function getTotalLinesRemoved(): number | undefined;
export declare function setTotalLinesRemoved(lines: number): void;
/**
 * 创建一个新的上下文对象
 *
 * @param initialData 初始数据
 * @returns 新的上下文对象
 */
export declare function createContext(initialData?: Partial<SessionContextData>): SessionContextData;
/**
 * 检查当前是否在 ALS 上下文中
 *
 * @returns 如果在上下文中返回 true，否则返回 false
 */
export declare function isInContext(): boolean;
//# sourceMappingURL=SessionContextBridge.d.ts.map