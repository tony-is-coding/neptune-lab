/**
 * SessionStoragePath — workspace 到存储路径的映射
 *
 * 将 workspace 路径映射到 ~/.claude/projects/{sanitized-workspace}/
 * sanitize 逻辑：将 / 和 \ 替换为 -，去掉开头的 -
 */

import { join } from 'path'
import { homedir } from 'os'

/**
 * 将 workspace 路径 sanitize 为安全的目录名
 * 规则：斜杠和反斜杠替换为连字符，去掉开头的连字符
 */
function sanitizePath(workspace: string): string {
  return workspace
    .replace(/[/\\]/g, '-')  // 斜杠、反斜杠 → 连字符
    .replace(/^-+/, '')       // 去掉开头的连字符
}

/**
 * 根据 workspace 路径返回对应的 session 存储目录
 * 返回 ~/.claude/projects/{sanitized-workspace}/
 */
export function getSessionStoragePath(workspace: string): string {
  const sanitized = sanitizePath(workspace)
  return join(homedir(), '.claude', 'projects', sanitized)
}
