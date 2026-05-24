/**
 * userFacingName for FileEditTool —— substrate 层最小语义版
 *
 * 原 UI.tsx 里的版本依赖 cc product 的 `src/utils/plans.js` (getPlansDirectory)
 * substrate 不感知"plans 目录"业务概念，只暴露最小判定：
 *   - input.edits 非空 → "Update"（hashline edit 模式）
 *   - input.old_string === '' → "Create"
 *   - 其他 → "Update"
 *
 * 如果 product 层需要 "Updated plan" 这种 cc 特定文案，product 自己的
 * tool-ui-adapter 在渲染时按 plan 目录路径覆盖即可。
 */
export function userFacingName(
	input:
		| Partial<{
				file_path: string
				old_string: string
				new_string: string
				replace_all: boolean
				edits: unknown[]
		  }>
		| undefined,
): string {
	if (!input) {
		return 'Update'
	}
	// Hashline edits always modify an existing file (line-ref based)
	if (input.edits != null) {
		return 'Update'
	}
	if (input.old_string === '') {
		return 'Create'
	}
	return 'Update'
}
