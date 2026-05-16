import {describe, test, expect, beforeEach} from 'bun:test'
import {InMemoryBackend} from '../InMemoryBackend'
import {EngineError, EngineErrorCode} from '../../errors'

describe('InMemoryBackend', () => {
	let backend: InMemoryBackend<string>

	beforeEach(() => {
		backend = new InMemoryBackend<string>()
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

		test('list - 无前缀时返回所有值', async () => {
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
			await backend.write('user:1', 'Alice')
			await backend.write('user:2', 'Bob')
			await backend.write('session:1', 'S1')

			const values = await backend.list('user:')
			expect(values).toHaveLength(2)
			expect(values).toContain('Alice')
			expect(values).toContain('Bob')
			expect(values).not.toContain('S1')
		})

		test('list - 空存储返回空数组', async () => {
			const values = await backend.list()
			expect(values).toHaveLength(0)
		})
	})

	describe('边界条件', () => {
		test('支持复杂类型', async () => {
			interface ComplexType {
				id: number
				name: string
				tags: string[]
			}

			const complexBackend = new InMemoryBackend<ComplexType>()
			const value: ComplexType = {
				id: 1,
				name: 'test',
				tags: ['a', 'b', 'c'],
			}

			await complexBackend.write('complex', value)
			const result = await complexBackend.read('complex')
			expect(result).toEqual(value)
		})

		test('支持 null 和 undefined 作为值', async () => {
			await backend.write('null-key', null as unknown as string)
			await backend.write('undefined-key', undefined as unknown as string)

			expect(await backend.read('null-key')).toBeNull()
			expect(await backend.read('undefined-key')).toBeNull()
		})

		test('支持特殊字符的 key', async () => {
			const specialKeys = ['key:with:colons', 'key/with/slashes', 'key.with.dots', 'key-with-dashes']

			for (const key of specialKeys) {
				await backend.write(key, `value-${key}`)
			}

			for (const key of specialKeys) {
				const value = await backend.read(key)
				expect(value).toBe(`value-${key}`)
			}
		})

		test('list - 空字符串前缀返回所有值', async () => {
			await backend.write('key1', 'value1')
			await backend.write('key2', 'value2')

			const values = await backend.list('')
			expect(values).toHaveLength(2)
		})
	})

	describe('dispose 状态管理', () => {
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

		test('dispose 清空存储', async () => {
			await backend.write('key1', 'value1')
			await backend.dispose()

			expect(backend.size).toBe(0)
		})

		test('多次 dispose 不报错', async () => {
			await backend.dispose()
			const result = backend.dispose()
			await expect(result).resolves.toBeUndefined()
		})
	})

	describe('测试辅助方法', () => {
		test('size - 返回存储大小', async () => {
			expect(backend.size).toBe(0)

			await backend.write('key1', 'value1')
			expect(backend.size).toBe(1)

			await backend.write('key2', 'value2')
			expect(backend.size).toBe(2)

			await backend.delete('key1')
			expect(backend.size).toBe(1)
		})

		test('has - 检查 key 是否存在', async () => {
			expect(backend.has('key1')).toBe(false)

			await backend.write('key1', 'value1')
			expect(backend.has('key1')).toBe(true)

			await backend.delete('key1')
			expect(backend.has('key1')).toBe(false)
		})
	})

	describe('并发操作', () => {
		test('并发写入不同的 key', async () => {
			const promises = []
			for (let i = 0; i < 100; i++) {
				promises.push(backend.write(`key${i}`, `value${i}`))
			}
			await Promise.all(promises)

			expect(backend.size).toBe(100)
		})

		test('并发读取', async () => {
			await backend.write('key1', 'value1')

			const promises = []
			for (let i = 0; i < 10; i++) {
				promises.push(backend.read('key1'))
			}
			const results = await Promise.all(promises)

			expect(results.every(r => r === 'value1')).toBe(true)
		})
	})
})
