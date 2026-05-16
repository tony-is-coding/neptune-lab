import {EngineState} from '../engine/EngineState.js'

type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

export type Store<T> = {
	getState: () => T
	setState: (updater: (prev: T) => T) => void
	subscribe: (listener: Listener) => () => void
	getEngineState: () => EngineState
}

export function createStore<T>(
	initialState: T,
	onChange?: OnChange<T>,
): Store<T> {
	let state = initialState
	const listeners = new Set<Listener>()
	// Create EngineState instance with initial A 类字段 from initialState
	const engineState = new EngineState({
		tasks: (initialState as any).tasks,
		agentNameRegistry: (initialState as any).agentNameRegistry,
		agentDefinitions: (initialState as any).agentDefinitions,
		mcp: (initialState as any).mcp,
		plugins: (initialState as any).plugins,
		fileHistory: (initialState as any).fileHistory,
		attribution: (initialState as any).attribution,
		todos: (initialState as any).todos,
		toolPermissionContext: (initialState as any).toolPermissionContext,
		sessionHooks: (initialState as any).sessionHooks,
		initialMessage: (initialState as any).initialMessage,
		pendingPlanVerification: (initialState as any).pendingPlanVerification,
		activeOverlays: (initialState as any).activeOverlays,
	})

	return {
		getState: () => state,

		setState: (updater: (prev: T) => T) => {
			const prev = state
			const next = updater(prev)
			if (Object.is(next, prev)) return
			state = next

			// Sync A 类字段 to EngineState
			const nextState = next as any
			engineState.setTasks(nextState.tasks)
			engineState.setAgentNameRegistry(nextState.agentNameRegistry)
			engineState.setAgentDefinitions(nextState.agentDefinitions)
			engineState.setMcp(nextState.mcp)
			engineState.setPlugins(nextState.plugins)
			engineState.setFileHistory(nextState.fileHistory)
			engineState.setAttribution(nextState.attribution)
			engineState.setTodos(nextState.todos)
			engineState.setToolPermissionContext(nextState.toolPermissionContext)
			engineState.setSessionHooks(nextState.sessionHooks)
			engineState.setInitialMessage(nextState.initialMessage)
			engineState.setPendingPlanVerification(nextState.pendingPlanVerification)
			engineState.setActiveOverlays(nextState.activeOverlays)

			onChange?.({newState: next, oldState: prev})
			for (const listener of listeners) listener()
		},

		subscribe: (listener: Listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},

		getEngineState: () => engineState,
	}
}
