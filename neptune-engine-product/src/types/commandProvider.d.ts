/**
 * 命令提供者接口
 *
 * 目的：解耦框架核心与 CLI 命令系统的直接依赖
 * - 框架核心通过此接口获取命令，不关心命令如何加载
 * - CLI 宿主实现此接口，在启动时注入到框架
 * - 支持未来扩展（如插件系统、远程命令发现等）
 */
import type { Command } from './command.js';
/**
 * 命令提供者接口
 *
 * CLI 宿主需要实现此接口的所有方法。
 * 每个方法对应原 commands.ts 中的一个导出函数。
 */
export interface ICommandProvider {
    /**
     * 获取所有可用命令（包括 skills、plugins、builtins）
     */
    getCommands(cwd: string): Promise<Command[]>;
    /**
     * 获取可作为技能调用的命令（用于 SkillTool）
     */
    getSlashCommandToolSkills(cwd: string): Promise<Command[]>;
    /**
     * 查找指定名称的命令
     */
    findCommand(commandName: string, commands: Command[]): Command | undefined;
    /**
     * 检查是否有指定命令
     */
    hasCommand(commandName: string, commands: Command[]): boolean;
    /**
     * 获取指定命令（不存在时抛出错误）
     */
    getCommand(commandName: string, commands: Command[]): Command;
    /**
     * 清除所有命令缓存（memoization + skill + plugin）
     */
    clearCommandsCache(): void;
    /**
     * 仅清除命令的 memoization 缓存
     */
    clearCommandMemoizationCaches(): void;
    /**
     * 获取所有内置命令名称（含别名）
     */
    getBuiltInCommandNames(): Set<string>;
    /**
     * 获取仅内部使用的命令列表
     */
    getInternalOnlyCommands(): Command[];
    /**
     * 获取远程模式下安全的命令集合
     */
    getRemoteSafeCommands(): Set<Command>;
    /**
     * 获取 Bridge 模式下安全的命令集合
     */
    getBridgeSafeCommands(): Set<Command>;
    /**
     * 检查命令是否在 Bridge 模式下安全
     */
    isBridgeSafeCommand(cmd: Command): boolean;
    /**
     * 过滤远程模式下的命令
     */
    filterCommandsForRemoteMode(commands: Command[]): Command[];
    /**
     * 格式化命令描述，附带来源标注
     */
    formatDescriptionWithSource(cmd: Command): string;
    /**
     * 检查命令是否满足可用性要求（auth/provider gating）
     */
    meetsAvailabilityRequirement(cmd: Command): boolean;
    /**
     * 获取 CLI 静态命令列表（不包括 skill/plugin 动态命令）
     * 用于框架侧加载命令时合并 CLI 命令
     */
    getStaticCommands(): Command[];
}
//# sourceMappingURL=commandProvider.d.ts.map