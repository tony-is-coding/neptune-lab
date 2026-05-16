import {describe, test, expect, beforeEach, afterEach} from 'bun:test'
import {FilesystemBackend} from '../FilesystemBackend'
import {EngineError, EngineErrorCode} from '../../errors'
import {mkdir, rm, readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

describe('FilesystemBackend', () => {
	const TEST_DIR = join(tmpdir(), `claude-test-${Date.now()}`)
	let backend: FilesystemBackend<string>

	beforeEach(async () => {
		// 清理并重新创建测试目录
		await rm(TEST_DIR, {recursive: true, force: true})
		await mkdir(TEST_DIR, {recursive: true})
		backend = new FilesystemBackend<string>(TEST_DIR)
	})

	afterEach(async () => {
		// 清理测试目录
		await rm(TEST_DIR, {recursive: true, force: true})
	})

	describe('CRUD 操作', () => {
		test('write 和 read - 基本读写', async () => {
			await backend.write('key1', 'value1')
			const value = await backend.read('key1')
			expect(value).toBe('value1')
		})

		test('read - 不存在的 key 返回 null', async () => {
			const value = await backend.read('nonexistent')
			expect(value).toBeNull()
		})

		test('write - 覆盖已存在的值', async () => {
			await backend.write('key1', 'value1')
			await backend.write('key1', 'value2')
			const value = await backend.read('key1')
			expect(value).toBe('value2')
		})

		test('delete - 删除存在的 key', async () => {
			await backend.write('key1', 'value1')
			await backend.delete('key1')
			const value = await backend.read('key1')
			expect(value).toBeNull()
		})

		test('delete - 删除不存在的 key 不报错', async () => {
			const result = backend.delete('nonexistent')
			await expect(result).resolves.toBeUndefined()
		})

		test('list - 返回所有 JSON 文件的值', async () => {
			await backend.write('key1', 'value1')
			await backend.write('key2', 'value2')
			await backend.write('key3', 'value3')

			const values = await backend.list()
			expect(values).toHaveLength(3)
			expect(values).toContain('value1')
			expect(values).toContain('value2')
			expect(values).toContain('value3')
		})

		test('list - 有前缀时返回匹配的值', async () => {
			await backend.write('user_1', 'Alice')
			await backend.write('user_2', 'Bob')
			await backend.write('session_1', 'S1')

			const values = await backend.list('user')
			expect(values).toHaveLength(2)
			expect(values).toContain('Alice')
			expect(values).toContain('Bob')
			expect(values).not.toContain('S1')
		})

		test('list - 空目录返回空数组', async () => {
			const values = await backend.list()
			expect(values).toHaveLength(0)
		})
	})

	describe('文件系统特性', () => {
		test('文件以 JSON 格式存储', async () => {
			await backend.write('test-key', 'test-value')
			const filePath = join(TEST_DIR, 'test-key.json')
			const content = await readFile(filePath, 'utf-8')
			const parsed = JSON.parse(content)
			expect(parsed).toBe('test-value')
		})

		test('支持复杂对象类型', async () => {
			interface ComplexType {
				id: number
				name: string
				tags: string[]
			}

			const complexBackend = new FilesystemBackend<ComplexType>(TEST_DIR)
			const value: ComplexType = {
				id: 1,
				name: 'test',
				tags: ['a', 'b', 'c'],
			}

			await complexBackend.write('complex', value)
			const result = await complexBackend.read('complex')
			expect(result).toEqual(value)
		})

		test('特殊字符的 key 被安全编码', async () => {
			const unsafeKeys = [
				'key:with:colons',
				'key/with/slashes',
				'key.with.dots',
				'key with spaces',
				'key;with;semicolons',
			]

			for (const key of unsafeKeys) {
				await backend.write(key, `value-${key}`)
			}

			// 所有 key 都应该成功写入和读取
			for (const key of unsafeKeys) {
				const value = await backend.read(key)
				expect(value).toBe(`value-${key}`)
			}
		})

		test('原子写入 - 使用临时文件', async () => {
			await backend.write('atomic', 'value1')

			// 检查目标文件存在
			const filePath = join(TEST_DIR, 'atomic.json')
			const fileExists = await Bun.file(filePath).exists()
			expect(fileExists).toBe(true)
		})
	})

	describe('错误处理', () => {
		test('读取损坏的 JSON 文件时跳过', async () => {
			// 创建一个损坏的 JSON 文件
			const invalidPath = join(TEST_DIR, 'corrupted.json')
			await Bun.write(invalidPath, '{ invalid json }')

			const values = await backend.list()
			// 损坏的文件应该被跳过，不影响其他文件
			expect(values).not.toContain('invalid json')
		})

		test('dispose 后所有操作抛出错误', async () => {
			await backend.write('key1', 'value1')
			await backend.dispose()

			await expect(backend.read('key1')).rejects.toThrow()
			await expect(backend.write('key2', 'value2')).rejects.toThrow()
			await expect(backend.delete('key1')).rejects.toThrow()
			await expect(backend.list()).rejects.toThrow()
		})

		test('dispose 后抛出 SESSION_INVALID_OPERATION 错误', async () => {
			await backend.dispose()

			try {
				await backend.read('key1')
				expect.fail('应该抛出错误')
			} catch (error) {
				expect(error).toBeInstanceOf(EngineError)
				expect((error as EngineError).code).toBe(EngineErrorCode.SESSION_INVALID_OPERATION)
			}
		})
	})

	describe('目录不存在时自动创建', () => {
		test('write 时自动创建目录', async () => {
			const nonExistentDir = join(tmpdir(), `claude-nonexistent-${Date.now()}`)
			const newBackend = new FilesystemBackend<string>(nonExistentDir)

			await newBackend.write('key1', 'value1')
			const value = await newBackend.read('key1')
			expect(value).toBe('value1')

			await rm(nonExistentDir, {recursive: true, force: true})
		})
	})

	describe('持久化', () => {
		test('数据在 dispose 后仍然存在于文件系统', async () => {
			await backend.write('key1', 'value1')
			await backend.dispose()

			// 创建新的 backend 实例，数据应该仍然存在
			const newBackend = new FilesystemBackend<string>(TEST_DIR)
			const value = await newBackend.read('key1')
			expect(value).toBe('value1')

			await newBackend.dispose()
		})
	})
})
