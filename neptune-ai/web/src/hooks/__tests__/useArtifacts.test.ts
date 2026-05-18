import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useArtifacts } from '../useArtifacts';
import type { ChatMessage } from '../../types/chat';

describe('useArtifacts', () => {
  it('returns empty array when no messages', () => {
    const { result } = renderHook(() => useArtifacts([]));
    expect(result.current).toEqual([]);
  });

  it('returns empty array when messages have no artifacts', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        blocks: [{ type: 'text', content: 'hello' }],
        status: 'complete',
        createdAt: '2025-05-13T10:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        blocks: [{ type: 'text', content: 'hi there' }],
        status: 'complete',
        createdAt: '2025-05-13T10:00:01Z',
      },
    ];
    const { result } = renderHook(() => useArtifacts(messages));
    expect(result.current).toEqual([]);
  });

  it('extracts artifacts from messages with correct metadata', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        blocks: [
          { type: 'text', content: 'Here is the report' },
          { type: 'artifact', id: 'art-1', title: 'report.md', fileType: '.md', content: '# Report\n\nContent here' },
        ],
        status: 'complete',
        createdAt: '2025-05-13T10:00:00Z',
      },
    ];
    const { result } = renderHook(() => useArtifacts(messages));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('art-1');
    expect(result.current[0].title).toBe('report.md');
    expect(result.current[0].fileType).toBe('.md');
    expect(result.current[0].content).toBe('# Report\n\nContent here');
    expect(result.current[0].size).toBeGreaterThan(0);
    expect(result.current[0].createdAt).toBe('2025-05-13T10:00:00Z');
  });

  it('extracts multiple artifacts across multiple messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        blocks: [
          { type: 'artifact', id: 'art-1', title: 'file1.html', fileType: '.html', content: '<h1>Hello</h1>' },
        ],
        status: 'complete',
        createdAt: '2025-05-13T10:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        blocks: [
          { type: 'text', content: 'Another response' },
          { type: 'artifact', id: 'art-2', title: 'data.csv', fileType: '.csv', content: 'a,b,c\n1,2,3' },
          { type: 'artifact', id: 'art-3', title: 'code.py', fileType: '.py', content: 'print("hello")' },
        ],
        status: 'complete',
        createdAt: '2025-05-13T11:00:00Z',
      },
    ];
    const { result } = renderHook(() => useArtifacts(messages));

    expect(result.current).toHaveLength(3);
    expect(result.current[0].id).toBe('art-1');
    expect(result.current[1].id).toBe('art-2');
    expect(result.current[2].id).toBe('art-3');
    // Each artifact inherits createdAt from its parent message
    expect(result.current[0].createdAt).toBe('2025-05-13T10:00:00Z');
    expect(result.current[1].createdAt).toBe('2025-05-13T11:00:00Z');
  });

  it('computes file size correctly for multi-byte content', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        blocks: [
          { type: 'artifact', id: 'art-1', title: '报告.md', fileType: '.md', content: '中文内容测试' },
        ],
        status: 'complete',
      },
    ];
    const { result } = renderHook(() => useArtifacts(messages));

    // Chinese characters are 3 bytes each in UTF-8
    expect(result.current[0].size).toBe(new Blob(['中文内容测试']).size);
    expect(result.current[0].size).toBeGreaterThan(6); // More than 6 bytes for 6 chars
  });

  it('handles missing createdAt gracefully', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        blocks: [
          { type: 'artifact', id: 'art-1', title: 'test.js', fileType: '.js', content: 'const x = 1;' },
        ],
        status: 'complete',
        // no createdAt
      },
    ];
    const { result } = renderHook(() => useArtifacts(messages));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].createdAt).toBeUndefined();
  });
});
