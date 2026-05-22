/**
 * 通用存储后端接口
 * 提供基本的 CRUD 操作，支持任意类型的值存储
 *
 * @template T 存储的值类型
 */
export interface IBackend<T> {
	/**
	 * 读取指定 key 的值
	 * @param key 存储键
	 * @returns 存储的值，不存在时返回 null
	 */
	read(key: string): Promise<T | null>

	/**
	 * 写入指定 key 的值
	 * @param key 存储键
	 * @param value 要存储的值
	 */
	write(key: string, value: T): Promise<void>

	/**
	 * 删除指定 key
	 * @param key 存储键
	 */
	delete(key: string): Promise<void>

	/**
	 * 列出所有存储的值
	 * @param prefix 可选的前缀过滤，仅返回 key 以该前缀开头的值
	 * @returns 所有符合条件的值数组
	 */
	list(prefix?: string): Promise<T[]>

	/**
	 * 释放资源，关闭连接
	 * 对于文件系统后端，确保所有缓冲写入完成
	 * 对于网络后端，关闭连接
	 */
	dispose(): Promise<void>
}
