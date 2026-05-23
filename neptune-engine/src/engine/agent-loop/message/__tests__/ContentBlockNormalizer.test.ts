/**
 * ContentBlockNormalizer 单测
 *
 * 覆盖：
 * - 字符串 block 透传
 * - 内部痕迹字段 `_xxx` 剥离
 * - thinking signature 必须保留
 * - thinking 缺 signature 检测
 */

import {describe, expect, it} from 'bun:test'
import {
	normalizeContentBlock,
	normalizeContentBlocks,
	findThinkingBlocksMissingSignature,
} from '../ContentBlockNormalizer.js'
import type {ContentItem} from '../../../types/message.js'

describe('ContentBlockNormalizer', () => {
	describe('normalizeContentBlock', () => {
		it('字符串透传', () => {
			expect(normalizeContentBlock('hello')).toBe('hello')
		})

		it('null 透传', () => {
			expect(normalizeContentBlock(null as unknown as ContentItem)).toBeNull()
		})

		it('内部字段 _xxx 被剥除', () => {
			const block = {
				type: 'text',
				text: 'hi',
				_geminiThoughtSignature: 'leak',
				_internal: 42,
			} as unknown as ContentItem
			const out = normalizeContentBlock(block)
			expect(out).toEqual({type: 'text', text: 'hi'} as ContentItem)
			expect((out as Record<string, unknown>)._geminiThoughtSignature).toBeUndefined()
		})

		it('普通字段保留', () => {
			const block = {type: 'text', text: 'hi'} as unknown as ContentItem
			expect(normalizeContentBlock(block)).toEqual(block)
		})

		it('tool_use block 保留 id/name/input', () => {
			const block = {
				type: 'tool_use',
				id: 'tu_1',
				name: 'Read',
				input: {file_path: 'a.md'},
				_internal: 'x',
			} as unknown as ContentItem
			const out = normalizeContentBlock(block) as Record<string, unknown>
			expect(out.id).toBe('tu_1')
			expect(out.name).toBe('Read')
			expect(out.input).toEqual({file_path: 'a.md'})
			expect(out._internal).toBeUndefined()
		})

		it('thinking block 保留 signature', () => {
			const block = {
				type: 'thinking',
				thinking: 'reflect',
				signature: 'sig_xyz',
			} as unknown as ContentItem
			const out = normalizeContentBlock(block) as Record<string, unknown>
			expect(out.signature).toBe('sig_xyz')
		})
	})

	describe('normalizeContentBlocks', () => {
		it('数组每个 block 都规范化', () => {
			const blocks = [
				{type: 'text', text: 'hi', _x: 1},
				{type: 'tool_use', id: 't1', name: 'X', input: {}, _y: 2},
			] as unknown as ContentItem[]
			const out = normalizeContentBlocks(blocks)
			expect(out).toHaveLength(2)
			expect((out[0] as Record<string, unknown>)._x).toBeUndefined()
			expect((out[1] as Record<string, unknown>)._y).toBeUndefined()
		})
	})

	describe('findThinkingBlocksMissingSignature', () => {
		it('全部带 signature → 空数组', () => {
			const blocks = [
				{type: 'thinking', thinking: 't', signature: 'sig'},
				{type: 'text', text: 'x'},
				{type: 'thinking', thinking: 't2', signature: 'sig2'},
			] as unknown as ContentItem[]
			expect(findThinkingBlocksMissingSignature(blocks)).toEqual([])
		})

		it('thinking 缺 signature → 返回 index', () => {
			const blocks = [
				{type: 'thinking', thinking: 't', signature: ''},
				{type: 'text', text: 'x'},
				{type: 'thinking', thinking: 't2'} as unknown,
			] as unknown as ContentItem[]
			expect(findThinkingBlocksMissingSignature(blocks)).toEqual([0, 2])
		})

		it('非 thinking block 不被检测', () => {
			const blocks = [
				{type: 'tool_use', id: 't1', name: 'X', input: {}},
				{type: 'text', text: 'x'},
			] as unknown as ContentItem[]
			expect(findThinkingBlocksMissingSignature(blocks)).toEqual([])
		})
	})
})
