import {afterEach, describe, expect, mock, test} from 'bun:test'
import {mkdtempSync, readFileSync} from 'fs'
import {tmpdir} from 'os'
import {join} from 'path'

const captured: {
	config?: any
	runtime?: any
	sessionWorkspace?: string
} = {}

mock.module('@neptune/engine', () => ({
	AgentEngine: {
		create: (config: any, runtime: any) => {
			captured.config = config
			captured.runtime = runtime
			return {
				createSession: async (context: any) => {
					captured.sessionWorkspace = context.workspace
					return 'sdk-session-1'
				},
				query: async function* () {},
				destroy: async () => {},
			}
		},
	},
	createHeadlessCCRuntime: () => ({
		__headless: true,
		getAllBaseTools: () => [],
	}),
	LogUtil: {
		initialize: () => {},
		getInstance: () => ({
			child: () => ({
				debug: () => {},
				info: () => {},
				warn: () => {},
				error: () => {},
			}),
		}),
	},
	MDC: {
		getContext: () => ({}),
		run: async (_context: Record<string, unknown>, fn: () => unknown) => fn(),
		put: () => {},
		get: () => undefined,
		clear: () => {},
		generateRequestId: () => 'test-request-id',
	},
	NoOpTracingProvider: {
		getInstance: () => ({}),
	},
	NoOpMetricsProvider: {
		getInstance: () => ({}),
	},
	SpanStatus: {
		OK: 'OK',
		ERROR: 'ERROR',
	},
}))

describe('ClaudeCodeEngineFactory permissions wiring', () => {
	afterEach(() => {
		captured.config = undefined
		captured.runtime = undefined
		captured.sessionWorkspace = undefined
	})

	test('creates AgentEngine with headless runtime and delegate permissions', async () => {
		const {ClaudeCodeEngineFactory} = await import('../src/services/engine-factory.js')
		const workspace = mkdtempSync(join(tmpdir(), 'neptune-engine-factory-'))
		const factory = new ClaudeCodeEngineFactory({
			apiKey: 'test-key',
			defaultModel: 'test-model',
		})

		const result = await factory.createAndLoad({
			identityOverride: 'identity',
			instructions: 'instructions',
			memoryRoot: join(workspace, 'memory'),
			workspace,
			tools: ['Read'],
			mcpServers: [{name: 'docs', url: 'http://localhost:9999'}],
			tenantId: 'tenant-1',
		})

		expect(result.sdkSessionId).toBe('sdk-session-1')
		expect(captured.runtime?.__headless).toBe(true)
		expect(captured.sessionWorkspace).toBe(workspace)
		expect(captured.config.systemPrompt).toBe('identity\n\ninstructions')
		expect(captured.config.extensions.permissions.bypassPermissions).toBeUndefined()
		expect(captured.config.extensions.permissions.delegate).toBeDefined()
		expect(await captured.config.extensions.permissions.delegate.onToolAccess('Read', {
			file_path: join(workspace, 'allowed.md'),
		})).toBe('allow')
		expect(await captured.config.extensions.permissions.delegate.onToolAccess('Write', {
			file_path: join(workspace, 'denied.md'),
		})).toBe('deny')
		expect(await captured.config.extensions.permissions.delegate.onToolAccess('mcp__docs__search', {})).toBe('allow')
		expect(readFileSync(join(workspace, 'CLAUDE.md'), 'utf-8')).toBe('instructions')
	})
})
