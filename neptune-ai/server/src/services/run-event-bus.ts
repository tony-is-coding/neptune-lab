import {EventEmitter} from 'events';
import type {RunRuntimeEvent} from '@shared/neptune-ai';

/**
 * Run 实时事件广播总线（单进程内存实现）。
 *
 * 设计目标：
 * - 与持久化解耦：写入 run_events 表 → 调用 publish；订阅者只消费 in-memory 事件
 * - 多订阅者：同一个 runId 可被多个 SSE 客户端订阅，互不干扰
 * - 终态广播：Run 进入 completed/failed/cancelled 时通过 publish 自然广播，订阅者
 *   据此关闭流；额外提供 `terminate(runId)` 仅用于 server 关闭/超时清理
 * - 可替换：单进程内存实现作为 MVP；多实例环境下应替换为 Postgres LISTEN/NOTIFY
 *   或 Redis pub/sub。本接口形状不依赖实现细节
 *
 * 注意：
 * - 不在该层做持久化或回放，回放由订阅方先查 DB 再 subscribe
 * - 订阅者在 unsubscribe 后必须立刻不再产生副作用，避免泄漏
 */
export type RunEventListener = (event: RunRuntimeEvent) => void;

class RunEventBus {
    private readonly emitter = new EventEmitter();

    constructor() {
        // 防止 Node 在订阅多于 10 个时输出警告，SSE 场景常见多客户端
        this.emitter.setMaxListeners(0);
    }

    private channelOf(runId: string): string {
        return `run:${runId}`;
    }

    publish(event: RunRuntimeEvent): void {
        this.emitter.emit(this.channelOf(event.runId), event);
    }

    subscribe(runId: string, listener: RunEventListener): () => void {
        const channel = this.channelOf(runId);
        this.emitter.on(channel, listener);
        return () => {
            this.emitter.off(channel, listener);
        };
    }

    /** 仅在测试或服务关闭时使用：清掉指定 runId 的所有监听器。 */
    terminate(runId: string): void {
        this.emitter.removeAllListeners(this.channelOf(runId));
    }

    /** 仅在测试中使用：清空所有订阅，避免跨用例污染。 */
    reset(): void {
        this.emitter.removeAllListeners();
    }
}

export const runEventBus = new RunEventBus();
