import type { MessageBlock } from '../../types/chat';

interface ToolUseBlockProps {
  block: Extract<MessageBlock, { type: 'tool_use' }>;
  toolResult?: Extract<MessageBlock, { type: 'tool_result' }>;
  grouped?: boolean;
}

/**
 * ToolUseBlock — 工具调用展示
 *
 * 设计参考：Claude 风格
 * - 圆角容器 + 细边框
 * - 左侧状态图标（运行中/完成/错误）
 * - 工具中文描述 + 右侧展开箭头
 * - 遵循 DESIGN.md 暖色系设计规范
 */

/** 工具名称 → 中文描述映射 */
const TOOL_LABELS: Record<string, string> = {
  WebSearch: '搜索网页',
  WebFetch: '获取网页内容',
  Read: '读取文件',
  Write: '写入文件',
  Edit: '编辑文件',
  Bash: '执行命令',
  Glob: '搜索文件',
  Grep: '搜索内容',
  Agent: '调用子代理',
  Skill: '执行技能',
  AskUserQuestion: '等待用户回答',
  TaskCreate: '创建任务',
  TaskUpdate: '更新任务',
  TaskList: '查看任务列表',
  TodoWrite: '更新计划',
  NotebookEdit: '编辑笔记本',
};

/** 从工具名获取中文显示标签 */
function getToolLabel(name: string): string {
  // 精确匹配
  if (TOOL_LABELS[name]) return TOOL_LABELS[name];

  // MCP 工具：mcp__server__method → 提取 method 部分
  if (name.startsWith('mcp__')) {
    const parts = name.split('__');
    const method = parts[parts.length - 1] || name;
    return `调用 ${method}`;
  }

  // 其他：保留原名但加前缀
  return `执行 ${name}`;
}
/** 从 input 中提取简短摘要 */
function getInputSummary(name: string, input?: Record<string, unknown>): string | null {
  if (!input) return null;

  // WebSearch: show query
  if (name === 'WebSearch' && input.query) return String(input.query);
  // WebFetch: show url
  if (name === 'WebFetch' && input.url) return String(input.url).substring(0, 60);
  // Read: show file path
  if (name === 'Read' && input.file_path) return String(input.file_path).split('/').slice(-2).join('/');
  // Write: show file path
  if (name === 'Write' && input.file_path) return String(input.file_path).split('/').slice(-2).join('/');
  // Edit: show file path
  if (name === 'Edit' && input.file_path) return String(input.file_path).split('/').slice(-2).join('/');
  // Bash: show command (truncated)
  if (name === 'Bash' && input.command) return String(input.command).substring(0, 50);
  // Grep: show pattern
  if (name === 'Grep' && input.pattern) return String(input.pattern);
  // Glob: show pattern
  if (name === 'Glob' && input.pattern) return String(input.pattern);
  // Skill: show skill name + args
  if (name === 'Skill' && input.skill) return String(input.skill) + (input.args ? ` ${String(input.args).substring(0, 30)}` : '');
  // TodoWrite: show first todo subject
  if (name === 'TodoWrite' && input.todos) return '更新任务列表';

  // Generic: try common fields
  if (input.query) return String(input.query).substring(0, 60);
  if (input.description) return String(input.description).substring(0, 60);

  return null;
}

export function ToolUseBlock({ block, toolResult, grouped }: ToolUseBlockProps) {
  const isRunning = block.status === 'running';
  const isCompleted = block.status === 'completed';
  const isError = block.status === 'error';

  const displayName = getToolLabel(block.name);
  const summary = getInputSummary(block.name, block.input);

  // 在分组容器内时不需要外层边框
  if (grouped) {
    return (
      <div className="px-3 py-2 flex items-center gap-2">
        {isRunning && (
          <span className="w-[14px] h-[14px] rounded-full border-[1.5px] border-stone/30 border-t-stone animate-spin shrink-0" />
        )}
        {isCompleted && (
          <span className="w-[14px] h-[14px] rounded-full bg-stone/10 flex items-center justify-center shrink-0">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M2 5.5L4 7.5L8 3" stroke="#5e5d59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
        {isError && (
          <span className="w-[14px] h-[14px] rounded-full bg-[#b53333]/10 flex items-center justify-center shrink-0">
            <span className="text-[8px] text-[#b53333] font-bold">✕</span>
          </span>
        )}
        <span className="text-[12px] text-charcoal/80 flex-1 truncate">
          {displayName}
          {summary && <span className="text-stone/60 ml-1.5">— {summary}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="border border-border-cream rounded-[10px] overflow-hidden my-0.5">
      <div className="px-3 py-2 flex items-center gap-2">
        {isRunning && (
          <span className="w-[14px] h-[14px] rounded-full border-[1.5px] border-stone/30 border-t-stone animate-spin shrink-0" />
        )}
        {isCompleted && (
          <span className="w-[14px] h-[14px] rounded-full bg-stone/10 flex items-center justify-center shrink-0">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M2 5.5L4 7.5L8 3" stroke="#5e5d59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
        {isError && (
          <span className="w-[14px] h-[14px] rounded-full bg-[#b53333]/10 flex items-center justify-center shrink-0">
            <span className="text-[8px] text-[#b53333] font-bold">✕</span>
          </span>
        )}
        <span className="text-[12px] text-charcoal/80 flex-1 truncate">
          {displayName}
          {summary && <span className="text-stone/60 ml-1.5">— {summary}</span>}
        </span>
      </div>
    </div>
  );
}
