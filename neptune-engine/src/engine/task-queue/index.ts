/**
 * TaskQueue protocol — public exports.
 *
 * See docs/strategy/neptune-engine-runtime-kernel-design.md §5.
 */

export type {
	AgentRef,
	Task,
	TaskEvent,
	TaskFilter,
	TaskInput,
	TaskOutput,
	TaskPatch,
	TaskQueue,
	TaskStatus,
} from './types.js'

export {InMemoryTaskQueue} from './InMemoryTaskQueue.js'
