/**
 * DefaultOffloadStrategy — 默认的上下文卸载策略
 *
 * 基于文件系统的卸载实现：
 * - 当工具输出超过阈值时，将完整输出写入临时文件
 * - 保留前 5 行作为预览摘要
 * - 文件按 sessionId 隔离存储
 *
 * @internal 预留接口，待上下文卸载集成后使用
 *
 * 设计原则：
 * - 简单可靠：使用 Node.js fs/promises API，无额外依赖
 * - 可配置：支持自定义阈值和存储目录
 * - 安全隔离：每个 session 独立目录
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { OffloadStrategy, OffloadResult } from './OffloadStrategy.js'

// ============================================================
// DefaultOffloadStrategy 实现
// ============================================================

/**
 * 默认的上下文卸载策略
 *
 * 当工具输出超过指定阈值时，将完整输出写入文件系统，
 * 仅保留前 5 行作为预览摘要。
 */
export class DefaultOffloadStrategy implements OffloadStrategy {
  private readonly threshold: number
  private readonly baseDir: string

  /**
   * @param threshold 卸载阈值（字节数），默认 10000
   * @param baseDir 卸载文件的根目录，默认使用系统临时目录
   */
  constructor(threshold = 10000, baseDir?: string) {
    this.threshold = threshold
    this.baseDir = baseDir ?? join(tmpdir(), 'agent-engine-offload')
  }

  /**
   * 判断是否需要卸载
   *
   * 当输出长度超过阈值时返回 true。
   *
   * @param _toolName 工具名称（当前未使用，保留用于策略扩展）
   * @param outputLength 输出长度（字节数）
   * @returns 是否需要卸载
   */
  shouldOffload(_toolName: string, outputLength: number): boolean {
    return outputLength > this.threshold
  }

  /**
   * 执行卸载操作
   *
   * 将完整输出写入文件，返回包含预览摘要的结果。
   * 文件按 sessionId 隔离存储在独立子目录中。
   *
   * @param sessionId 会话 ID
   * @param toolName 工具名称
   * @param output 完整的工具输出
   * @returns 卸载结果
   */
  async offload(sessionId: string, toolName: string, output: string): Promise<OffloadResult> {
    const dir = join(this.baseDir, sessionId)
    await mkdir(dir, { recursive: true })
    const fileName = `${toolName}-${Date.now()}.txt`
    const filePath = join(dir, fileName)
    await writeFile(filePath, output, 'utf-8')

    const lines = output.split('\n')
    const summaryLines = lines.slice(0, 5)
    const summary = `[Offloaded to ${filePath}]\nPreview:\n${summaryLines.join('\n')}\n... (${lines.length} lines total)`

    return { filePath, summary, originalSize: output.length }
  }
}
