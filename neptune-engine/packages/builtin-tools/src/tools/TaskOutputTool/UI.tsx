/**
 * TaskOutputTool UI 渲染方法
 *
 * 将 UI 渲染逻辑从主工具文件中分离出来，
 * 使核心工具文件不含 React/Ink 依赖。
 */

import * as React from 'react'
import type {ToolResultBlockParam} from '@anthropic-ai/sdk/resources/messages/messages.mjs'
import {FallbackToolUseErrorMessage} from '../../../../../../neptune-cli/src/components/FallbackToolUseErrorMessage'
import {
	FallbackToolUseRejectedMessage
} from '../../../../../../neptune-cli/src/components/FallbackToolUseRejectedMessage'
import {Box, Text} from '@anthropic/ink'
import {useShortcutDisplay} from '../../../../../../neptune-cli/src/keybindings/useShortcutDisplay'
import type {TaskType} from 'src/Task.js'
import {jsonParse} from 'src/utils/slowOperations.js'
import type {ThemeName} from 'src/utils/theme.js'
import {AgentPromptDisplay, AgentResponseDisplay} from '../AgentTool/UI.js'
import BashToolResultMessage from '../BashTool/BashToolResultMessage.js'

// 导出类型供主文件使用
export type TaskOutput = {
	task_id: string
	task_type: TaskType
	status: string
	description: string
	output: string
	exitCode?: number | null
	error?: string
	// For agents
	prompt?: string
	result?: string
}

export type TaskOutputToolOutput = {
	retrieval_status: 'success' | 'timeout' | 'not_ready'
	task: TaskOutput | null
}

const inputSchema = {
	task_id: '' as string,
	block: true as boolean,
	timeout: 30000 as number,
}
type InputSchema = typeof inputSchema

/**
 * 渲染工具使用消息
 */
export function renderToolUseMessage(input: Partial<InputSchema>): React.ReactNode {
	const {block = true} = input
	if (!block) {
		return 'non-blocking'
	}
	return ''
}

/**
 * 渲染工具使用标签
 */
export function renderToolUseTag(input: Partial<InputSchema>): React.ReactNode {
	if (!input.task_id) {
		return null
	}
	return <Text dimColor> {input.task_id}</Text>
}

/**
 * 渲染工具使用进度消息
 */
export function renderToolUseProgressMessage(progressMessages: Array<{
	data?: { taskDescription?: string; taskType?: string }
}>): React.ReactNode {
	const lastProgress = progressMessages[progressMessages.length - 1]
	const progressData = lastProgress?.data as
		| { taskDescription?: string; taskType?: string }
		| undefined

	return (
		<Box flexDirection="column">
			{progressData?.taskDescription && (
				<Text>&nbsp;&nbsp;{progressData.taskDescription}</Text>
			)}
			<Text>
				&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Waiting for task{' '}
				<Text dimColor>(esc to give additional instructions)</Text>
			</Text>
		</Box>
	)
}

/**
 * 渲染工具结果消息
 */
export function renderToolResultMessage(
	content: string | TaskOutputToolOutput,
	_unknown: unknown[],
	{verbose, theme}: { verbose: boolean; theme: ThemeName },
): React.ReactNode {
	return (
		<TaskOutputResultDisplay
			content={content}
			verbose={verbose}
			theme={theme}
		/>
	)
}

/**
 * 渲染工具使用被拒绝消息
 */
export function renderToolUseRejectedMessage(): React.ReactNode {
	return <FallbackToolUseRejectedMessage/>
}

/**
 * 渲染工具错误消息
 */
export function renderToolUseErrorMessage(
	result: ToolResultBlockParam['content'],
	{verbose}: { verbose: boolean },
): React.ReactNode {
	return <FallbackToolUseErrorMessage result={result} verbose={verbose}/>
}

/**
 * 任务输出结果显示组件
 */
function TaskOutputResultDisplay({
									 content,
									 verbose = false,
									 theme,
								 }: {
	content: string | TaskOutputToolOutput
	verbose?: boolean
	theme: ThemeName
}): React.ReactNode {
	const expandShortcut = useShortcutDisplay(
		'app:toggleTranscript',
		'Global',
		'ctrl+o',
	)
	const result: TaskOutputToolOutput =
		typeof content === 'string' ? jsonParse(content) : content

	if (!result.task) {
		return (
			<Box flexDirection="column">
				<Text dimColor>No task output available</Text>
			</Box>
		)
	}

	const {task} = result
	if (task.task_type === 'local_agent' || task.task_type === 'remote_agent') {
		return (
			<Box flexDirection="column">
				{task.prompt && <AgentPromptDisplay prompt={task.prompt}/>}
				<AgentResponseDisplay
					content={[{type: 'text', text: (task.result ?? '') as string}]}
				/>
			</Box>
		)
	}

	if (task.task_type === 'local_bash') {
		return (
			<BashToolResultMessage
				content={{
					stdout: task.output,
					stderr: '',
					isImage: false,
					returnCodeInterpretation: task.error,
				}}
				verbose={verbose}
			/>
		)
	}

	return (
		<Box flexDirection="column">
			<Text>{task.output}</Text>
		</Box>
	)
}
