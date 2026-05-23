import {describe, expect, test} from 'bun:test'
import {TenantPermissionDelegate} from '../src/services/permission-delegate.js'

describe('TenantPermissionDelegate', () => {
	const workspace = '/tmp/neptune/tenants/t1/agents/a1/threads/th1'

	function createDelegate(tools: string[] = ['Read', 'Write']) {
		return new TenantPermissionDelegate(
			{
				tenantId: 'tenant-1',
				workspace,
				mcpServers: ['docs'],
			},
			{tools},
		)
	}

	test('allows whitelisted file tool inside workspace', async () => {
		const delegate = createDelegate(['Read'])

		await expect(delegate.onToolAccess('Read', {
			file_path: `${workspace}/notes.md`,
		})).resolves.toBe('allow')
	})

	test('denies tool outside whitelist', async () => {
		const delegate = createDelegate(['Read'])

		await expect(delegate.onToolAccess('Write', {
			file_path: `${workspace}/notes.md`,
		})).resolves.toBe('deny')
	})

	test('denies relative path escape from workspace', async () => {
		const delegate = createDelegate(['Read'])

		await expect(delegate.onToolAccess('Read', {
			file_path: `${workspace}/../secret.md`,
		})).resolves.toBe('deny')
	})

	test('denies sibling-prefix workspace path', async () => {
		const delegate = createDelegate(['Read'])

		await expect(delegate.onToolAccess('Read', {
			file_path: `${workspace}2/secret.md`,
		})).resolves.toBe('deny')
	})

	test('denies unregistered MCP server', async () => {
		const delegate = createDelegate([])

		await expect(delegate.onToolAccess('mcp__private__search', {})).resolves.toBe('deny')
	})

	test('allows registered MCP server', async () => {
		const delegate = createDelegate([])

		await expect(delegate.onToolAccess('mcp__docs__search', {})).resolves.toBe('allow')
	})
})
