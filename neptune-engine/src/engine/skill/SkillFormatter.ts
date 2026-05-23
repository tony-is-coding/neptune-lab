/**
 * SkillFormatter — engine 事实标准的 Markdown + YAML frontmatter 解析器
 *
 * 这是 Neptune Engine 定义的 skill 文件格式标准。任何在 engine 上长出来的
 * agent 应用都应该遵循这个规范来产出/消费 skill 文件。
 *
 * 格式约定：
 *
 *   ---
 *   name: code-reviewer
 *   description: 当用户让你审查代码时调用
 *   tools: [Read, Grep, Glob]
 *   model: claude-haiku-4-5
 *   metadata:
 *     priority: high
 *   ---
 *
 *   你是一个严格的代码审查员。重点检查 bug、安全风险、命名一致性...
 *
 * 这里实现极简 YAML 子集（足够支撑 SkillManifest 的所有字段），不依赖外部
 * yaml 库；对应字段类型严格，未识别字段进 metadata 不丢失，但语法错误抛出
 * 明确异常，便于上层定位文件错误。
 */

import type {SkillManifest} from './types.js'

const FRONTMATTER_DELIMITER = '---'

export class SkillFormatError extends Error {
	constructor(message: string, public readonly source?: string) {
		super(message)
		this.name = 'SkillFormatError'
	}
}

/**
 * 解析一段 markdown 文本为 SkillManifest。
 *
 * @throws {SkillFormatError} 缺少 frontmatter / 缺少必需字段 / 字段类型错误
 */
export function parseSkillMarkdown(source: string): SkillManifest {
	const {frontmatter, body} = splitFrontmatter(source)
	const data = parseSimpleYaml(frontmatter)

	const name = readString(data, 'name')
	const description = readString(data, 'description')
	if (!name) {
		throw new SkillFormatError('skill manifest missing required "name" field', source)
	}
	if (!description) {
		throw new SkillFormatError('skill manifest missing required "description" field', source)
	}

	const tools = readStringArray(data, 'tools')
	const disallowedTools = readStringArray(data, 'disallowedTools')
	const model = readString(data, 'model')

	// metadata 接收 frontmatter 中所有未识别的键，避免 product 自定义字段被丢弃
	const known = new Set([
		'name',
		'description',
		'tools',
		'disallowedTools',
		'model',
		'metadata',
	])
	const explicitMetadata =
		data['metadata'] && typeof data['metadata'] === 'object' && !Array.isArray(data['metadata'])
			? (data['metadata'] as Record<string, unknown>)
			: {}
	const inferredMetadata: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(data)) {
		if (!known.has(k)) {
			inferredMetadata[k] = v
		}
	}
	const mergedMetadata = {...inferredMetadata, ...explicitMetadata}
	const hasMetadata = Object.keys(mergedMetadata).length > 0

	const manifest: SkillManifest = {
		name,
		description,
		prompt: body.trim(),
		...(tools !== undefined && {tools}),
		...(disallowedTools !== undefined && {disallowedTools}),
		...(model !== undefined && {model}),
		...(hasMetadata && {metadata: mergedMetadata}),
	}
	return manifest
}

/**
 * 把 SkillManifest 序列化回 markdown，便于 round-trip 编辑/校对。
 *
 * 不保证 byte-level identical：YAML 顺序、空白可能改变，但语义等价。
 */
export function serializeSkillToMarkdown(manifest: SkillManifest): string {
	const lines: string[] = [FRONTMATTER_DELIMITER]
	lines.push(`name: ${yamlScalar(manifest.name)}`)
	lines.push(`description: ${yamlScalar(manifest.description)}`)
	if (manifest.tools && manifest.tools.length > 0) {
		lines.push(`tools: [${manifest.tools.map(yamlScalar).join(', ')}]`)
	}
	if (manifest.disallowedTools && manifest.disallowedTools.length > 0) {
		lines.push(
			`disallowedTools: [${manifest.disallowedTools.map(yamlScalar).join(', ')}]`,
		)
	}
	if (manifest.model !== undefined) {
		lines.push(`model: ${yamlScalar(manifest.model)}`)
	}
	if (manifest.metadata && Object.keys(manifest.metadata).length > 0) {
		lines.push('metadata:')
		for (const [k, v] of Object.entries(manifest.metadata)) {
			lines.push(`  ${k}: ${yamlScalar(String(v))}`)
		}
	}
	lines.push(FRONTMATTER_DELIMITER)
	lines.push('')
	lines.push(manifest.prompt)
	return lines.join('\n')
}

/**
 * 校验任意值是否符合 SkillManifest 形态。返回错误信息列表，空列表表示 ok。
 *
 * 用于 product 注入 manifest 前的输入校验（不走 markdown 解析路径时也能用）。
 */
export function validateSkillManifest(value: unknown): {
	ok: boolean
	errors: string[]
} {
	const errors: string[] = []
	if (!value || typeof value !== 'object') {
		return {ok: false, errors: ['manifest must be an object']}
	}
	const m = value as Record<string, unknown>
	if (typeof m['name'] !== 'string' || m['name'].length === 0) {
		errors.push('"name" must be a non-empty string')
	}
	if (typeof m['description'] !== 'string' || m['description'].length === 0) {
		errors.push('"description" must be a non-empty string')
	}
	if (typeof m['prompt'] !== 'string') {
		errors.push('"prompt" must be a string')
	}
	if (m['tools'] !== undefined && !isStringArray(m['tools'])) {
		errors.push('"tools" must be an array of strings if provided')
	}
	if (m['disallowedTools'] !== undefined && !isStringArray(m['disallowedTools'])) {
		errors.push('"disallowedTools" must be an array of strings if provided')
	}
	if (m['model'] !== undefined && typeof m['model'] !== 'string') {
		errors.push('"model" must be a string if provided')
	}
	if (
		m['metadata'] !== undefined &&
		(typeof m['metadata'] !== 'object' || Array.isArray(m['metadata']))
	) {
		errors.push('"metadata" must be an object if provided')
	}
	return {ok: errors.length === 0, errors}
}

// ============================================================
// 内部：极简 YAML 子集
// ============================================================

function splitFrontmatter(source: string): {frontmatter: string; body: string} {
	const trimmed = source.replace(/^\uFEFF/, '') // strip BOM
	const lines = trimmed.split('\n')
	if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
		throw new SkillFormatError(
			'skill markdown must start with "---" frontmatter delimiter',
			source,
		)
	}
	let endIdx = -1
	for (let i = 1; i < lines.length; i++) {
		if (lines[i]?.trim() === FRONTMATTER_DELIMITER) {
			endIdx = i
			break
		}
	}
	if (endIdx < 0) {
		throw new SkillFormatError(
			'skill markdown frontmatter is not closed (no second "---")',
			source,
		)
	}
	return {
		frontmatter: lines.slice(1, endIdx).join('\n'),
		body: lines.slice(endIdx + 1).join('\n'),
	}
}

/**
 * 极简 YAML 解析器：支持
 *   key: value
 *   key: [a, b, c]
 *   key:
 *     subkey: subvalue
 * 不支持：多层嵌套（除 metadata 第一级）、block scalars、anchors、merge keys。
 */
function parseSimpleYaml(text: string): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	const lines = text.split('\n')
	let i = 0
	while (i < lines.length) {
		const raw = lines[i]
		i++
		if (raw === undefined) continue
		const line = raw.replace(/\s+$/, '')
		if (line.length === 0 || line.trimStart().startsWith('#')) continue
		// 顶层条目必须以 key: 开头（不缩进）
		if (line[0] === ' ' || line[0] === '\t') {
			throw new SkillFormatError(
				`unexpected indentation at top level: "${line}"`,
			)
		}
		const colonIdx = line.indexOf(':')
		if (colonIdx < 0) {
			throw new SkillFormatError(`expected "key: value" form, got "${line}"`)
		}
		const key = line.slice(0, colonIdx).trim()
		const rawValue = line.slice(colonIdx + 1).trim()

		if (rawValue.length === 0) {
			// 子对象：吃后续缩进行
			const sub: Record<string, unknown> = {}
			while (i < lines.length) {
				const next = lines[i]
				if (next === undefined) {
					i++
					continue
				}
				if (next.length === 0 || next.trimStart().startsWith('#')) {
					i++
					continue
				}
				if (!(next.startsWith('  ') || next.startsWith('\t'))) break
				const subLine = next.replace(/^\s+/, '').replace(/\s+$/, '')
				const subColon = subLine.indexOf(':')
				if (subColon < 0) {
					throw new SkillFormatError(`bad nested entry under "${key}": "${next}"`)
				}
				const subKey = subLine.slice(0, subColon).trim()
				const subValue = subLine.slice(subColon + 1).trim()
				sub[subKey] = parseScalar(subValue)
				i++
			}
			out[key] = sub
		} else {
			out[key] = parseScalar(rawValue)
		}
	}
	return out
}

function parseScalar(raw: string): unknown {
	if (raw.startsWith('[') && raw.endsWith(']')) {
		const inner = raw.slice(1, -1).trim()
		if (inner.length === 0) return []
		return inner.split(',').map(s => stripQuotes(s.trim()))
	}
	return stripQuotes(raw)
}

function stripQuotes(s: string): string {
	if (
		(s.startsWith('"') && s.endsWith('"')) ||
		(s.startsWith("'") && s.endsWith("'"))
	) {
		return s.slice(1, -1)
	}
	return s
}

function readString(data: Record<string, unknown>, key: string): string | undefined {
	const v = data[key]
	if (typeof v === 'string') return v
	if (v === undefined) return undefined
	throw new SkillFormatError(`field "${key}" must be a string`)
}

function readStringArray(
	data: Record<string, unknown>,
	key: string,
): readonly string[] | undefined {
	const v = data[key]
	if (v === undefined) return undefined
	if (!Array.isArray(v)) {
		throw new SkillFormatError(`field "${key}" must be an array`)
	}
	if (!isStringArray(v)) {
		throw new SkillFormatError(`field "${key}" must be an array of strings`)
	}
	return v
}

function isStringArray(v: unknown): v is string[] {
	return Array.isArray(v) && v.every(x => typeof x === 'string')
}

function yamlScalar(s: string): string {
	// 含特殊字符（: # [ ] , 或前导空格）则用双引号包裹
	if (/[:#\[\],"]/.test(s) || s.startsWith(' ') || s.endsWith(' ')) {
		return `"${s.replace(/"/g, '\\"')}"`
	}
	return s
}
