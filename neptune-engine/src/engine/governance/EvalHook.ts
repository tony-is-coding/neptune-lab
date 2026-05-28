/**
 * governance/EvalHook.ts — Run 完成后触发评估
 *
 * Substrate 提供接口；product 接业务评分。默认 NoOp 返 null。
 */

export interface EvalHook {
	/**
	 * Run 完成时调用一次。返回 null 表示不评估。
	 *
	 * 实现可以异步触发评估、写入 EvalRun 等；engine 不感知 EvalRun 内部结构（product 自定义）。
	 */
	onRunComplete(runId: string, runResult: unknown): Promise<unknown | null>
}

export class NoOpEvalHook implements EvalHook {
	async onRunComplete(_runId: string, _runResult: unknown): Promise<null> {
		return null
	}
}

export const noOpEvalHook: EvalHook = new NoOpEvalHook()
