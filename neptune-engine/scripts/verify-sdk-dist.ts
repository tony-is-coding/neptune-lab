#!/usr/bin/env bun
/**
 * SDK 构建产物验证脚本
 *
 * 验证 dist/sdk/engine/ 目录：
 * 1. 零 React/Ink 引用
 * 2. 体积 < 2MB
 * 3. index.d.ts 存在
 */

import {$} from 'bun'
import {readdirSync, statSync} from 'fs'
import {join, dirname} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const ENGINE_DIR = join(PROJECT_ROOT, 'dist/sdk/engine')
const MAX_SIZE_MB = 2

interface ValidationResult {
	passed: boolean
	checks: Array<{
		name: string
		passed: boolean
		message: string
	}>
}

async function checkReactInkReferences(): Promise<boolean> {
	const reactResult = await $`grep -r "from 'react'" ${ENGINE_DIR}`.quiet().nothrow()
	const inkResult = await $`grep -r "from '@ink-core" ${ENGINE_DIR}`.quiet().nothrow()

	const reactOutput = reactResult.stdout.toString() || ''
	const inkOutput = inkResult.stdout.toString() || ''

	const reactCount = reactOutput.trim().split('\n').filter(l => l).length
	const inkCount = inkOutput.trim().split('\n').filter(l => l).length

	console.log(`  ✓ React 引用: ${reactCount}`)
	console.log(`  ✓ Ink 引用: ${inkCount}`)

	return reactCount === 0 && inkCount === 0
}

async function checkEngineSize(): Promise<boolean> {
	const result = await $`du -sk ${ENGINE_DIR}`
	const output = result.stdout.toString() || ''
	// du -sk 输出格式: "块数\t路径" (块数是 KB)
	const parts = output.trim().split(/\s+/)
	const sizeKB = parseInt(parts[0]) || 0
	const sizeMB = sizeKB / 1024

	console.log(`  ✓ engine/ 目录体积: ${sizeMB.toFixed(2)} MB (限制: ${MAX_SIZE_MB} MB)`)

	return sizeMB < MAX_SIZE_MB
}

async function checkIndexDTS(): Promise<boolean> {
	const indexPath = join(ENGINE_DIR, 'index.d.ts')
	const exists = await Bun.file(indexPath).exists()

	console.log(`  ✓ engine/index.d.ts: ${exists ? '存在' : '不存在'}`)

	return exists
}

async function checkFileCount(): Promise<boolean> {
	let count = 0

	function countFiles(dir: string) {
		const files = readdirSync(dir)
		for (const file of files) {
			const fullPath = join(dir, file)
			const stat = statSync(fullPath)
			if (stat.isDirectory()) {
				if (file !== '__tests__' && file !== '__mocks__') {
					countFiles(fullPath)
				}
			} else if (file.endsWith('.d.ts')) {
				count++
			}
		}
	}

	countFiles(ENGINE_DIR)
	console.log(`  ✓ .d.ts 文件数量: ${count}`)

	return count > 0
}

async function main() {
	console.log('🔍 验证 SDK 构建产物...\n')

	const checks: ValidationResult['checks'] = []

	// 检查 1: React/Ink 引用
	console.log('检查 1: engine/ 目录零 React/Ink 引用')
	const reactCheck = await checkReactInkReferences()
	checks.push({
		name: '零 React/Ink 引用',
		passed: reactCheck,
		message: reactCheck ? '通过' : '失败：检测到 React 或 Ink 引用',
	})
	console.log()

	// 检查 2: 目录体积
	console.log('检查 2: engine/ 目录体积')
	const sizeCheck = await checkEngineSize()
	checks.push({
		name: '体积 < 2MB',
		passed: sizeCheck,
		message: sizeCheck ? '通过' : '失败：体积超过 2MB',
	})
	console.log()

	// 检查 3: index.d.ts 存在
	console.log('检查 3: engine/index.d.ts 存在')
	const indexCheck = await checkIndexDTS()
	checks.push({
		name: 'engine/index.d.ts 存在',
		passed: indexCheck,
		message: indexCheck ? '通过' : '失败：engine/index.d.ts 不存在',
	})
	console.log()

	// 检查 4: .d.ts 文件数量
	console.log('检查 4: .d.ts 文件数量')
	const fileCountCheck = await checkFileCount()
	checks.push({
		name: '.d.ts 文件存在',
		passed: fileCountCheck,
		message: fileCountCheck ? '通过' : '失败：没有 .d.ts 文件',
	})
	console.log()

	// 总结
	const passed = checks.every(c => c.passed)
	console.log('='.repeat(50))
	console.log(`验证结果: ${passed ? '✅ 通过' : '❌ 失败'}`)
	console.log('='.repeat(50))

	if (!passed) {
		console.log('\n失败的检查:')
		for (const check of checks) {
			if (!check.passed) {
				console.log(`  - ${check.name}: ${check.message}`)
			}
		}
	}

	process.exit(passed ? 0 : 1)
}

main()
