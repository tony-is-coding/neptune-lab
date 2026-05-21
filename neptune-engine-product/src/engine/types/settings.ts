/**
 * engine/types/settings.ts
 *
 * Settings 类型屏障文件
 *
 * 重新导出 src/utils/settings/ 的核心类型，避免 engine/ 向外穿透到 src/。
 *
 * @module
 */

// 重新导出 Settings 核心类型
// 注意：PluginConfig 已在 plugin.ts 中导出（来自 src/types/plugin.js），此处不再重复导出
export type {SettingsJson, UserConfigValues} from '../../utils/settings/types.js'
export {getInitialSettings} from '../../utils/settings/settings.js'
