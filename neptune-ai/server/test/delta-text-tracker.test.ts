/**
 * DeltaTextTracker 单元测试
 *
 * 验证增量文本跟踪器的正确性：
 * - 正常追加场景
 * - 文本重置场景
 * - 空增量跳过
 */

import { describe, test, expect } from 'bun:test';
import { DeltaTextTracker } from '../src/services/sse-event-mapper';

describe('DeltaTextTracker', () => {
  test('第一次调用返回完整文本（非增量）', () => {
    const tracker = new DeltaTextTracker();
    const result = tracker.getDelta('Hello');

    expect(result).toBe('Hello');
    // 第一次调用，返回值 === 完整文本，表示这是完整文本而非增量
  });

  test('后续追加返回增量部分', () => {
    const tracker = new DeltaTextTracker();

    tracker.getDelta('Hello');
    const delta2 = tracker.getDelta('Hello World');
    const delta3 = tracker.getDelta('Hello World!');

    expect(delta2).toBe(' World');
    expect(delta3).toBe('!');
  });

  test('无变化时返回 null', () => {
    const tracker = new DeltaTextTracker();

    tracker.getDelta('Hello');
    const delta2 = tracker.getDelta('Hello');

    expect(delta2).toBe(null);
  });

  test('文本重置场景（新消息）', () => {
    const tracker = new DeltaTextTracker();

    // 第一条消息
    tracker.getDelta('First message');

    // 模拟新消息开始：重置
    tracker.reset();

    // 第二条消息（不包含第一条的内容）
    const delta = tracker.getDelta('Second message');

    expect(delta).toBe('Second message');
    // 返回值 === 完整文本，表示这是新消息的完整文本
  });

  test('中文增量计算', () => {
    const tracker = new DeltaTextTracker();

    tracker.getDelta('你好');
    const delta2 = tracker.getDelta('你好世界');
    const delta3 = tracker.getDelta('你好世界！');

    expect(delta2).toBe('世界');
    expect(delta3).toBe('！');
  });

  test('空字符串处理', () => {
    const tracker = new DeltaTextTracker();

    const delta1 = tracker.getDelta('');
    expect(delta1).toBe('');

    const delta2 = tracker.getDelta('Hello');
    expect(delta2).toBe('Hello');
  });

  test('连续相同内容只返回一次', () => {
    const tracker = new DeltaTextTracker();

    const delta1 = tracker.getDelta('Same');
    expect(delta1).toBe('Same');

    const delta2 = tracker.getDelta('Same');
    expect(delta2).toBe(null);

    const delta3 = tracker.getDelta('Same');
    expect(delta3).toBe(null);
  });
});
