/**
 * InMemoryChannel.test.ts — Stage 4.2 Channel 协议单测
 */

import {describe, expect, it} from 'bun:test'
import {InMemoryChannel} from '../index.js'

describe('InMemoryChannel — send / receive', () => {
	it('send + receive FIFO 单播', async () => {
		const ch = new InMemoryChannel<string>()
		await ch.send('agent-a', 'hello')
		expect(await ch.receive('agent-a')).toBe('hello')
	})

	it('receive 无消息 → null', async () => {
		const ch = new InMemoryChannel<string>()
		expect(await ch.receive('agent-a')).toBeNull()
	})

	it('FIFO 顺序：多次 send 后多次 receive', async () => {
		const ch = new InMemoryChannel<number>()
		for (let i = 0; i < 5; i++) await ch.send('q', i)
		const out: number[] = []
		while (true) {
			const r = await ch.receive('q')
			if (r === null) break
			out.push(r)
		}
		expect(out).toEqual([0, 1, 2, 3, 4])
	})

	it('不同 target 隔离', async () => {
		const ch = new InMemoryChannel<string>()
		await ch.send('a', 'msg-a')
		await ch.send('b', 'msg-b')
		expect(await ch.receive('a')).toBe('msg-a')
		expect(await ch.receive('b')).toBe('msg-b')
		expect(await ch.receive('a')).toBeNull()
	})

	it('receive 消费后队列空', async () => {
		const ch = new InMemoryChannel<string>()
		await ch.send('a', 'x')
		expect(await ch.receive('a')).toBe('x')
		expect(await ch.receive('a')).toBeNull()
	})
})

describe('InMemoryChannel — subscribe stream', () => {
	it('subscribe 之后的 send 被 stream yield', async () => {
		const ch = new InMemoryChannel<string>()
		const iter = ch.subscribe('topic')[Symbol.asyncIterator]()
		// 在另一个 microtask send
		setTimeout(() => {
			void ch.send('topic', 'first')
			void ch.send('topic', 'second')
		}, 0)
		const r1 = await iter.next()
		expect(r1.value).toBe('first')
		const r2 = await iter.next()
		expect(r2.value).toBe('second')
		await iter.return?.()
	})

	it('多个订阅者各自看到所有消息（fan-out）', async () => {
		const ch = new InMemoryChannel<number>()
		const iter1 = ch.subscribe('topic')[Symbol.asyncIterator]()
		const iter2 = ch.subscribe('topic')[Symbol.asyncIterator]()
		setTimeout(() => {
			void ch.send('topic', 42)
		}, 0)
		const r1 = await iter1.next()
		const r2 = await iter2.next()
		expect(r1.value).toBe(42)
		expect(r2.value).toBe(42)
		await iter1.return?.()
		await iter2.return?.()
	})

	it('subscribe 完成（return）→ 后续 send 不再 yield', async () => {
		const ch = new InMemoryChannel<number>()
		const iter = ch.subscribe('t')[Symbol.asyncIterator]()
		setTimeout(() => void ch.send('t', 1), 0)
		const r1 = await iter.next()
		expect(r1.value).toBe(1)
		await iter.return?.()
		// send after return
		await ch.send('t', 999)
		// 重新订阅看不到 999（因为是新订阅，且 999 不在队列里只在 broadcast）
		const iter2 = ch.subscribe('t')[Symbol.asyncIterator]()
		setTimeout(() => void ch.send('t', 1000), 0)
		const r2 = await iter2.next()
		expect(r2.value).toBe(1000) // 看到的是新 send 的
		await iter2.return?.()
	})

	it('send + receive vs subscribe 独立：subscribe 不消耗 receive 队列', async () => {
		const ch = new InMemoryChannel<string>()
		const iter = ch.subscribe('t')[Symbol.asyncIterator]()
		setTimeout(() => void ch.send('t', 'msg1'), 0)
		const fromSub = await iter.next()
		expect(fromSub.value).toBe('msg1')
		// receive 仍能拿到这条消息
		expect(await ch.receive('t')).toBe('msg1')
		await iter.return?.()
	})

	it('subscribe 在订阅前已有的消息不重放（仅订阅期间的）', async () => {
		const ch = new InMemoryChannel<string>()
		await ch.send('t', 'before-subscribe')
		const iter = ch.subscribe('t')[Symbol.asyncIterator]()
		setTimeout(() => void ch.send('t', 'after-subscribe'), 0)
		const r = await iter.next()
		expect(r.value).toBe('after-subscribe')
		await iter.return?.()
	})

	it('dispose 清空所有 queue + subscribers', async () => {
		const ch = new InMemoryChannel<string>()
		await ch.send('t', 'x')
		await ch.dispose()
		expect(await ch.receive('t')).toBeNull()
	})
})
