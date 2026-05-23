/**
 * Observability 模块 — 初始化工厂 + 统一导出
 *
 * 职责：
 * - 初始化 Langfuse client
 * - 创建 TracingProvider 实例
 * - 未配置 key 时静默降级为 NoOp
 */

import {Langfuse} from 'langfuse';
import {NoOpTracingProvider, NoOpMetricsProvider} from '@neptune/engine';
import type {ITracingProvider, IMetricsProvider} from '@neptune/engine';
import {LangfuseTracingProvider} from './langfuse-tracing-provider';
import {createLogger} from '../../utils/logger';

const log = createLogger('observability');

let langfuseInstance: Langfuse | null = null;
let tracingProvider: ITracingProvider = NoOpTracingProvider.getInstance();
let metricsProvider: IMetricsProvider = NoOpMetricsProvider.getInstance();

/**
 * 初始化可观测性（应用启动时调用一次）
 */
export function initObservability(): void {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;

    if (publicKey && secretKey) {
        langfuseInstance = new Langfuse({
            publicKey,
            secretKey,
            baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
        });
        tracingProvider = new LangfuseTracingProvider(langfuseInstance);
        log.info('Langfuse observability initialized', {baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'});
    } else {
        log.info('Langfuse not configured, using NoOp providers');
    }
}

/**
 * 获取 TracingProvider（注入 Engine 用）
 */
export function getTracingProvider(): ITracingProvider {
    return tracingProvider;
}

/**
 * 为一次请求创建独立 TracingProvider。
 *
 * LangfuseTracingProvider 内部维护当前 trace/span/generation 引用；
 * chat dispatch 必须使用请求级实例，避免并发请求覆盖彼此状态。
 */
export function createTracingProviderForRequest(): ITracingProvider {
    if (langfuseInstance) {
        return new LangfuseTracingProvider(langfuseInstance);
    }
    return NoOpTracingProvider.getInstance();
}

/**
 * 获取 MetricsProvider（注入 Engine 用）
 */
export function getMetricsProvider(): IMetricsProvider {
    return metricsProvider;
}

/**
 * 优雅关闭（flush pending data）
 */
export async function shutdownObservability(): Promise<void> {
    if (langfuseInstance) {
        await langfuseInstance.shutdownAsync();
        log.info('Langfuse shutdown complete');
    }
}

export {LangfuseTracingProvider} from './langfuse-tracing-provider';
