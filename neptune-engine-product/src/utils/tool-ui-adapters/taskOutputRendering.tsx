import * as React from 'react';
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { Box, Text } from '@anthropic/ink';
import type { TaskType } from '../../Task.js';

export type TaskOutput = {
  task_id: string;
  task_type: TaskType;
  status: string;
  description: string;
  output: string;
  exitCode?: number | null;
  error?: string;
  // For agents
  prompt?: string;
  result?: string;
};

export type TaskOutputToolOutput = {
  retrieval_status: 'success' | 'timeout' | 'not_ready';
  task: TaskOutput | null;
};

const inputSchema = {
  task_id: '' as string,
  block: true as boolean,
  timeout: 30000 as number,
};
type InputSchema = typeof inputSchema;

export function renderToolUseMessage(input: Partial<InputSchema>): React.ReactNode {
  const { block = true } = input;
  if (!block) {
    return 'non-blocking';
  }
  return '';
}

export function renderToolUseTag(input: Partial<InputSchema>): React.ReactNode {
  if (!input.task_id) {
    return null;
  }
  return <Text dimColor> {input.task_id}</Text>;
}

export function renderToolUseProgressMessage(
  progressMessages: Array<{
    data?: { taskDescription?: string; taskType?: string };
  }>,
): React.ReactNode {
  const lastProgress = progressMessages[progressMessages.length - 1];
  const progressData = lastProgress?.data as { taskDescription?: string; taskType?: string } | undefined;

  return (
    <Box flexDirection="column">
      {progressData?.taskDescription && <Text>&nbsp;&nbsp;{progressData.taskDescription}</Text>}
      <Text>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Waiting for task <Text dimColor>(esc to give additional instructions)</Text>
      </Text>
    </Box>
  );
}

export function renderToolResultMessage(
  content: string | TaskOutputToolOutput,
  _unknown: unknown[],
  { verbose }: { verbose: boolean },
): React.ReactNode {
  return <TaskOutputResultDisplay content={content} verbose={verbose} />;
}

export function renderToolUseRejectedMessage(): React.ReactNode {
  return <Text color="subtle">Interrupted by user</Text>;
}

export function renderToolUseErrorMessage(
  result: ToolResultBlockParam['content'],
  { verbose }: { verbose: boolean },
): React.ReactNode {
  const error = typeof result === 'string' ? result.trim() : 'Task output retrieval failed';
  return <Text color="error">{verbose ? error : error.split('\n').slice(0, 10).join('\n')}</Text>;
}

function TaskOutputResultDisplay({
  content,
  verbose = false,
}: {
  content: string | TaskOutputToolOutput;
  verbose?: boolean;
}): React.ReactNode {
  const result: TaskOutputToolOutput = typeof content === 'string' ? JSON.parse(content) : content;

  if (!result.task) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No task output available</Text>
      </Box>
    );
  }

  const { task } = result;
  if (task.task_type === 'local_agent' || task.task_type === 'remote_agent') {
    return (
      <Box flexDirection="column">
        {task.prompt ? <Text dimColor>{task.prompt}</Text> : null}
        <Text>{task.result ?? task.output}</Text>
      </Box>
    );
  }

  if (task.task_type === 'local_bash') {
    return (
      <Box flexDirection="column">
        {task.exitCode !== undefined && task.exitCode !== null ? (
          <Text dimColor>Exit code: {task.exitCode}</Text>
        ) : null}
        {task.error ? <Text color="error">{task.error}</Text> : null}
        <Text>{verbose ? task.output : task.output.split('\n').slice(0, 20).join('\n')}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>{task.output}</Text>
    </Box>
  );
}
