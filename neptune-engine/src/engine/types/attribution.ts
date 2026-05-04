/**
 * engine/types/attribution.ts
 *
 * Attribution 类型屏障文件
 *
 * 重新导出 src/utils/commitAttribution.ts 的核心类型，避免 engine/ 向外穿透到 src/utils/。
 *
 * @module
 */

// 重新导出 Attribution 相关类型
export type {
	AttributionState,
	AttributionSummary,
	FileAttribution,
	AttributionData,
} from '../../utils/commitAttribution.js'

// 重新导出函数
export { getClientSurface, buildSurfaceKey } from '../../utils/commitAttribution.js'
