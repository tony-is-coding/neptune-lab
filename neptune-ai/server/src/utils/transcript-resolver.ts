/**
 * Transcript 文件定位工具
 *
 * SDK 将 transcript 存储在 ~/.claude/projects/{sanitized-workspace}/{sdkSessionId}.jsonl
 * 而不是 workspace/transcript.jsonl
 *
 * 此模块复用 SDK 的路径逻辑，正确定位 transcript 文件。
 */

import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readdirSync, statSync } from 'fs';

/**
 * 将 workspace 路径 sanitize 为安全的目录名（与 SDK 运行时行为一致）
 * 实际行为：/ → -，_ → -，保留开头的 -
 */
function sanitizePath(workspace: string): string {
  return workspace
    .replace(/[/\\_]/g, '-');  // 斜杠、反斜杠、下划线 → 连字符
}

/**
 * 获取 SDK 的 session 存储目录
 */
function getSessionStoragePath(workspace: string): string {
  const sanitized = sanitizePath(workspace);
  return join(homedir(), '.claude', 'projects', sanitized);
}

/**
 * 定位 transcript JSONL 文件
 *
 * 查找顺序：
 * 1. SDK 存储路径 ~/.claude/projects/{sanitized-workspace}/ 下所有 .jsonl 文件（按时间排序）
 * 2. workspace/transcript.jsonl（旧逻辑 fallback）
 *
 * 返回文件绝对路径数组（按时间升序），找不到返回空数组
 */
export function resolveTranscriptPaths(workspace: string): string[] {
  const paths: string[] = [];

  // 1. SDK 存储路径
  const storagePath = getSessionStoragePath(workspace);
  try {
    if (existsSync(storagePath)) {
      const files = readdirSync(storagePath)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          path: join(storagePath, f),
          mtime: statSync(join(storagePath, f)).mtimeMs,
        }))
        .sort((a, b) => a.mtime - b.mtime); // 按时间升序（旧的在前）

      for (const f of files) {
        paths.push(f.path);
      }
    }
  } catch {
    // 存储路径不存在或无法读取
  }

  // 2. Fallback: workspace/transcript.jsonl
  if (paths.length === 0) {
    const localTranscript = join(workspace, 'transcript.jsonl');
    if (existsSync(localTranscript)) {
      paths.push(localTranscript);
    }
  }

  return paths;
}

/**
 * 兼容旧接口：返回最新的单个文件路径
 */
export function resolveTranscriptPath(workspace: string): string | null {
  const paths = resolveTranscriptPaths(workspace);
  return paths.length > 0 ? paths[paths.length - 1] : null;
}
