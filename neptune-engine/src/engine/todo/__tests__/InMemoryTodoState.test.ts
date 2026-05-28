import {describe, expect, test} from 'bun:test'

import {InMemoryTodoState} from '../InMemoryTodoState.js'
import type {TodoEvent, TodoItem} from '../types.js'

const item = (id: string, status: TodoItem['status'] = 'pending'): TodoItem => ({
	id,
	content: `c-${id}`,
	status,
})

describe('InMemoryTodoState', () => {
	test('replace updates current snapshot', async () => {
		const s = new InMemoryTodoState()
		expect(s.current()).toEqual([])
		await s.replace([item('a'), item('b')])
		expect(s.current().map(i => i.id)).toEqual(['a', 'b'])
	})

	test('emits item_added events on first replace', async () => {
		const s = new InMemoryTodoState()
		const events: TodoEvent[] = []
		const ctrl = new AbortController()
		const reader = (async () => {
			for await (const ev of s.events(ctrl.signal)) {
				events.push(ev)
				if (events.length >= 3) return
			}
		})()

		await s.replace([item('a'), item('b')])
		await reader

		expect(events.filter(e => e.type === 'item_added')).toHaveLength(2)
		expect(events[events.length - 1]?.type).toBe('replaced')
		ctrl.abort()
	})

	test('emits status change events on subsequent replace', async () => {
		const s = new InMemoryTodoState()
		await s.replace([item('a', 'pending')])

		const events: TodoEvent[] = []
		const ctrl = new AbortController()
		const reader = (async () => {
			for await (const ev of s.events(ctrl.signal)) {
				events.push(ev)
				if (events.some(e => e.type === 'replaced')) return
			}
		})()

		await s.replace([item('a', 'in_progress')])
		await reader

		const change = events.find(e => e.type === 'item_status_changed')
		expect(change).toBeDefined()
		if (change?.type === 'item_status_changed') {
			expect(change.from).toBe('pending')
			expect(change.to).toBe('in_progress')
		}
		ctrl.abort()
	})

	test('emits item_removed events when items disappear', async () => {
		const s = new InMemoryTodoState()
		await s.replace([item('a'), item('b')])

		const events: TodoEvent[] = []
		const ctrl = new AbortController()
		const reader = (async () => {
			for await (const ev of s.events(ctrl.signal)) {
				events.push(ev)
				if (events.some(e => e.type === 'replaced')) return
			}
		})()

		await s.replace([item('a')])
		await reader

		expect(events.find(e => e.type === 'item_removed' && e.id === 'b')).toBeDefined()
		ctrl.abort()
	})

	test('two state instances are isolated (per-session 去全局化)', async () => {
		const a = new InMemoryTodoState()
		const b = new InMemoryTodoState()
		await a.replace([item('only-in-a')])
		expect(b.current()).toEqual([])
	})

	test('events() iterator ends after abort signal', async () => {
		const s = new InMemoryTodoState()
		const ctrl = new AbortController()
		const reader = (async () => {
			const out: TodoEvent[] = []
			for await (const ev of s.events(ctrl.signal)) {
				out.push(ev)
			}
			return out
		})()
		ctrl.abort()
		const result = await reader
		expect(result).toEqual([])
	})
})
