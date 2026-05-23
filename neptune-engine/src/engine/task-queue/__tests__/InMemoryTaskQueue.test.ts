import {describe, expect, test} from 'bun:test'

import {InMemoryTaskQueue} from '../InMemoryTaskQueue.js'
import type {TaskEvent} from '../types.js'

describe('InMemoryTaskQueue', () => {
	test('create assigns id, status pending, timestamps', async () => {
		const q = new InMemoryTaskQueue()
		const t = await q.create({title: 'first', createdBy: 'agent-A'})
		expect(t.id).toBeTruthy()
		expect(t.status).toBe('pending')
		expect(t.createdAt).toBe(t.updatedAt)
		expect(t.createdBy).toBe('agent-A')
		expect(t.blockedBy).toEqual([])
		expect(t.dependsOn).toEqual([])
	})

	test('get returns undefined for unknown id', async () => {
		const q = new InMemoryTaskQueue()
		expect(await q.get('nope')).toBeUndefined()
	})

	test('list filters by status', async () => {
		const q = new InMemoryTaskQueue()
		const a = await q.create({title: 'a', createdBy: 'x'})
		await q.create({title: 'b', createdBy: 'x'})
		await q.update(a.id, {status: 'in_progress'})
		const inProgress = await q.list({status: 'in_progress'})
		expect(inProgress.map(t => t.title)).toEqual(['a'])
	})

	test('list filters by owner / hasOwner', async () => {
		const q = new InMemoryTaskQueue()
		const a = await q.create({title: 'a', createdBy: 'x'})
		await q.create({title: 'b', createdBy: 'x', owner: 'B'})
		expect((await q.list({hasOwner: false})).map(t => t.title)).toEqual(['a'])
		expect((await q.list({owner: 'B'})).map(t => t.title)).toEqual(['b'])
		// 把 a 派给 B
		await q.update(a.id, {owner: 'B'})
		expect((await q.list({owner: 'B'})).map(t => t.title).sort()).toEqual([
			'a',
			'b',
		])
	})

	test('update with owner: null clears the owner', async () => {
		const q = new InMemoryTaskQueue()
		const a = await q.create({title: 'a', createdBy: 'x', owner: 'B'})
		const updated = await q.update(a.id, {owner: null})
		expect(updated.owner).toBeUndefined()
	})

	test('update throws on unknown task', async () => {
		const q = new InMemoryTaskQueue()
		await expect(q.update('nope', {status: 'completed'})).rejects.toThrow()
	})

	test('stop transitions task to cancelled', async () => {
		const q = new InMemoryTaskQueue()
		const a = await q.create({title: 'a', createdBy: 'x'})
		await q.stop(a.id, 'aborted by user')
		const after = await q.get(a.id)
		expect(after?.status).toBe('cancelled')
	})

	test('events emits task_created/updated/stopped in order', async () => {
		const q = new InMemoryTaskQueue()
		const ctrl = new AbortController()
		const events: TaskEvent[] = []
		const reader = (async () => {
			for await (const ev of q.events(undefined, ctrl.signal)) {
				events.push(ev)
				if (events.length >= 3) return
			}
		})()
		const a = await q.create({title: 'a', createdBy: 'x'})
		await q.update(a.id, {status: 'in_progress'})
		await q.stop(a.id)
		await reader
		expect(events.map(e => e.type)).toEqual([
			'task_created',
			'task_updated',
			'task_stopped',
		])
		ctrl.abort()
	})

	test('event filter is honored', async () => {
		const q = new InMemoryTaskQueue()
		const ctrl = new AbortController()
		const events: TaskEvent[] = []
		const reader = (async () => {
			for await (const ev of q.events({status: 'in_progress'}, ctrl.signal)) {
				events.push(ev)
				if (events.length >= 1) return
			}
		})()
		const a = await q.create({title: 'a', createdBy: 'x'})
		// 同步发出来的 task_created 不该触发
		await q.update(a.id, {status: 'in_progress'})
		await reader
		expect(events).toHaveLength(1)
		expect(events[0]?.type).toBe('task_updated')
		ctrl.abort()
	})

	test('two queues are isolated (per-session 去全局化)', async () => {
		const a = new InMemoryTaskQueue()
		const b = new InMemoryTaskQueue()
		await a.create({title: 'a-only', createdBy: 'x'})
		expect(await b.list()).toHaveLength(0)
	})
})
