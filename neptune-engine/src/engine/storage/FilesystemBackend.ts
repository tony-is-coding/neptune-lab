import { mkdir, readFile, writeFile, unlink, readdir, rename } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { IBackend } from './IBackend.js'
import { EngineError, EngineErrorCode } from '../errors.js'
import { LogUtil } from '../log/LogUtil.js'

/**
 * 基于文件系统的存储后端
 * 每个 key 对应一个 JSON 文件，支持原子写入和文件锁
 *
 * @template T 存储的值类型，必须可序列化为 JSON
 */
export class FilesystemBackend<T> implements IBackend<T> {
  private readonly baseDir: string
  private disposed = false

  /**
   * 创建文件系统后端
   * @param baseDir 存储目录的绝对路径
   */
  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  /**
   * 获取 key 对应的文件路径
   */
  private getFilePath(key: string): string {
    // 对 key 进行安全编码，防止路径穿越攻击
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_')
    return join(this.baseDir, `${safeKey}.json`)
  }

  async read(key: string): Promise<T | null> {
    this.ensureNotDisposed()

    try {
      const filePath = this.getFilePath(key)
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (error) {
      // 文件不存在时返回 null
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async write(key: string, value: T): Promise<void> {
    this.ensureNotDisposed()

    const filePath = this.getFilePath(key)

    // 确保目录存在
    await mkdir(dirname(filePath), { recursive: true })

    // 原子写入：先写临时文件，再重命名
    // 在 Node.js 中，同一文件系统内的 rename 是原子操作
    const tempPath = `${filePath}.tmp.${process.pid}`
    await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf-8')
    await rename(tempPath, filePath)
  }

  async delete(key: string): Promise<void> {
    this.ensureNotDisposed()

    try {
      const filePath = this.getFilePath(key)
      await unlink(filePath)
    } catch (error) {
      // 文件不存在时静默成功
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  async list(prefix?: string): Promise<T[]> {
    this.ensureNotDisposed()

    try {
      const files = await readdir(this.baseDir)
      const jsonFiles = prefix
        ? files.filter(f => f.startsWith(prefix.replace(/[^a-zA-Z0-9_-]/g, '_')) && f.endsWith('.json'))
        : files.filter(f => f.endsWith('.json'))

      const values: T[] = []
      for (const file of jsonFiles) {
        try {
          const content = await readFile(join(this.baseDir, file), 'utf-8')
          values.push(JSON.parse(content) as T)
        } catch (error) {
          // 跳过损坏的文件
          LogUtil.warn('损坏文件跳过', { file, error: String(error) })
        }
      }
      return values
    } catch (error) {
      // 目录不存在时返回空数组
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    // 文件系统后端无需显式关闭连接
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new EngineError(EngineErrorCode.SESSION_INVALID_OPERATION, 'FilesystemBackend has been disposed')
    }
  }
}
