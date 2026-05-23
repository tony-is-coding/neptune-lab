/**
 * engine/types/command.ts
 *
 * Command 最小接口 — engine-local opaque type
 *
 * engine 层只需要把 Command 当作不透明容器传递给 QueryEngine，
 * 不需要完整的 product Command 类型。
 * 内联于此，消除对 @neptune/engine-product 的反向依赖。
 */

/** Opaque Command type — engine 内部只做透传，不解构 */
export type Command = {
	readonly name: string
	readonly description?: string
	[key: string]: unknown
}
