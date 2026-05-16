/**
 * Mailbox 解耦测试
 *
 * 验证 Mailbox 类可以独立于 React 使用，零 React 依赖。
 */

import {describe, test, expect} from 'bun:test'
import {Mailbox} from '../mailbox.js'

describe('Mailbox (零 React 依赖)', () => {
	test('应该能够创建 Mailbox 实例而不需要 React', () => {
		const mailbox = new Mailbox()
		expect(mailbox).toBeDefined()
		expect(mailbox.length).toBe(0)
		expect(mailbox.revision).toBe(0)
	})

	test('应该能够发送和接收消息', async () => {
		const mailbox = new Mailbox()

		// 发送消息
		mailbox.send({
			id: '1',
			source: 'user',
			content: 'Hello',
			timestamp: new Date().toISOString(),
		})

		expect(mailbox.length).toBe(1)
		expect(mailbox.revision).toBe(1)

		// 接收消息
		const msg = await mailbox.receive()
		expect(msg.content).toBe('Hello')
		expect(mailbox.length).toBe(0)
	})

	test('应该能够轮询消息', () => {
		const mailbox = new Mailbox()

		mailbox.send({
			id: '1',
			source: 'system',
			content: 'Test',
			timestamp: new Date().toISOString(),
		})

		const msg = mailbox.poll()
		expect(msg).toBeDefined()
		expect(msg?.content).toBe('Test')

		// 第二次轮询应该返回 undefined
		const msg2 = mailbox.poll()
		expect(msg2).toBeUndefined()
	})

	test('应该能够订阅消息变更', () => {
		const mailbox = new Mailbox()
		let callCount = 0

		const unsubscribe = mailbox.subscribe(() => {
			callCount++
		})

		// 发送消息应该触发订阅
		mailbox.send({
			id: '1',
			source: 'user',
			content: 'Test',
			timestamp: new Date().toISOString(),
		})

		expect(callCount).toBe(1)

		// 取消订阅
		unsubscribe()

		// 再次发送消息不应该触发订阅
		mailbox.send({
			id: '2',
			source: 'user',
			content: 'Test 2',
			timestamp: new Date().toISOString(),
		})

		expect(callCount).toBe(1)
	})

	test('应该能够通过条件等待特定消息', async () => {
		const mailbox = new Mailbox()

		// 发送多条消息
		mailbox.send({
			id: '1',
			source: 'user',
			content: 'First',
			timestamp: new Date().toISOString(),
		})

		mailbox.send({
			id: '2',
			source: 'system',
			content: 'Second',
			timestamp: new Date().toISOString(),
		})

		// 等待特定消息
		const msg = await mailbox.receive(m => m.source === 'system')
		expect(msg.content).toBe('Second')
	})

	test('应该能够处理等待者和队列的交互', async () => {
		const mailbox = new Mailbox()

		// 先设置等待者
		const promise = mailbox.receive(m => m.source === 'system')

		// 然后发送匹配的消息
		mailbox.send({
			id: '1',
			source: 'system',
			content: 'Matched',
			timestamp: new Date().toISOString(),
		})

		const msg = await promise
		expect(msg.content).toBe('Matched')
		expect(mailbox.length).toBe(0) // 匹配的消息不应该进入队列
	})
})

describe('Mailbox 零 React 依赖验证', () => {
	test('Mailbox 类不应该导入任何 React 模块', () => {
		// 这个测试验证 Mailbox 类的定义文件不包含 React 导入
		const fs = require('fs')
		const mailboxSource = fs.readFileSync('src/utils/mailbox.ts', 'utf-8')

		// 不应该包含 React 相关的导入
		expect(mailboxSource).not.toContain('from \'react\'')
		expect(mailboxSource).not.toContain('from \'react\'')
		expect(mailboxSource).not.toContain('useState')
		expect(mailboxSource).not.toContain('useEffect')
		expect(mailboxSource).not.toContain('createContext')
		expect(mailboxSource).not.toContain('useContext')
	})
})
