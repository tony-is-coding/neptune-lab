/**
 * 集成测试 — kernel-protocol-backed tools 能与 engine 默认 InMemory*
 * 实现端到端协作：model 调工具 → 工具读 ctx.kernel.<protocol> → 调
 * Phase A 落地的协议方法 → 返回正确结果。
 *
 * 没有这些测试，"工具薄壳 + 协议默认实现"两侧的协约会随时间漂移而无人察觉。
 */

import {describe, expect, test} from 'bun:test'

import {
	InMemoryMemoryStore,
	InMemorySkillRegistry,
	InMemoryTaskQueue,
	InMemoryTodoState,
	InMemoryToolRegistry,
} from '@neptune/engine'

import type {KernelToolContext} from '../../../kernel-context.js'
import {DiscoverSkillsTool} from '../DiscoverSkillsTool.js'
import {MemoryRecallTool} from '../MemoryRecallTool.js'
import {MemoryWriteTool} from '../MemoryWriteTool.js'
import {TaskCreateTool} from '../TaskCreateTool.js'
import {TaskGetTool} from '../TaskGetTool.js'
import {TaskListTool} from '../TaskListTool.js'
import {TaskOutputTool} from '../TaskOutputTool.js'
import {TaskStopTool} from '../TaskStopTool.js'
import {TaskUpdateTool} from '../TaskUpdateTool.js'
import {TodoWriteTool} from '../TodoWriteTool.js'
import {ToolSearchTool} from '../ToolSearchTool.js'

function ctx(extra: Partial<KernelToolContext> = {}): KernelToolContext {
	return {
		kernel: {
			skillRegistry: new InMemorySkillRegistry(),
			todoState: new InMemoryTodoState(),
			taskQueue: new InMemoryTaskQueue(),
			toolRegistry: new InMemoryToolRegistry(),
			memoryStore: new InMemoryMemoryStore(),
		},
		...extra,
	}
}

describe('TodoWriteTool', () => {
	test('replaces session todo state', async () => {
		const c = ctx()
		const result = await (TodoWriteTool as any).call(
			{
				items: [
					{id: '1', content: 'one', status: 'pending'},
					{id: '2', content: 'two', status: 'in_progress'},
				],
			},
			c,
		)
		expect(result.data.count).toBe(2)
		expect(c.kernel?.todoState?.current().map(i => i.id)).toEqual(['1', '2'])
	})

	test('throws when host did not inject todoState', async () => {
		await expect(
			(TodoWriteTool as any).call({items: []}, {kernel: {}}),
		).rejects.toThrow(/todoState/)
	})
})

describe('Task* tools end-to-end', () => {
	test('create -> get -> list -> update -> output -> stop full lifecycle', async () => {
		const c = ctx({agentId: 'agent-A'})
		const created = await (TaskCreateTool as any).call(
			{title: 'first', description: 'do x'},
			c,
		)
		const id = created.data.id

		const got = await (TaskGetTool as any).call({id}, c)
		expect(got.data?.title).toBe('first')

		const listed = await (TaskListTool as any).call({}, c)
		expect(listed.data.map((t: {id: string}) => t.id)).toContain(id)

		const updated = await (TaskUpdateTool as any).call(
			{id, status: 'in_progress', owner: 'agent-B'},
			c,
		)
		expect(updated.data.status).toBe('in_progress')
		expect(updated.data.owner).toBe('agent-B')

		const out = await (TaskOutputTool as any).call(
			{id, summary: 'done', markCompleted: true},
			c,
		)
		expect(out.data.status).toBe('completed')
		expect(out.data.output?.summary).toBe('done')

		await (TaskStopTool as any).call({id, reason: 're-cancel'}, c)
		const final = await (TaskGetTool as any).call({id}, c)
		expect(final.data?.status).toBe('cancelled')
	})

	test('TaskCreate sets createdBy to ctx.agentId', async () => {
		const c = ctx({agentId: 'whoami'})
		const created = await (TaskCreateTool as any).call({title: 'x'}, c)
		const got = await (TaskGetTool as any).call({id: created.data.id}, c)
		expect(got.data?.createdBy).toBe('whoami')
	})

	test('TaskList honors filter shape from input schema', async () => {
		const c = ctx()
		const a = await (TaskCreateTool as any).call({title: 'a'}, c)
		const b = await (TaskCreateTool as any).call({title: 'b'}, c)
		await (TaskUpdateTool as any).call({id: a.data.id, owner: 'X'}, c)
		const owned = await (TaskListTool as any).call({hasOwner: true}, c)
		expect(owned.data.map((t: {id: string}) => t.id)).toEqual([a.data.id])
		const orphaned = await (TaskListTool as any).call({hasOwner: false}, c)
		expect(orphaned.data.map((t: {id: string}) => t.id)).toEqual([b.data.id])
	})
})

describe('ToolSearchTool', () => {
	test('returns hits ranked by name > searchHint > description', async () => {
		const c = ctx()
		await c.kernel?.toolRegistry?.register({
			name: 'FileReader',
			description: 'read disk files',
		})
		await c.kernel?.toolRegistry?.register({
			name: 'Grep',
			description: 'fast file search',
			searchHint: 'fast file search',
		})
		const result = await (ToolSearchTool as any).call(
			{query: 'file', limit: 5},
			c,
		)
		expect(result.data[0].name).toBe('FileReader')
	})
})

describe('DiscoverSkillsTool', () => {
	test('lists registered skills and filters by query', async () => {
		const c = ctx()
		const src = {kind: 'test', origin: 'inline', loadedAt: '2026-05-23T00:00:00.000Z'}
		await c.kernel?.skillRegistry?.register(
			{
				name: 'code-reviewer',
				description: 'reviews code for bugs and security risks',
				prompt: 'You are a strict code reviewer',
				tools: ['Read', 'Grep'],
				model: 'haiku',
			},
			src,
		)
		await c.kernel?.skillRegistry?.register(
			{
				name: 'pdf-extractor',
				description: 'extracts text from PDF files',
				prompt: '...',
			},
			src,
		)
		const all = await (DiscoverSkillsTool as any).call({}, c)
		expect(all.data.map((s: {name: string}) => s.name).sort()).toEqual([
			'code-reviewer',
			'pdf-extractor',
		])
		const filtered = await (DiscoverSkillsTool as any).call({query: 'code'}, c)
		expect(filtered.data.map((s: {name: string}) => s.name)).toEqual([
			'code-reviewer',
		])
		const reviewer = filtered.data[0] as {tools?: string[]; model?: string}
		expect(reviewer.tools).toEqual(['Read', 'Grep'])
		expect(reviewer.model).toBe('haiku')
	})
})

describe('Memory tools', () => {
	test('write -> recall round-trip with tags + namespace + limit', async () => {
		const c = ctx()
		await (MemoryWriteTool as any).call(
			{
				namespace: 'user',
				content: 'prefers dark mode',
				tags: ['ui', 'preference'],
				importance: 0.8,
			},
			c,
		)
		await (MemoryWriteTool as any).call(
			{
				namespace: 'user',
				content: 'lives in Beijing',
				tags: ['location'],
				importance: 0.4,
			},
			c,
		)
		await (MemoryWriteTool as any).call(
			{namespace: 'pets', content: 'cat named luna'},
			c,
		)

		const userOnly = await (MemoryRecallTool as any).call(
			{namespace: 'user'},
			c,
		)
		expect(userOnly.data).toHaveLength(2)
		// importance desc 排序
		expect(userOnly.data[0].content).toBe('prefers dark mode')

		const tagged = await (MemoryRecallTool as any).call(
			{namespace: 'user', tags: ['ui']},
			c,
		)
		expect(tagged.data).toHaveLength(1)
	})

	test('throws when host did not inject memoryStore', async () => {
		await expect(
			(MemoryWriteTool as any).call(
				{namespace: 'x', content: 'y'},
				{kernel: {}},
			),
		).rejects.toThrow(/memoryStore/)
	})
})
