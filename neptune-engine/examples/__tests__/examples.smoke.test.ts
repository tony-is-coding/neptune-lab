/**
 * examples.smoke.test.ts — 三个 SDK example 的 scripted smoke 测试
 *
 * 设计目的（v6.0 P0.1.B）：
 * - 用 USE_SCRIPTED_PROVIDER=true 跑三个 example，0 真实 API 消耗
 * - 验证 example 文件本身可执行 + provider 切换逻辑正确 + 关键输出存在
 * - 进 substrate 守门 v2 D.10（CI 友好，无 API key 也能跑）
 *
 * 真 API smoke 由 scripts/smoke-real-api.sh 单独触发（需要真 API_KEY/AUTH_TOKEN
 * 与可选的 BASE_URL/MODEL，仅本地手动跑，不进守门）。
 */

import {describe, expect, it} from 'bun:test'
import {spawn} from 'node:child_process'
import {readdirSync, existsSync, rmSync, statSync, mkdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {randomBytes} from 'node:crypto'

const REPO_ROOT = resolve(import.meta.dir, '..', '..')
const EXAMPLES_DIR = resolve(REPO_ROOT, 'examples')

interface SpawnResult {
	exitCode: number | null
	stdout: string
	stderr: string
}

/**
 * 跑一个 bun example，注入 USE_SCRIPTED_PROVIDER=true。
 *
 * 用 cwd 为临时目录避免污染 repo（FileRunStore 默认 ./runs）。
 */
async function runExample(
	exampleFile: string,
	options: {extraEnv?: Record<string, string>; cwd?: string; args?: string[]} = {},
): Promise<SpawnResult> {
	const exampleAbs = resolve(EXAMPLES_DIR, exampleFile)
	// 用 process.execPath（即当前 bun runtime 路径）确保 child 能找到 bun
	const bunPath = process.execPath
	return new Promise(resolveSpawn => {
		const proc = spawn(bunPath, ['run', exampleAbs, ...(options.args ?? [])], {
			cwd: options.cwd ?? REPO_ROOT,
			env: {
				...process.env,
				USE_SCRIPTED_PROVIDER: 'true',
				...(options.extraEnv ?? {}),
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		const stdoutChunks: Buffer[] = []
		const stderrChunks: Buffer[] = []
		proc.stdout!.on('data', (c: Buffer) => stdoutChunks.push(c))
		proc.stderr!.on('data', (c: Buffer) => stderrChunks.push(c))
		const timer = setTimeout(() => proc.kill('SIGTERM'), 30_000)
		proc.on('close', (exitCode: number | null) => {
			clearTimeout(timer)
			resolveSpawn({
				exitCode,
				stdout: Buffer.concat(stdoutChunks).toString('utf8'),
				stderr: Buffer.concat(stderrChunks).toString('utf8'),
			})
		})
	})
}

function makeTempDir(prefix: string): string {
	const dir = resolve(REPO_ROOT, '.tmp-smoke', `${prefix}-${randomBytes(4).toString('hex')}`)
	rmSync(dir, {recursive: true, force: true})
	mkdirSync(dir, {recursive: true})
	return dir
}

describe('examples scripted smoke', () => {
	it('sdk-pure.ts: USE_SCRIPTED_PROVIDER=true → 输出 [assistant] 行 + exit 0', async () => {
		const result = await runExample('sdk-pure.ts')
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain('[assistant]')
		expect(result.stdout.toLowerCase()).toContain('hello')
	}, 35_000)

	it('sdk-with-fs-store.ts: USE_SCRIPTED_PROVIDER=true → 创建 run + 输出 runId + run.json 持久化', async () => {
		const tmpCwd = makeTempDir('fs-store')
		const result = await runExample('sdk-with-fs-store.ts', {cwd: tmpCwd})
		try {
			expect(result.exitCode).toBe(0)
			// 输出含 [start] runId=<id> 与 [done]
			expect(result.stdout).toMatch(/\[start\] runId=/)
			expect(result.stdout).toContain('[done]')
			// runs/<runId>/run.json 应存在
			const runsDir = resolve(tmpCwd, 'runs')
			expect(existsSync(runsDir)).toBe(true)
			const ids = readdirSync(runsDir).filter(name =>
				statSync(join(runsDir, name)).isDirectory(),
			)
			expect(ids.length).toBeGreaterThan(0)
			const runJson = join(runsDir, ids[0]!, 'run.json')
			expect(existsSync(runJson)).toBe(true)
		} finally {
			rmSync(tmpCwd, {recursive: true, force: true})
		}
	}, 35_000)

	it('sdk-with-server.ts: USE_SCRIPTED_PROVIDER=true + EXIT_AFTER_LISTEN=true → 启动后立即退出', async () => {
		// server example 默认死循环监听端口，加 EXIT_AFTER_LISTEN env 让它启动后 exit(0)
		const tmpCwd = makeTempDir('server')
		const result = await runExample('sdk-with-server.ts', {
			cwd: tmpCwd,
			extraEnv: {
				EXIT_AFTER_LISTEN: 'true',
				PORT: String(20_000 + Math.floor(Math.random() * 30_000)),
			},
		})
		try {
			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain('[server] listening on')
		} finally {
			rmSync(tmpCwd, {recursive: true, force: true})
		}
	}, 35_000)
})
