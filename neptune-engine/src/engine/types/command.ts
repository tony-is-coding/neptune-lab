/**
 * engine/types/command.ts - 重新导出 src/types/command.ts 的类型
 *
 * 此文件作为 engine/ 内部的类型声明层，避免从 engine/ 向外穿透到 src/types/
 * engine/ 内的文件应该从这里导入类型，而不是直接从 src/types/ 导入
 */

// 重新导出命令类型
export type {
  Command,
  CommandBase,
  PromptCommand,
  LocalCommandModule,
  LocalJSXCommandModule,
  LocalCommandCall,
  LocalJSXCommandCall,
  LocalCommandResult,
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
  ResumeEntrypoint,
  CommandResultDisplay,
  CommandAvailability,
} from '../../types/command.js'

// 重新导出辅助函数
export {
  getCommandName,
  isCommandEnabled,
} from '../../types/command.js'
