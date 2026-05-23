/**
 * KernelToolContext — extension of engine ToolUseContext exposing the
 * runtime kernel protocol implementations (Skill / Todo / TaskQueue /
 * ToolRegistry / Memory).
 *
 * Tools that depend on a protocol read it from `ctx.kernel.<protocol>`.
 * If a host doesn't inject the protocol, those tools fail closed (return
 * an error result) — engine kernel never silently no-ops on missing
 * protocol because that masks integration bugs.
 *
 * Why it lives here, not in `@neptune/engine`:
 *   - The opaque `ToolUseContext = {[key: string]: unknown}` shape in
 *     engine is intentional (legacy product callers see weak typing).
 *   - Builtin tools that program against protocols want strong typing;
 *     this file gives them a typed view without forcing engine kernel
 *     to commit to a richer ToolUseContext shape.
 */

import type {
	KernelToolRegistry,
	MemoryStore,
	SkillRegistry,
	TaskQueue,
	TodoState,
} from '@neptune/engine'

/** Bag of runtime kernel protocol instances injected by the host per session. */
export interface KernelProtocols {
	readonly skillRegistry?: SkillRegistry
	readonly todoState?: TodoState
	readonly taskQueue?: TaskQueue
	readonly toolRegistry?: KernelToolRegistry
	readonly memoryStore?: MemoryStore
}

/** Runtime context augmented with the kernel protocol bag. */
export type KernelToolContext = {
	readonly kernel?: KernelProtocols
	[key: string]: unknown
}

export const KERNEL_CONTEXT_KEY = 'kernel'

/** Helper: throws a stable error when a tool needs a protocol the host didn't inject. */
export function requireProtocol<K extends keyof KernelProtocols>(
	ctx: KernelToolContext,
	key: K,
): NonNullable<KernelProtocols[K]> {
	const value = ctx.kernel?.[key]
	if (!value) {
		throw new Error(
			`KernelToolContext missing required protocol "${String(key)}". ` +
				`The host must inject ctx.kernel.${String(key)} when creating the session.`,
		)
	}
	return value as NonNullable<KernelProtocols[K]>
}
