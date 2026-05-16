import {describe, test, expect, beforeEach} from 'bun:test';

describe('EnginePool', () => {
    // 测试 1: 创建池实例
    test('should create pool with maxConcurrent config', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 3});
        expect(pool.getActiveCount()).toBe(0);
    });

    // 测试 2: 注册和获取 engine
    test('should register and retrieve engine by threadId', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 2});
        const mockEngine = {
            destroy: async () => {
            }
        } as any;
        const mockSessionId = 'session-abc-123';
        pool.register('thread-1', mockEngine, mockSessionId);
        const entry = pool.get('thread-1');
        expect(entry?.engine).toBe(mockEngine);
        expect(entry?.sdkSessionId).toBe(mockSessionId);
        expect(pool.getActiveCount()).toBe(1);
    });

    // 测试 3: 释放 engine
    test('should release engine and call destroy', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 2});
        let destroyed = false;
        const mockEngine = {
            destroy: async () => {
                destroyed = true;
            }
        } as any;
        pool.register('thread-1', mockEngine, 'session-xyz');
        await pool.release('thread-1');
        expect(pool.get('thread-1')).toBeUndefined();
        expect(destroyed).toBe(true);
        expect(pool.getActiveCount()).toBe(0);
    });

    // 测试 4: 超出并发限制时返回需要淘汰的 threadId
    test('should identify evictable thread when at capacity', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 2});
        pool.register('thread-1', {
            destroy: async () => {
            }
        } as any, 'session-1');
        // 给第二个 engine 稍后注册的时间差
        await new Promise(r => setTimeout(r, 5));
        pool.register('thread-2', {
            destroy: async () => {
            }
        } as any, 'session-2');
        // 已满，应返回最老的 threadId 用于淘汰
        const evictable = pool.getEvictable();
        expect(evictable).toBe('thread-1'); // FIFO: 最先注册的最先淘汰
    });

    // 测试 5: has() 检查
    test('should check if engine exists for thread', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 5});
        expect(pool.has('thread-1')).toBe(false);
        pool.register('thread-1', {
            destroy: async () => {
            }
        } as any, 'session-1');
        expect(pool.has('thread-1')).toBe(true);
    });

    // 测试 6: isAtCapacity 判断
    test('should report when pool is at capacity', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 2});
        expect(pool.isAtCapacity()).toBe(false);
        pool.register('thread-1', {
            destroy: async () => {
            }
        } as any, 'session-1');
        expect(pool.isAtCapacity()).toBe(false);
        pool.register('thread-2', {
            destroy: async () => {
            }
        } as any, 'session-2');
        expect(pool.isAtCapacity()).toBe(true);
    });

    // 测试 7: get 会更新 lastActivity（LRU 行为）
    test('should update activity on get (LRU behavior)', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 3});
        pool.register('thread-1', {
            destroy: async () => {
            }
        } as any, 'session-1');
        await new Promise(r => setTimeout(r, 5));
        pool.register('thread-2', {
            destroy: async () => {
            }
        } as any, 'session-2');
        await new Promise(r => setTimeout(r, 5));
        pool.register('thread-3', {
            destroy: async () => {
            }
        } as any, 'session-3');

        // thread-1 最老，但 get 会 touch 它
        await new Promise(r => setTimeout(r, 5));
        pool.get('thread-1');

        // 现在 thread-2 应该是最老的（最近没被访问）
        expect(pool.getEvictable()).toBe('thread-2');
    });

    // 测试 8: release 不存在的 thread 不报错
    test('should handle release of non-existent thread gracefully', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 2});
        // 不应抛出异常
        await pool.release('non-existent');
        expect(pool.getActiveCount()).toBe(0);
    });

    // 测试 9: engine destroy 失败时仍能清理 pool 状态
    test('should clean up pool even if engine destroy fails', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 2});
        const faultyEngine = {
            destroy: async () => {
                throw new Error('destroy failed');
            },
        } as any;
        pool.register('thread-1', faultyEngine, 'session-1');
        // 不应抛出异常，且 pool 状态应被清理
        await pool.release('thread-1');
        expect(pool.get('thread-1')).toBeUndefined();
        expect(pool.getActiveCount()).toBe(0);
    });

    // 测试 10: getActiveThreadIds 返回所有活跃 thread
    test('should list all active thread IDs', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 5});
        pool.register('thread-1', {
            destroy: async () => {
            }
        } as any, 'session-1');
        pool.register('thread-2', {
            destroy: async () => {
            }
        } as any, 'session-2');
        pool.register('thread-3', {
            destroy: async () => {
            }
        } as any, 'session-3');
        const ids = pool.getActiveThreadIds();
        expect(ids).toContain('thread-1');
        expect(ids).toContain('thread-2');
        expect(ids).toContain('thread-3');
        expect(ids.length).toBe(3);
    });

    // 测试 11: sdkSessionId 正确保存和返回
    test('should store and return sdkSessionId correctly', async () => {
        const {EnginePool} = await import('../src/services/engine-pool');
        const pool = new EnginePool({maxConcurrent: 2});
        const mockEngine = {
            destroy: async () => {
            }
        } as any;
        const sdkSessionId = 'abc-123-session-id';
        pool.register('thread-1', mockEngine, sdkSessionId);

        const entry = pool.get('thread-1');
        expect(entry).toBeDefined();
        expect(entry!.sdkSessionId).toBe(sdkSessionId);
        expect(entry!.engine).toBe(mockEngine);
    });
});
