import { EngineState } from '@neptune/engine/EngineState.js';
type Listener = () => void;
type OnChange<T> = (args: {
    newState: T;
    oldState: T;
}) => void;
export type Store<T> = {
    getState: () => T;
    setState: (updater: (prev: T) => T) => void;
    subscribe: (listener: Listener) => () => void;
    getEngineState: () => EngineState;
};
export declare function createStore<T>(initialState: T, onChange?: OnChange<T>): Store<T>;
export {};
//# sourceMappingURL=store.d.ts.map