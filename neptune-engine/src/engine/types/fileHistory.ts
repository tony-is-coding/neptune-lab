/**
 * engine/types/fileHistory.ts
 *
 * FileHistory 类型屏障文件
 *
 * 重新导出 src/utils/fileHistory.ts 的核心类型，避免 engine/ 向外穿透到 src/utils/。
 *
 * @module
 */

// 重新导出 FileHistory 相关类型
export type {
	FileHistoryBackup,
	FileHistorySnapshot,
	FileHistoryState,
	DiffStats,
} from '@neptune/engine-product/utils/fileHistory.js'

// 重新导出函数
export {fileHistoryEnabled} from '@neptune/engine-product/utils/fileHistory.js'
