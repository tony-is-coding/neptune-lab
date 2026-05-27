import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightSidebar } from '../../components/collaborate/RightSidebar';
import type { PlanTask, PlanTodo } from '../../types/chat';
import type { ArtifactInfo } from '../../hooks/useArtifacts';
import type { RunDto } from '@shared/neptune-ai';

describe('RightSidebar', () => {
  const defaultProps = {
    planTasks: [] as PlanTask[],
    planTodos: [] as PlanTodo[],
    artifacts: [] as ArtifactInfo[],
    runs: [] as RunDto[],
    runsLoading: false,
    runsError: null as string | null,
    onCollapse: vi.fn(),
  };

  it('renders empty state when no tasks and no artifacts', () => {
    render(<RightSidebar {...defaultProps} />);
    expect(screen.getByText('发送消息后，任务进度和生成的文件将在此显示')).toBeInTheDocument();
  });

  it('renders task list from planTasks with progress', () => {
    const planTasks: PlanTask[] = [
      { id: '1', subject: '获取财务数据', description: '', status: 'completed', blocks: [], blockedBy: [] },
      { id: '2', subject: '分析数据', description: '', status: 'in_progress', blocks: [], blockedBy: [] },
      { id: '3', subject: '生成报告', description: '', status: 'pending', blocks: [], blockedBy: [] },
    ];

    render(<RightSidebar {...defaultProps} planTasks={planTasks} />);

    expect(screen.getByText('任务列表')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('获取财务数据')).toBeInTheDocument();
    expect(screen.getByText('分析数据')).toBeInTheDocument();
    expect(screen.getByText('生成报告')).toBeInTheDocument();
  });

  it('falls back to planTodos when planTasks is empty', () => {
    const planTodos: PlanTodo[] = [
      { content: '搜索网页', status: 'completed' },
      { content: '整理信息', status: 'in_progress' },
    ];

    render(<RightSidebar {...defaultProps} planTodos={planTodos} />);

    expect(screen.getByText('任务列表')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('搜索网页')).toBeInTheDocument();
    expect(screen.getByText('整理信息')).toBeInTheDocument();
  });

  it('prefers planTasks over planTodos when both exist', () => {
    const planTasks: PlanTask[] = [
      { id: '1', subject: 'Task from planTasks', description: '', status: 'completed', blocks: [], blockedBy: [] },
    ];
    const planTodos: PlanTodo[] = [
      { content: 'Todo from planTodos', status: 'pending' },
    ];

    render(<RightSidebar {...defaultProps} planTasks={planTasks} planTodos={planTodos} />);

    expect(screen.getByText('Task from planTasks')).toBeInTheDocument();
    expect(screen.queryByText('Todo from planTodos')).not.toBeInTheDocument();
  });

  it('renders artifacts card with file info', () => {
    const artifacts: ArtifactInfo[] = [
      { id: 'a1', title: 'report.html', fileType: '.html', content: '<h1>Hi</h1>', size: 48800, createdAt: '2025-05-13T23:33:00Z' },
      { id: 'a2', title: '分析报告.md', fileType: '.md', content: '# Report', size: 1024, createdAt: '2025-05-13T23:35:00Z' },
    ];

    render(<RightSidebar {...defaultProps} artifacts={artifacts} />);

    expect(screen.getByText('成果')).toBeInTheDocument();
    expect(screen.getByText('2 个文件')).toBeInTheDocument();
    expect(screen.getByText('report.html')).toBeInTheDocument();
    expect(screen.getByText('分析报告.md')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('MD')).toBeInTheDocument();
    // Size display
    expect(screen.getByText(/47\.7 KB/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
  });

  it('opens artifact detail view when clicking an artifact', () => {
    const artifacts: ArtifactInfo[] = [
      { id: 'a1', title: 'test.py', fileType: '.py', content: 'print(1)', size: 8, createdAt: '2025-05-13T10:00:00Z' },
    ];

    render(<RightSidebar {...defaultProps} artifacts={artifacts} />);

    fireEvent.click(screen.getByText('test.py'));
    // After clicking, should show the back button (detail view)
    expect(screen.getByTitle('返回')).toBeInTheDocument();
  });

  it('calls onCollapse when clicking collapse button', () => {
    const onCollapse = vi.fn();
    render(<RightSidebar {...defaultProps} onCollapse={onCollapse} />);

    fireEvent.click(screen.getByTitle('收起面板'));
    expect(onCollapse).toHaveBeenCalled();
  });

  it('shows both task list and artifacts when both exist', () => {
    const planTasks: PlanTask[] = [
      { id: '1', subject: '任务一', description: '', status: 'completed', blocks: [], blockedBy: [] },
    ];
    const artifacts: ArtifactInfo[] = [
      { id: 'a1', title: 'output.json', fileType: '.json', content: '{}', size: 2 },
    ];

    render(<RightSidebar {...defaultProps} planTasks={planTasks} artifacts={artifacts} />);

    expect(screen.getByText('任务列表')).toBeInTheDocument();
    expect(screen.getByText('成果')).toBeInTheDocument();
    // Empty state should NOT be shown
    expect(screen.queryByText('发送消息后，任务进度和生成的文件将在此显示')).not.toBeInTheDocument();
  });

  it('renders thread controlled runs with governance links', () => {
    const runs: RunDto[] = [{
      id: '33333333-3333-4333-8333-333333333333',
      tenantId: 'tenant-test',
      userId: 'user-test',
      agentId: 'agent-test',
      agentVersionId: 'version-test',
      threadId: 'thread-test',
      requestId: 'req-test',
      status: 'completed',
      model: 'neptune-controlled-model',
      inputTokens: 12,
      outputTokens: 34,
      costCents: 6,
      startedAt: '2026-05-22T10:00:00.000Z',
      completedAt: '2026-05-22T10:01:00.000Z',
      retryOfRunId: null,
    }];

    render(<RightSidebar {...defaultProps} runs={runs} />);

    expect(screen.getByText('关联运行')).toBeInTheDocument();
    expect(screen.getByText('受控运行 1 次')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('neptune-controlled-model')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '查看运行详情'})).toHaveAttribute(
      'href',
      '/governance?tab=runs&runId=33333333-3333-4333-8333-333333333333',
    );
    expect(screen.getByRole('link', {name: '查看审计链'})).toHaveAttribute(
      'href',
      '/governance?tab=audit&resourceType=run&resourceId=33333333-3333-4333-8333-333333333333',
    );
  });
});
