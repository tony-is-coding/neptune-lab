import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, MessageBlock, PlanTask, BackgroundTask } from '../types/chat';

let msgIdCounter = 0;
const genId = () => `msg-${++msgIdCounter}-${Date.now()}`;

// Mock scenarios — extended with task steps
const MOCK_SCENARIOS: Record<string, (content: string) => MockStep[]> = {
  default: (content) => [
    { delay: 400, action: 'thinking', content: `The user wants to: "${content}". Let me analyze this request and determine the best approach. I should break this down into steps and identify which tools I need to use.`, duration: 3 },
    { delay: 600, action: 'text', content: `I'll help you with that. Let me break this down into a plan first.` },

    // Create plan tasks
    { delay: 300, action: 'plan_task', task: { id: '1', subject: 'Research codebase', description: 'Analyze existing architecture, dependencies, and relevant files for the task.', status: 'pending', blocks: ['2', '3'], blockedBy: [] } },
    { delay: 100, action: 'plan_task', task: { id: '2', subject: 'Implement core logic', description: 'Write the main implementation based on research findings.', status: 'pending', blocks: ['4'], blockedBy: ['1'] } },
    { delay: 100, action: 'plan_task', task: { id: '3', subject: 'Write unit tests', description: 'Create comprehensive test cases for the new functionality.', status: 'pending', blocks: ['4'], blockedBy: ['1'] } },
    { delay: 100, action: 'plan_task', task: { id: '4', subject: 'Generate documentation', description: 'Document the changes and produce the final deliverable.', status: 'pending', blocks: [], blockedBy: ['2', '3'] } },

    { delay: 300, action: 'text', content: `\nI've created a 4-step execution plan. Let me start working on it.` },

    // Start task 1
    { delay: 400, action: 'plan_task_update', id: '1', status: 'in_progress', activeForm: 'Searching for relevant files...' },
    { delay: 600, action: 'tool_use', id: 'tool-search', name: 'search_files', input: { _summary: 'Searching for relevant files...', query: content }, status: 'running' },
    { delay: 1500, action: 'tool_status', id: 'tool-search', status: 'completed' },
    { delay: 200, action: 'tool_result', toolUseId: 'tool-search', output: { _summary: 'Found 8 relevant files', files: ['report_q3.xlsx', 'invoices/oct.pdf', 'data/summary.csv'] } },

    // Background task spawns
    { delay: 200, action: 'bg_task', task: { id: 'bg-shell-1', type: 'local_bash', description: 'npm run build', status: 'running', startTime: Date.now() } },

    // Complete task 1
    { delay: 500, action: 'plan_task_update', id: '1', status: 'completed' },
    { delay: 200, action: 'text', content: `\nResearch complete. Found 8 relevant files. Now starting implementation and tests in parallel.` },

    // Start task 2 + 3 in parallel
    { delay: 300, action: 'plan_task_update', id: '2', status: 'in_progress', activeForm: 'Implementing core logic...' },
    { delay: 100, action: 'plan_task_update', id: '3', status: 'in_progress', activeForm: 'Writing unit tests...' },
    { delay: 600, action: 'tool_use', id: 'tool-process', name: 'process_data', input: { _summary: 'Processing and analyzing data...', files: 8 }, status: 'running' },

    // Background task completes
    { delay: 800, action: 'bg_task_update', id: 'bg-shell-1', status: 'completed', summary: 'Build succeeded in 12s' },

    { delay: 1200, action: 'tool_status', id: 'tool-process', status: 'completed' },
    { delay: 200, action: 'tool_result', toolUseId: 'tool-process', output: { _summary: 'Processed 8 files, generated summary', records: 245 } },

    // Complete task 2 + 3
    { delay: 400, action: 'plan_task_update', id: '2', status: 'completed' },
    { delay: 200, action: 'plan_task_update', id: '3', status: 'completed' },
    { delay: 200, action: 'text', content: `\nImplementation and tests are done. Now generating the final documentation.` },

    // Start task 4
    { delay: 300, action: 'plan_task_update', id: '4', status: 'in_progress', activeForm: 'Generating documentation...' },
    { delay: 500, action: 'text', content: `\nAll done! Here's the summary:\n\n• Total value identified: $847,320\n• Top contributor: Acme Corp ($234,500)\n• Average transaction: $3,458\n• Trend: +12.4% vs previous quarter` },
    { delay: 300, action: 'artifact', id: 'artifact-report', title: 'Analysis Report', fileType: '.xlsx', content: JSON.stringify([
      { Vendor: 'Acme Corp', Amount: '$234,500', Invoices: '3', Status: 'Paid' },
      { Vendor: 'TechSupply Inc', Amount: '$189,200', Invoices: '2', Status: 'Pending' },
      { Vendor: 'GlobalParts Ltd', Amount: '$156,800', Invoices: '4', Status: 'Paid' },
      { Vendor: 'DataFlow Co', Amount: '$98,400', Invoices: '2', Status: 'Overdue' },
      { Vendor: 'CloudNet Systems', Amount: '$87,200', Invoices: '1', Status: 'Paid' },
    ], null, 2) },

    // Complete task 4
    { delay: 300, action: 'plan_task_update', id: '4', status: 'completed' },
    { delay: 0, action: 'done' },
  ],
};

type MockStep =
  | { delay: number; action: 'thinking'; content: string; duration: number }
  | { delay: number; action: 'text'; content: string }
  | { delay: number; action: 'tool_use'; id: string; name: string; input: Record<string, unknown>; status: 'running' }
  | { delay: number; action: 'tool_status'; id: string; status: 'completed' | 'error' }
  | { delay: number; action: 'tool_result'; toolUseId: string; output: Record<string, unknown> }
  | { delay: number; action: 'artifact'; id: string; title: string; fileType: string; content: string }
  | { delay: number; action: 'plan_task'; task: PlanTask }
  | { delay: number; action: 'plan_task_update'; id: string; status: PlanTask['status']; activeForm?: string }
  | { delay: number; action: 'bg_task'; task: BackgroundTask }
  | { delay: number; action: 'bg_task_update'; id: string; status: BackgroundTask['status']; summary?: string }
  | { delay: number; action: 'done' };

export function useChatMessages() {
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({});
  const [planTasksByAgent, setPlanTasksByAgent] = useState<Record<string, PlanTask[]>>({});
  const [bgTasksByAgent, setBgTasksByAgent] = useState<Record<string, BackgroundTask[]>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const getMessages = useCallback((agentId: string) => {
    return messagesByAgent[agentId] || [];
  }, [messagesByAgent]);

  const getPlanTasks = useCallback((agentId: string) => {
    return planTasksByAgent[agentId] || [];
  }, [planTasksByAgent]);

  const getBackgroundTasks = useCallback((agentId: string) => {
    return bgTasksByAgent[agentId] || [];
  }, [bgTasksByAgent]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const sendMessage = useCallback((agentId: string, content: string) => {
    if (isStreaming) return;

    clearTimers();
    setIsStreaming(true);

    // Add user message
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      blocks: [{ type: 'text', content }],
      status: 'complete',
    };

    // Create assistant message with empty blocks
    const assistantMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      blocks: [],
      status: 'streaming',
    };

    setMessagesByAgent(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), userMsg, assistantMsg],
    }));

    // Clear old tasks for this agent when starting new conversation
    setPlanTasksByAgent(prev => ({ ...prev, [agentId]: [] }));
    setBgTasksByAgent(prev => ({ ...prev, [agentId]: [] }));

    // Run mock scenario
    const steps = (MOCK_SCENARIOS[agentId] || MOCK_SCENARIOS.default)(content);
    let cumDelay = 0;

    for (const step of steps) {
      cumDelay += step.delay;
      const timer = setTimeout(() => {
        setMessagesByAgent(prev => {
          const agentMsgs = prev[agentId] || [];
          const lastMsg = agentMsgs[agentMsgs.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant') return prev;

          const newBlocks = [...lastMsg.blocks];

          switch (step.action) {
            case 'thinking':
              newBlocks.push({ type: 'thinking', content: step.content, duration: step.duration });
              break;

            case 'text': {
              // Find last text block and append, or create new one
              const lastBlock = newBlocks[newBlocks.length - 1];
              if (lastBlock?.type === 'text') {
                newBlocks[newBlocks.length - 1] = {
                  ...lastBlock,
                  content: lastBlock.content + step.content,
                };
              } else {
                newBlocks.push({ type: 'text', content: step.content });
              }
              break;
            }

            case 'tool_use':
              newBlocks.push({
                type: 'tool_use',
                id: step.id,
                name: step.name,
                input: step.input,
                status: step.status,
              });
              break;

            case 'tool_status': {
              const toolIdx = newBlocks.findIndex(
                (b): b is Extract<MessageBlock, { type: 'tool_use' }> =>
                  b.type === 'tool_use' && b.id === step.id
              );
              if (toolIdx >= 0) {
                newBlocks[toolIdx] = { ...newBlocks[toolIdx], status: step.status };
              }
              break;
            }

            case 'tool_result':
              newBlocks.push({
                type: 'tool_result',
                toolUseId: step.toolUseId,
                output: step.output,
              });
              break;

            case 'artifact':
              newBlocks.push({
                type: 'artifact',
                id: step.id,
                title: step.title,
                fileType: step.fileType,
                content: step.content,
              });
              break;

            case 'plan_task':
              setPlanTasksByAgent(prev => ({
                ...prev,
                [agentId]: [...(prev[agentId] || []), step.task],
              }));
              break;

            case 'plan_task_update':
              setPlanTasksByAgent(prev => {
                const tasks = prev[agentId] || [];
                return {
                  ...prev,
                  [agentId]: tasks.map(t =>
                    t.id === step.id
                      ? { ...t, status: step.status, activeForm: step.activeForm ?? t.activeForm }
                      : t
                  ),
                };
              });
              break;

            case 'bg_task':
              setBgTasksByAgent(prev => ({
                ...prev,
                [agentId]: [...(prev[agentId] || []), step.task],
              }));
              break;

            case 'bg_task_update':
              setBgTasksByAgent(prev => {
                const tasks = prev[agentId] || [];
                return {
                  ...prev,
                  [agentId]: tasks.map(t =>
                    t.id === step.id
                      ? {
                          ...t,
                          status: step.status,
                          summary: step.summary ?? t.summary,
                          endTime: (step.status === 'completed' || step.status === 'failed' || step.status === 'killed') ? Date.now() : t.endTime,
                        }
                      : t
                  ),
                };
              });
              break;

            case 'done':
              return {
                ...prev,
                [agentId]: agentMsgs.map((m, i) =>
                  i === agentMsgs.length - 1 ? { ...m, blocks: newBlocks, status: 'complete' as const } : m
                ),
              };
          }

          return {
            ...prev,
            [agentId]: agentMsgs.map((m, i) =>
              i === agentMsgs.length - 1 ? { ...m, blocks: newBlocks } : m
            ),
          };
        });

        if (step.action === 'done') {
          setIsStreaming(false);
        }
      }, cumDelay);

      timersRef.current.push(timer);
    }
  }, [isStreaming, clearTimers]);

  const addInitialMessages = useCallback((agentId: string, messages: ChatMessage[]) => {
    setMessagesByAgent(prev => {
      if (prev[agentId] && prev[agentId].length > 0) return prev;
      return { ...prev, [agentId]: messages };
    });
  }, []);

  return { getMessages, getPlanTasks, getBackgroundTasks, sendMessage, addInitialMessages, isStreaming };
}
