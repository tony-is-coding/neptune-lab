/**
 * engine/types/model.ts
 *
 * Model 类型屏障文件
 *
 * 重新导出 src/utils/model/model.ts 的核心类型，避免 engine/ 向外穿透到 src/utils/。
 *
 * @module
 */

// 重新导出 Model 相关类型
export type {
	ModelShortName,
	ModelName,
	ModelSetting,
} from '@neptune/engine-product/utils/model/model.js'

// 重新导出函数
export {getSmallFastModel, isNonCustomOpusModel} from '@neptune/engine-product/utils/model/model.js'
