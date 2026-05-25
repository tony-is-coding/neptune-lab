/**
 * zodToJsonSchema.test.ts — Phase B 工具 input schema 自动转换
 */

import {describe, it, expect} from 'bun:test'
import {z} from 'zod'
import {zodToJsonSchema} from '../zodToJsonSchema.js'

describe('zodToJsonSchema', () => {
	it('z.string → {type: string}', () => {
		expect(zodToJsonSchema(z.string())).toEqual({type: 'string'})
	})

	it('z.number → {type: number}', () => {
		expect(zodToJsonSchema(z.number())).toEqual({type: 'number'})
	})

	it('z.boolean → {type: boolean}', () => {
		expect(zodToJsonSchema(z.boolean())).toEqual({type: 'boolean'})
	})

	it('z.null → {type: null}', () => {
		expect(zodToJsonSchema(z.null())).toEqual({type: 'null'})
	})

	it('z.string with description', () => {
		const schema = z.string().describe('User name')
		expect(zodToJsonSchema(schema)).toEqual({type: 'string', description: 'User name'})
	})

	it('z.array(z.string()) → array of string', () => {
		expect(zodToJsonSchema(z.array(z.string()))).toEqual({
			type: 'array',
			items: {type: 'string'},
		})
	})

	it('z.object 简单字段', () => {
		const schema = z.object({
			name: z.string(),
			age: z.number(),
		})
		expect(zodToJsonSchema(schema)).toEqual({
			type: 'object',
			properties: {
				name: {type: 'string'},
				age: {type: 'number'},
			},
			required: ['name', 'age'],
		})
	})

	it('z.optional 字段不进 required', () => {
		const schema = z.object({
			required_field: z.string(),
			optional_field: z.string().optional(),
		})
		const r = zodToJsonSchema(schema)
		expect(r.required).toEqual(['required_field'])
		expect(r.properties?.optional_field).toEqual({type: 'string'})
	})

	it('z.default 字段不进 required + 写 default', () => {
		const schema = z.object({
			level: z.number().default(0),
		})
		const r = zodToJsonSchema(schema)
		expect(r.required).toBeUndefined() // 全部 optional
		expect(r.properties?.level).toEqual({type: 'number', default: 0})
	})

	it('z.enum → string + enum 数组', () => {
		const schema = z.enum(['low', 'medium', 'high'])
		expect(zodToJsonSchema(schema)).toEqual({
			type: 'string',
			enum: ['low', 'medium', 'high'],
		})
	})

	it('z.literal → const', () => {
		expect(zodToJsonSchema(z.literal('fixed-value'))).toEqual({const: 'fixed-value'})
	})

	it('z.union 基础类型', () => {
		const schema = z.union([z.string(), z.number()])
		expect(zodToJsonSchema(schema)).toEqual({
			anyOf: [{type: 'string'}, {type: 'number'}],
		})
	})

	it('z.nullable → anyOf with null', () => {
		const schema = z.string().nullable()
		expect(zodToJsonSchema(schema)).toEqual({
			anyOf: [{type: 'string'}, {type: 'null'}],
		})
	})

	it('nested z.object', () => {
		const schema = z.object({
			user: z.object({
				id: z.string(),
				email: z.string(),
			}),
		})
		const r = zodToJsonSchema(schema)
		expect(r.properties?.user).toEqual({
			type: 'object',
			properties: {
				id: {type: 'string'},
				email: {type: 'string'},
			},
			required: ['id', 'email'],
		})
	})

	it('Phase B 典型用例：TodoWrite 风格的 todo 列表', () => {
		const schema = z.object({
			todos: z.array(
				z.object({
					id: z.string(),
					content: z.string(),
					status: z.enum(['pending', 'in_progress', 'completed']),
				}),
			),
		})
		const r = zodToJsonSchema(schema)
		expect(r.type).toBe('object')
		expect(r.properties?.todos?.type).toBe('array')
		expect(r.properties?.todos?.items?.properties?.status).toEqual({
			type: 'string',
			enum: ['pending', 'in_progress', 'completed'],
		})
	})

	it('z.any → {} (空 schema = any type)', () => {
		expect(zodToJsonSchema(z.any())).toEqual({})
	})
})
