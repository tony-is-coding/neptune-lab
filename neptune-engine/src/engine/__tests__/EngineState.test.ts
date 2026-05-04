import { describe, expect, test, beforeEach, mock } from "bun:test";

// Mock EventBus to properly simulate event emission
class MockEventBus {
  private _listeners: Map<string, Array<(payload: unknown) => void>> = new Map();

  on(event: string, listener: (payload: unknown) => void): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push(listener);
    return () => {
      const list = this._listeners.get(event);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx > -1) list.splice(idx, 1);
      }
    };
  }

  emit(event: string, payload: unknown): void {
    const listeners = this._listeners.get(event) || [];
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (e) {
        // Suppress errors in tests
      }
    }
  }

  subscribe = this.on;
}

// Mock LogUtil to avoid bootstrap/state dependency
// 必须包含所有静态方法，防止 mock 污染其他测试
const _noop = () => {};
mock.module("src/engine/log/index.ts", () => ({
  LogUtil: {
    getInstance: () => ({
      child: () => ({
        child: () => ({ info: _noop, error: _noop, warn: _noop, debug: _noop }),
      }),
    }),
    debug: _noop,
    info: _noop,
    warn: _noop,
    error: _noop,
    print: _noop,
    setLevel: _noop,
    initialize: _noop,
    shutdown: async () => {},
  },
  EventBus: MockEventBus,
}));

// Mock external dependencies
mock.module("@claude-code-best/builtin-tools/tools/AgentTool/loadAgentsDir.js", () => ({
  loadAgentsDir: async () => ({
    activeAgents: [],
    allAgents: [],
  }),
}));

mock.module("@claude-code-best/builtin-tools/tools/ExitPlanModeTool/ExitPlanModeV2Tool.js", () => ({
  AllowedPrompt: {},
}));

mock.module("src/utils/commitAttribution.js", () => ({
  createEmptyAttributionState: () => ({
    commits: [],
    currentCommit: null,
  }),
}));

mock.module("src/Tool.js", () => ({
  getEmptyToolPermissionContext: () => ({
    permissions: [],
    dangerousPatterns: [],
    shellMode: "default",
  }),
}));

const { EngineState } = await import("../EngineState");
import type { EngineStateData } from "../EngineState";

// ─── EngineState ────────────────────────────────────────────────────────

describe("EngineState", () => {
  let state: InstanceType<typeof EngineState>;

  beforeEach(() => {
    state = new EngineState();
  });

  describe("initialization", () => {
    test("creates default state with all fields", () => {
      const data = state.data;
      expect(data).toBeDefined();
      expect(data.tasks).toEqual({});
      expect(data.agentNameRegistry).toBeInstanceOf(Map);
      expect(data.agentDefinitions).toEqual({
        activeAgents: [],
        allAgents: [],
      });
      expect(data.mcp.clients).toEqual([]);
      expect(data.mcp.tools).toEqual([]);
      expect(data.mcp.commands).toEqual([]);
      expect(data.mcp.resources).toEqual({});
      expect(data.plugins.enabled).toEqual([]);
      expect(data.plugins.disabled).toEqual([]);
      expect(data.plugins.errors).toEqual([]);
      expect(data.todos).toEqual({});
      expect(data.initialMessage).toBeNull();
      expect(data.pendingPlanVerification).toBeUndefined();
      expect(data.activeOverlays).toBeInstanceOf(Set);
    });

    test("accepts partial initial data", () => {
      const customState = new EngineState({
        tasks: { "task-1": { id: "task-1", subject: "Test" } as any },
        initialMessage: {
          message: { type: "user", content: "Initial" } as any,
        },
      });

      expect(customState.data.tasks).toHaveProperty("task-1");
      expect(customState.data.initialMessage).not.toBeNull();
    });
  });

  describe("getters", () => {
    test("provides read-only access to all state fields", () => {
      expect(state.tasks).toBeDefined();
      expect(state.agentNameRegistry).toBeDefined();
      expect(state.agentDefinitions).toBeDefined();
      expect(state.mcp).toBeDefined();
      expect(state.plugins).toBeDefined();
      expect(state.fileHistory).toBeDefined();
      expect(state.attribution).toBeDefined();
      expect(state.todos).toBeDefined();
      expect(state.toolPermissionContext).toBeDefined();
      expect(state.sessionHooks).toBeDefined();
      expect(state.initialMessage).toBeDefined();
      // pendingPlanVerification defaults to undefined
      expect(state.activeOverlays).toBeDefined();
    });

    test("data getter returns readonly state", () => {
      const data = state.data;
      expect(data).toBeDefined();
      // Verify it's the same object reference
      expect(state.data).toBe(data);
    });

    test("eventBus getter returns EventBus instance", () => {
      const eventBus = state.eventBus;
      expect(eventBus).toBeDefined();
    });
  });

  describe("setters", () => {
    test("setTasks updates tasks and emits event", () => {
      const newTasks = { "task-2": { id: "task-2", subject: "Test" } } as any;
      let eventReceived = false;

      state.subscribe((event: any) => {
        if (event.type === "tasks:changed") {
          eventReceived = true;
          expect(event.tasks).toBe(newTasks);
        }
      });

      state.setTasks(newTasks);
      expect(state.tasks).toBe(newTasks);
      expect(eventReceived).toBe(true);
    });

    test("setMcp updates mcp and emits event", () => {
      const newMcp = {
        clients: [],
        tools: [],
        commands: [],
        resources: {},
        pluginReconnectKey: 1,
      };
      let eventReceived = false;

      state.subscribe((event: any) => {
        if (event.type === "mcp:changed") {
          eventReceived = true;
          expect(event.mcp).toBe(newMcp);
        }
      });

      state.setMcp(newMcp);
      expect(state.mcp).toBe(newMcp);
      expect(eventReceived).toBe(true);
    });

    test("setPlugins updates plugins and emits event", () => {
      const newPlugins = {
        enabled: [{ id: "plugin-1" } as any],
        disabled: [],
        commands: [],
        errors: [],
        installationStatus: { marketplaces: [], plugins: [] },
        needsRefresh: false,
      };
      let eventReceived = false;

      state.subscribe((event: any) => {
        if (event.type === "plugins:changed") {
          eventReceived = true;
          expect(event.plugins).toBe(newPlugins);
        }
      });

      state.setPlugins(newPlugins as any);
      expect(state.plugins).toBe(newPlugins);
      expect(eventReceived).toBe(true);
    });

    test("setInitialMessage updates initialMessage and emits event", () => {
      const newMessage = {
        message: { type: "user", content: "New initial" } as any,
      };
      let eventReceived = false;

      state.subscribe((event: any) => {
        if (event.type === "initialMessage:changed") {
          eventReceived = true;
          expect(event.message).toBe(newMessage);
        }
      });

      state.setInitialMessage(newMessage as any);
      expect(state.initialMessage).toBe(newMessage);
      expect(eventReceived).toBe(true);
    });

    test("other setters emit state:changed event", () => {
      // Test each setter individually to ensure event emission works
      const testCases: Array<{
        field: keyof EngineStateData;
        setter: () => void;
      }> = [
        {
          field: "agentNameRegistry",
          setter: () => state.setAgentNameRegistry(new Map([["test", "agent-1"]]) as any),
        },
        {
          field: "agentDefinitions",
          setter: () => state.setAgentDefinitions({ activeAgents: [], allAgents: [] }),
        },
        {
          field: "fileHistory",
          setter: () =>
            state.setFileHistory({
              snapshots: [],
              trackedFiles: new Set(),
              snapshotSequence: 0,
            }),
        },
        {
          field: "attribution",
          setter: () => state.setAttribution({ commits: [], currentCommit: null } as any),
        },
        {
          field: "todos",
          setter: () => state.setTodos({ "agent-1": [] }),
        },
        {
          field: "toolPermissionContext",
          setter: () =>
            state.setToolPermissionContext({
              permissions: [],
              dangerousPatterns: [],
              shellMode: "default",
            } as any),        },
        {
          field: "sessionHooks",
          setter: () => state.setSessionHooks(new Map()),
        },
        {
          field: "pendingPlanVerification",
          setter: () =>
            state.setPendingPlanVerification({
              plan: "test plan",
              verificationStarted: false,
              verificationCompleted: false,
            }),
        },
        {
          field: "activeOverlays",
          setter: () => state.setActiveOverlays(new Set(["overlay-1"])),
        },
      ];

      for (const { field, setter } of testCases) {
        const events: unknown[] = [];

        const unsubscribe = state.subscribe((event: any) => {
          events.push(event);
        });

        setter();

        // Check for appropriate event based on field
        // toolPermissionContext triggers toolPermission:changed event
        // other fields trigger state:changed event
        const expectedEvent =
          field === "toolPermissionContext"
            ? events.find((e) => (e as { type: string }).type === "toolPermission:changed")
            : events.find(
                (e) =>
                  (e as { type: string; field: string }).type === "state:changed" &&
                  (e as { type: string; field: string }).field === field,
              );

        expect(expectedEvent).toBeDefined();
        unsubscribe();
      }
    });
  });

  describe("update method", () => {
    test("updates multiple fields atomically", () => {
      const updatedData = state.update((prev: any) => ({
        ...prev,
        tasks: { "task-1": { id: "task-1" } as any },
        initialMessage: {
          message: { type: "user", content: "Updated" } as any,
        },
      }));

      expect(state.tasks).toHaveProperty("task-1");
      expect(state.initialMessage).not.toBeNull();
    });

    test("emits state:changed event with field 'data'", () => {
      let eventReceived = false;

      state.subscribe((event: any) => {
        if (event.type === "state:changed" && event.field === "data") {
          eventReceived = true;
        }
      });

      state.update((prev: any) => ({
        ...prev,
        tasks: { "new": {} as any },
      }));

      expect(eventReceived).toBe(true);
    });
  });

  describe("event system", () => {
    test("subscribe returns unsubscribe function", () => {
      let callCount = 0;
      const unsubscribe = state.subscribe((_event: any) => {
        callCount++;
      });

      state.setTasks({ "test": {} as any });
      expect(callCount).toBe(1);

      unsubscribe();

      state.setTasks({ "test2": {} as any });
      expect(callCount).toBe(1); // Should not increase
    });

    test("multiple subscribers receive events", () => {
      let count1 = 0;
      let count2 = 0;

      state.subscribe((_event: any) => count1++);
      state.subscribe((_event: any) => count2++);

      state.setTasks({ "test": {} as any });

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    test("subscriber errors are caught and logged", () => {
      const errorListener = () => {
        throw new Error("Listener error");
      };

      state.subscribe(errorListener);

      // Should not throw despite listener error
      expect(() => {
        state.setTasks({ "test": {} as any });
      }).not.toThrow();
    });
  });

  describe("static fromAppStateData", () => {
    test("creates EngineState from partial AppState data", () => {
      const appStateData: Parameters<typeof EngineState.fromAppStateData>[0] = {
        tasks: { "task-1": { id: "task-1" } as any },
        mcp: {
          clients: [],
          tools: [],
          commands: [],
          resources: {},
          pluginReconnectKey: 5,
        },
      };

      const engineState = EngineState.fromAppStateData(appStateData);

      expect(engineState.tasks).toHaveProperty("task-1");
      expect(engineState.mcp.pluginReconnectKey).toBe(5);
    });

    test("uses defaults for missing fields", () => {
      const engineState = EngineState.fromAppStateData({});

      expect(engineState.tasks).toEqual({});
      expect(engineState.agentDefinitions).toEqual({
        activeAgents: [],
        allAgents: [],
      });
    });
  });
});
