import {mkdtemp, mkdir, writeFile} from 'fs/promises'
import {join} from 'path'
import {tmpdir} from 'os'
import {describe, expect, test} from 'bun:test'
import {WorkflowTool} from '../WorkflowTool.js'
import {getWorkflowCommands} from '../createWorkflowCommand.js'
import {WORKFLOW_TOOL_NAME} from '../constants.js'

describe('product Workflow tool', () => {
	test('exposes workflow tool behavior from product layer', async () => {
		expect(WorkflowTool.name).toBe(WORKFLOW_TOOL_NAME)
		expect(await WorkflowTool.description()).toContain('.claude/workflows')
		expect(await WorkflowTool.prompt()).toContain('user-defined workflow scripts')
		expect(WorkflowTool.renderToolUseMessage({workflow: 'ship', args: '--dry'}))
			.toBe('Workflow: ship --dry')

		const result = WorkflowTool.mapToolResultToToolResultBlockParam(
			{output: 'done'},
			'toolu_workflow',
		)

		expect(result).toEqual({
			tool_use_id: 'toolu_workflow',
			type: 'tool_result',
			content: 'done',
		})
	})

	test('creates slash commands from project workflow files', async () => {
		const cwd = await mkdtemp(join(tmpdir(), 'neptune-workflow-test-'))
		const workflowDir = join(cwd, '.claude', 'workflows')
		await mkdir(workflowDir, {recursive: true})
		await writeFile(join(workflowDir, 'close-check.md'), 'step: verify close')
		await writeFile(join(workflowDir, 'ignored.txt'), 'not a workflow')

		const commands = await getWorkflowCommands(cwd)

		expect(commands).toHaveLength(1)
		expect(commands[0]?.name).toBe('close-check')
		expect(commands[0]?.kind).toBe('workflow')
		expect(commands[0]).toHaveProperty('getPromptForCommand')

		const command = commands[0] as Extract<
			(typeof commands)[number],
			{getPromptForCommand: unknown}
		>
		const prompt = await command.getPromptForCommand(
			'period=2026-05',
			{} as never,
		)
		expect(prompt).toEqual([
			{
				type: 'text',
				text: 'Execute this workflow:\n\nstep: verify close\n\nArguments: period=2026-05',
			},
		])
	})
})
