/**
 * session.ts — 向后兼容层
 *
 * 原有 QueryDispatcher 的所有功能已迁移到 ThreadManager（thread-manager.ts）。
 * 此文件保留旧导出名称，委托给 threadManager 实现。
 *
 * 注意：目前没有其他文件导入此模块，此 wrapper 仅作为安全网存在，
 * 防止未来有外部代码依赖旧接口时出现问题。
 */

import {threadManager} from './thread-manager.js';
import type {QueryUsageResult} from './thread-manager.js';

/**
 * Query 调度参数（保持旧接口兼容）
 */
export interface DispatchParams {
    tenantId: string;
    userId: string;
    agentId: string;
    content: string;
}

/**
 * QueryDispatcher — 向后兼容包装器
 *
 * 所有方法委托给 ThreadManager。原有的 Engine 生命周期管理
 * （每 query 创建/销毁）已替换为 EnginePool 池化管理。
 *
 * 重要：dispatch() 和旧 QueryDispatcher 一样是 AsyncGenerator，
 * 但底层实现已切换到 ThreadManager.dispatchToAgent()。
 */
export const queryDispatcher = {
    /**
     * 向 Agent 发送消息 — 委托给 threadManager.dispatchToAgent
     *
     * 自动查找或创建 Thread，然后执行 query。
     * 返回 AsyncGenerator 支持 SSE 流式输出。
     */
    dispatch: (params: DispatchParams) => threadManager.dispatchToAgent(
        params.tenantId,
        params.userId,
        params.agentId,
        params.content,
    ),

    /**
     * 获取最后一次 Query 的 Usage 结果
     */
    getUsage: (): QueryUsageResult | null => threadManager.getLastUsage(),

    /**
     * 列出 Session — 委托给 threadManager.listByFilters
     *
     * 注意：旧接口返回 Array，新接口 listByFilters 返回 { data, meta }。
     * 此处提取 data 数组以保持兼容。
     */
    list: async (filters: {
        tenantId?: string;
        userId?: string;
        agentId?: string;
        status?: string;
        limit?: number;
    }) => {
        const result = await threadManager.listByFilters(filters);
        return result.data;
    },

    /**
     * 获取 Session 详情 — 委托给 threadManager.get
     */
    get: async (sessionId: string) => {
        const thread = await threadManager.get(sessionId);
        return thread;
    },

    /**
     * 获取 Session 的 workspace 路径 — 委托给 threadManager.getWorkspace
     */
    getSessionWorkspace: (sessionId: string) => threadManager.getWorkspace(sessionId),
};

// Re-export types for backward compatibility
export type {QueryUsageResult};
