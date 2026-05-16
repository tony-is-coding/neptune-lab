/**
 * EnginePool Session ID 管理测试
 *
 * 测试覆盖：
 * 1. EnginePool 应支持按 threadId 存储 sdkSessionId
 * 2. 首次 dispatch -> 创建 engine + session -> sdkSessionId 正确保存
 * 3. 二次 dispatch 同一线程 -> 复用已有 engine -> 使用正确的 sdkSessionId（不是 threadId）
 * 4. Pool 淘汰 -> 淘汰旧 engine -> 下次请求创建新 engine
 * 5. sdkSessionId 与 threadId 分离验证
 *
 * 背景 BUG：
 * engine pool 目前只存储 engine 实例，不存储 sdkSessionId。
 * 当 dispatch 复用已有 engine 时，sdkSessionId 被错误地设为 threadId，
 * 导致 "Session not found" 错误。
 *
 * 这些测试将在 BUG 修复后通过，当前测试用于定义期望行为。
 */

import {describe, test, expect, beforeEach} from 'bun:test';

describe('EnginePool Session ID 管理', () => {
    let EnginePool: typeof import('../src/services/engine-pool').EnginePool;

    beforeEach(async () => {
        const mod = await import('../src/services/engine-pool');
        EnginePool = mod.EnginePool;
    });

    // ===== 当前 EnginePool 基本行为（基线测试）=====

    test('基本注册和获取应该正常工作', () => {
        const pool = new EnginePool({maxConcurrent: 5});
        const mockEngine = {
            destroy: async () => {
            }
        } as any;
        const mockSessionId = 'session-abc-123';
        pool.register('thread-1', mockEngine, mockSessionId);
        const entry = pool.get('thread-1');
        expect(entry?.engine).toBe(mockEngine);
        expect(entry?.sdkSessionId).toBe(mockSessionId);
        expect(pool.has('thread-1')).toBe(true);
    });

    // ===== sdkSessionId 存储行为测试 =====
    // 这些测试验证 EnginePool 应该支持与 engine 一起存储 sdkSessionId

    test('register 应该能存储 sdkSessionId 元数据', () => {
        /**
         * 验证目标：pool.register() 后，可以通过 entry 获取到 sdkSessionId
         * 当前已实现：register(threadId, engine, sdkSessionId) 支持存储 sdkSessionId
         */
        const pool = new EnginePool({maxConcurrent: 5});
        const mockEngine = {
            destroy: async () => {
            }
        } as any;
        const sdkSessionId = 'sdk-sess-abc-123';

        pool.register('thread-1', mockEngine, sdkSessionId);

        // 验证可以通过 entry 获取到 sdkSessionId
        const entry = pool.get('thread-1');
        expect(entry).toBeDefined();
        expect(entry!.sdkSessionId).toBe(sdkSessionId);
        expect(pool.has('thread-1')).toBe(true);
    });

    // ===== dispatch 场景模拟测试 =====

    test('场景 1: 首次 dispatch 应该创建新 engine 并获得 sdkSessionId', async () => {
        /**
         * 场景：Thread 首次收到消息
         * 期望：
         * 1. pool 中没有该 thread 的 engine
         * 2. 调用 engineFactory.createAndLoad() 创建新 engine
         * 3. 返回的 sdkSessionId 应该被保存
         * 4. engine 被注册到 pool
         */
        const pool = new EnginePool({maxConcurrent: 5});

        // 模拟首次 dispatch
        const threadId = 'thread-first-dispatch';
        expect(pool.has(threadId)).toBe(false); // pool 中不存在

        // 模拟 engine factory 创建结果
        const mockEngine = {
            destroy: async () => {
            }
        } as any;
        const sdkSessionId = 'sdk-sess-new-001';

        // 注册到 pool
        pool.register(threadId, mockEngine, sdkSessionId);

        // 验证 engine 已注册
        expect(pool.has(threadId)).toBe(true);
        const entry = pool.get(threadId);
        expect(entry).toBeDefined();
        expect(entry!.engine).toBe(mockEngine);
        expect(entry!.sdkSessionId).toBe(sdkSessionId);
    });

    test('场景 2: 二次 dispatch 应该复用已有 engine 并使用正确的 sdkSessionId（不是 threadId）', async () => {
        /**
         * 场景：Thread 第二次收到消息
         * 期望：
         * 1. pool 中已有该 thread 的 engine
         * 2. 不调用 engineFactory.createAndLoad()
         * 3. 使用之前保存的 sdkSessionId（不是 threadId）
         */
        const pool = new EnginePool({maxConcurrent: 5});
        const threadId = 'thread-second-dispatch';
        const sdkSessionId = 'sdk-sess-real-002';

        // 模拟首次 dispatch 已完成，engine 在 pool 中
        const mockEngine = {
            destroy: async () => {
            },
            query: async function* () {
                yield {type: 'text', content: 'ok'};
            },
        } as any;
        pool.register(threadId, mockEngine, sdkSessionId);

        // 模拟二次 dispatch
        // pool.get(threadId) 返回 entry — 复用成功
        const entry = pool.get(threadId);
        expect(entry).toBeDefined();
        expect(entry!.engine).toBe(mockEngine);

        // 关键验证：sdkSessionId 不应该被设为 threadId
        // 期望行为：从 pool 中获取保存的 sdkSessionId
        // threadId !== sdkSessionId（threadId 是 UUID，sdkSessionId 是 SDK 生成的）
        expect(entry!.sdkSessionId).toBe(sdkSessionId);
        expect(threadId).not.toBe(sdkSessionId);
    });

    test('场景 3: Pool 淘汰旧 engine 后，下次请求应该创建新 engine', async () => {
        /**
         * 场景：Pool 已满，需要淘汰旧 engine
         * 期望：
         * 1. LRU 淘汰最久未使用的 engine
         * 2. 被淘汰 engine 的 destroy() 被调用
         * 3. 淘汰后该 thread 的 sdkSessionId 也应该被清除
         * 4. 下次请求该 thread 时需要创建新 engine
         */
        const pool = new EnginePool({maxConcurrent: 2});

        // 注册 2 个 engine 达到容量
        let engine1Destroyed = false;
        const engine1 = {
            destroy: async () => {
                engine1Destroyed = true;
            },
        } as any;
        const engine2 = {
            destroy: async () => {
            }
        } as any;

        pool.register('thread-old', engine1, 'old-session-id');
        await new Promise(r => setTimeout(r, 5));
        pool.register('thread-new', engine2, 'new-session-id');

        // 池已满
        expect(pool.isAtCapacity()).toBe(true);

        // 淘汰最老的
        const evictable = pool.getEvictable();
        expect(evictable).toBe('thread-old');

        // 释放被淘汰的 engine
        await pool.release(evictable!);

        // 验证 engine 被销毁
        expect(engine1Destroyed).toBe(true);
        expect(pool.has('thread-old')).toBe(false);

        // 验证池有空间了
        expect(pool.isAtCapacity()).toBe(false);

        // 现在 thread-old 的 engine 已被淘汰
        // 下次 dispatch thread-old 时：
        // pool.get('thread-old') 返回 undefined -> 需要创建新 engine
        expect(pool.get('thread-old')).toBeUndefined();

        // 新 engine 创建后会有新的 sdkSessionId
        const newEngine = {
            destroy: async () => {
            }
        } as any;
        const newSessionId = 'brand-new-session-id';
        pool.register('thread-old', newEngine, newSessionId);
        const entry = pool.get('thread-old');
        expect(entry).toBeDefined();
        expect(pool.has('thread-old')).toBe(true);
        expect(entry!.sdkSessionId).toBe(newSessionId);
    });

    test('场景 4: 多个 thread 的 sdkSessionId 互不干扰', async () => {
        /**
         * 场景：多个 thread 各有自己的 engine 和 sdkSessionId
         * 期望：每个 thread 的 sdkSessionId 是独立的
         */
        const pool = new EnginePool({maxConcurrent: 5});

        // 注册 3 个 thread 的 engine
        const engines = [
            {
                threadId: 'thread-A', sdkSessionId: 'sdk-sess-A', engine: {
                    destroy: async () => {
                    }
                } as any
            },
            {
                threadId: 'thread-B', sdkSessionId: 'sdk-sess-B', engine: {
                    destroy: async () => {
                    }
                } as any
            },
            {
                threadId: 'thread-C', sdkSessionId: 'sdk-sess-C', engine: {
                    destroy: async () => {
                    }
                } as any
            },
        ];

        for (const {threadId, engine, sdkSessionId} of engines) {
            pool.register(threadId, engine, sdkSessionId);
        }

        // 验证所有 engine 都在 pool 中，且 sdkSessionId 正确
        for (const {threadId, engine, sdkSessionId} of engines) {
            const entry = pool.get(threadId);
            expect(entry).toBeDefined();
            expect(entry!.engine).toBe(engine);
            expect(entry!.sdkSessionId).toBe(sdkSessionId);
        }

        // 验证 sdkSessionId 独立管理
        expect(engines[0].sdkSessionId).not.toBe(engines[1].sdkSessionId);
        expect(engines[1].sdkSessionId).not.toBe(engines[2].sdkSessionId);
    });

    // ===== LRU 淘汰与 sdkSessionId 清理 =====

    test('淘汰 engine 后对应的 sdkSessionId 映射应被清理', async () => {
        const pool = new EnginePool({maxConcurrent: 3});

        pool.register('t1', {
            destroy: async () => {
            }
        } as any, 'session-1');
        pool.register('t2', {
            destroy: async () => {
            }
        } as any, 'session-2');
        pool.register('t3', {
            destroy: async () => {
            }
        } as any, 'session-3');

        // 淘汰 t1（最老的）
        await pool.release('t1');

        // t1 已不在 pool 中，sdkSessionId 映射也被清理
        expect(pool.has('t1')).toBe(false);
        expect(pool.get('t1')).toBeUndefined();

        // t2、t3 仍在，sdkSessionId 也正确
        expect(pool.has('t2')).toBe(true);
        expect(pool.get('t2')!.sdkSessionId).toBe('session-2');
        expect(pool.has('t3')).toBe(true);
        expect(pool.get('t3')!.sdkSessionId).toBe('session-3');
    });

    test('get 操作更新 LRU 顺序，避免活跃 thread 被淘汰', async () => {
        const pool = new EnginePool({maxConcurrent: 3});

        pool.register('t1', {
            destroy: async () => {
            }
        } as any, 'session-1');
        await new Promise(r => setTimeout(r, 5));
        pool.register('t2', {
            destroy: async () => {
            }
        } as any, 'session-2');
        await new Promise(r => setTimeout(r, 5));
        pool.register('t3', {
            destroy: async () => {
            }
        } as any, 'session-3');

        // 访问 t1（最老的），更新其 LRU 时间
        await new Promise(r => setTimeout(r, 5));
        pool.get('t1');

        // 现在 t2 是最久未访问的
        expect(pool.getEvictable()).toBe('t2');
    });
});
