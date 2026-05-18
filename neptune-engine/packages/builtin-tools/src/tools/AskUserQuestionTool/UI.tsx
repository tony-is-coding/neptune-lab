/**
 * AskUserQuestionTool UI 渲染方法
 *
 * 将 UI 渲染逻辑从主工具文件中分离出来，
 * 使核心工具文件不含 React/Ink 依赖。
 */

import * as React from 'react'
import {MessageResponse} from '../../../../../src/ui/components/MessageResponse'
import {BLACK_CIRCLE} from 'src/constants/figures.js'
import {getModeColor} from 'src/utils/permissions/PermissionMode.js'
import {Box, Text} from '@anthropic/ink'
import type {Output} from './AskUserQuestionTool.js'

/**
 * 渲染工具使用消息
 */
export function renderToolUseMessage(): React.ReactNode {
	return null
}

/**
 * 渲染工具进度消息
 */
export function renderToolUseProgressMessage(): React.ReactNode {
	return null
}

/**
 * 渲染工具结果消息
 */
export function renderToolResultMessage({
											answers,
										}: {
	answers: Output['answers']
}): React.ReactNode {
	return <AskUserQuestionResultMessage answers={answers}/>
}

/**
 * 渲染工具使用被拒绝消息
 */
export function renderToolUseRejectedMessage(): React.ReactNode {
	return (
		<Box flexDirection="row" marginTop={1}>
			<Text color={getModeColor('default')}>{BLACK_CIRCLE}&nbsp;</Text>
			<Text>User declined to answer questions</Text>
		</Box>
	)
}

/**
 * 渲染工具错误消息
 */
export function renderToolUseErrorMessage(): React.ReactNode {
	return null
}

/**
 * 用户回答结果消息组件
 */
function AskUserQuestionResultMessage({
										  answers,
									  }: {
	answers: Output['answers']
}): React.ReactNode {
	return (
		<Box flexDirection="column" marginTop={1}>
			<Box flexDirection="row">
				<Text color={getModeColor('default')}>{BLACK_CIRCLE}&nbsp;</Text>
				<Text>User answered Claude&apos;s questions:</Text>
			</Box>
			<MessageResponse>
				<Box flexDirection="column">
					{Object.entries(answers).map(([questionText, answer]) => (
						<Text key={questionText} color="inactive">
							· {questionText} → {answer}
						</Text>
					))}
				</Box>
			</MessageResponse>
		</Box>
	)
}
