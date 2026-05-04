/**
 * callsite — 调用位置捕获工具
 *
 * 解析 Error().stack 获取调用者的文件路径和行号，
 * 自动跳过 LogUtil 内部栈帧，定位到真正的调用方。
 */

import type { CallSite } from './LogRecord'

/**
 * 需要跳过的内部模块路径关键字。
 * 当栈帧中包含这些路径片段时，说明还在日志系统内部，需要继续向上查找。
 */
const INTERNAL_MARKERS = [
  '/log/LogUtil.',
  '/log/callsite.',
]

/**
 * 捕获调用位置信息
 *
 * 通过 new Error().stack 解析调用栈，跳过日志系统内部帧，
 * 返回真正调用者的文件路径（相对路径）和行号。
 *
 * @returns CallSite 对象，解析失败时返回 undefined
 */
export function captureCallSite(): CallSite | undefined {
  const stack = new Error().stack
  if (!stack) return undefined

  const lines = stack.split('\n')

  for (const line of lines) {
    // 跳过非栈帧行（如 "Error" 标题行）
    if (!line.includes('at ')) continue

    // 跳过日志系统内部帧
    if (INTERNAL_MARKERS.some((marker) => line.includes(marker))) continue

    // 匹配栈帧中的文件路径和行号
    // 格式示例：
    //   at functionName (/absolute/path/to/file.ts:123:45)
    //   at /absolute/path/to/file.ts:123:45
    const match = line.match(/\((.+):(\d+):\d+\)/) ?? line.match(/at (.+):(\d+):\d+/)
    if (!match) continue

    const absolutePath = match[1]
    const lineNumber = parseInt(match[2], 10)

    return {
      file: toRelativePath(absolutePath),
      line: lineNumber,
    }
  }

  return undefined
}

/**
 * 将绝对路径转为相对路径
 *
 * 查找路径中 "src/" 或 "packages/" 的位置作为相对路径起点。
 * 如果都找不到，返回文件名部分。
 */
function toRelativePath(absolutePath: string): string {
  // 优先匹配 src/ 开头
  const srcIndex = absolutePath.indexOf('src/')
  if (srcIndex !== -1) {
    return absolutePath.slice(srcIndex)
  }

  // 其次匹配 packages/ 开头
  const pkgIndex = absolutePath.indexOf('packages/')
  if (pkgIndex !== -1) {
    return absolutePath.slice(pkgIndex)
  }

  // 兜底：返回文件名
  const lastSlash = absolutePath.lastIndexOf('/')
  return lastSlash !== -1 ? absolutePath.slice(lastSlash + 1) : absolutePath
}
