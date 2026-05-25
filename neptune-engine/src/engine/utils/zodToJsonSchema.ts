/**
 * zodToJsonSchema — Phase B kernel tools 的 zod schema 自动转 JSON Schema
 *
 * 设计目标：
 * - Phase B 11 个 kernel tools 用 zod 定义 input；engine AgentLoop 需要
 *   JSON Schema 给 Anthropic API 发 tools
 * - 让工具不必同时维护 zod + 手写 inputJSONSchema
 *
 * 简化版（覆盖 Phase B 实际用到的）：
 * - z.object（含 z.optional / required）
 * - z.string / z.number / z.boolean / z.null
 * - z.array
 * - z.enum / z.literal
 * - z.union（仅基础类型 union，不递归 object union）
 *
 * 不支持（Phase B 不用，避免复杂度膨胀）：
 * - z.lazy / z.intersection / z.tuple / z.discriminatedUnion
 * - z.record（map type）
 *
 * 0 外部依赖（仅 zod 自身的内省 API）。
 */

import {z} from 'zod'

export interface JSONSchemaObject {
	type?: string
	properties?: Record<string, JSONSchemaObject>
	required?: string[]
	items?: JSONSchemaObject
	enum?: unknown[]
	const?: unknown
	description?: string
	default?: unknown
	anyOf?: JSONSchemaObject[]
	[key: string]: unknown
}

/**
 * 把 zod schema 转 JSON Schema。
 *
 * @example
 *   const schema = z.object({
 *     name: z.string(),
 *     age: z.number().optional(),
 *   })
 *   zodToJsonSchema(schema)
 *   // → {type: 'object', properties: {name: {type: 'string'}, age: {type: 'number'}}, required: ['name']}
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JSONSchemaObject {
	return convert(schema)
}

function convert(schema: z.ZodTypeAny): JSONSchemaObject {
	// optional / nullable / default —— 解开 wrapper
	if (schema instanceof z.ZodOptional) {
		return convert(schema.unwrap() as z.ZodTypeAny)
	}
	if (schema instanceof z.ZodNullable) {
		const inner = convert(schema.unwrap() as z.ZodTypeAny)
		return {anyOf: [inner, {type: 'null'}]}
	}
	if (schema instanceof z.ZodDefault) {
		const inner = convert(schema.removeDefault() as z.ZodTypeAny)
		// zod 的 _def.defaultValue 是 () => T，需要调
		const def = (schema as z.ZodDefault<z.ZodTypeAny>)._def
		const defaultFn = def.defaultValue as unknown
		const defaultValue =
			typeof defaultFn === 'function' ? (defaultFn as () => unknown)() : defaultFn
		inner.default = defaultValue
		return inner
	}
	// 基础类型
	if (schema instanceof z.ZodString) {
		const out: JSONSchemaObject = {type: 'string'}
		const desc = (schema as z.ZodTypeAny).description
		if (desc) out.description = desc
		return out
	}
	if (schema instanceof z.ZodNumber) {
		return {type: 'number'}
	}
	if (schema instanceof z.ZodBoolean) {
		return {type: 'boolean'}
	}
	if (schema instanceof z.ZodNull) {
		return {type: 'null'}
	}
	if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
		return {}
	}
	// enum
	if (schema instanceof z.ZodEnum) {
		const def = (schema as unknown as {_def: Record<string, unknown>})._def
		// zod v4: def.entries 或 def.values
		const valuesUnknown = def.entries ?? def.values
		let values: string[] = []
		if (Array.isArray(valuesUnknown)) {
			values = valuesUnknown as string[]
		} else if (valuesUnknown && typeof valuesUnknown === 'object') {
			values = Object.values(valuesUnknown as Record<string, string>)
		}
		return {type: 'string', enum: values}
	}
	// literal
	if (schema instanceof z.ZodLiteral) {
		const def = (schema as unknown as {_def: {value?: unknown; values?: unknown[]}})._def
		// zod v4: def.values 数组（一个或多个 literal）；zod v3: def.value 单值
		const values = def.values
		if (Array.isArray(values)) {
			if (values.length === 1) {
				return {const: values[0]}
			}
			return {enum: values}
		}
		return {const: def.value}
	}
	// array
	if (schema instanceof z.ZodArray) {
		const elementSchema = (schema as unknown as {_def: {element: z.ZodTypeAny}})._def.element
		return {type: 'array', items: convert(elementSchema)}
	}
	// object
	if (schema instanceof z.ZodObject) {
		const shape = (schema as z.ZodObject<z.ZodRawShape>).shape
		const properties: Record<string, JSONSchemaObject> = {}
		const required: string[] = []
		for (const key of Object.keys(shape)) {
			const fieldSchema = shape[key]! as z.ZodTypeAny
			properties[key] = convert(fieldSchema)
			if (!isOptional(fieldSchema)) {
				required.push(key)
			}
		}
		const out: JSONSchemaObject = {type: 'object', properties}
		if (required.length > 0) out.required = required
		return out
	}
	// union
	if (schema instanceof z.ZodUnion) {
		const def = (schema as unknown as {_def: {options: readonly z.ZodTypeAny[]}})._def
		return {anyOf: def.options.map(convert)}
	}
	// fallback：未知类型 → {} (any)
	return {}
}

function isOptional(schema: z.ZodTypeAny): boolean {
	if (schema instanceof z.ZodOptional) return true
	if (schema instanceof z.ZodDefault) return true
	return false
}
