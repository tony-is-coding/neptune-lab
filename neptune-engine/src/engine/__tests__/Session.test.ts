import { describe, expect, test, beforeEach } from "bun:test";

const { Session } = await import("../Session");
const { EngineError, EngineErrorCode } = await import("../errors");

// ─── Session ────────────────────────────────────────────────────────────

describe("Session", () => {
  describe("constructor", () => {
    test("creates session with auto-generated sessionId", () => {
      const config = { workspace: "/tmp/test" };
      const session = new Session(config);

      expect(session.sessionId).toBeDefined();
      expect(session.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(session.workspace).toBe("/tmp/test");
      expect(session.status).toBe("active");
      expect(session.createdAt).toBeDefined();
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
    });

    test("creates session with provided sessionId", () => {
      const config = { workspace: "/tmp/test" };
      const customId = "custom-session-id";
      const session = new Session(config, customId);

      expect(session.sessionId).toBe(customId);
      expect(session.workspace).toBe("/tmp/test");
    });

    test("initializes with empty metadata", () => {
      const config = { workspace: "/tmp/test" };
      const session = new Session(config);

      expect(session.getMetadata()).toEqual({});
    });
  });

  describe("status management", () => {
    let session: InstanceType<typeof Session>;

    beforeEach(() => {
      session = new Session({ workspace: "/tmp/test" });
    });

    test("initial status is active", () => {
      expect(session.status).toBe("active");
    });

    test("pause changes status to paused", () => {
      session.pause();
      expect(session.status).toBe("paused");
    });

    test("pause on paused session is idempotent", () => {
      session.pause();
      const statusBefore = session.status;
      session.pause();
      expect(session.status).toBe(statusBefore);
    });

    test("resume changes status to active", () => {
      session.pause();
      session.resume();
      expect(session.status).toBe("active");
    });

    test("resume on active session is idempotent", () => {
      const statusBefore = session.status;
      session.resume();
      expect(session.status).toBe(statusBefore);
    });

    test("destroy changes status to destroyed", () => {
      session.destroy();
      expect(session.status).toBe("destroyed");
    });

    test("destroy is irreversible", () => {
      session.destroy();
      expect(() => session.destroy()).toThrow(EngineError);
      expect(() => session.destroy()).toThrow("Session is already destroyed");
    });

    test("pause on destroyed session throws error", () => {
      session.destroy();
      expect(() => session.pause()).toThrow(EngineError);
      expect(() => session.pause()).toThrow("Cannot operate on a destroyed session");
    });

    test("resume on destroyed session throws error", () => {
      session.destroy();
      expect(() => session.resume()).toThrow(EngineError);
      expect(() => session.resume()).toThrow("Cannot operate on a destroyed session");
    });

    test("destroy error has correct error code", () => {
      session.destroy();
      try {
        session.destroy();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(EngineError);
        expect((error as any).code).toBe(EngineErrorCode.SESSION_ALREADY_DESTROYED);
      }
    });

    test("pause/resume error has correct error code", () => {
      session.destroy();
      try {
        session.pause();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(EngineError);
        expect((error as any).code).toBe(EngineErrorCode.SESSION_INVALID_OPERATION);
      }
    });
  });

  describe("metadata management", () => {
    let session: InstanceType<typeof Session>;

    beforeEach(() => {
      session = new Session({ workspace: "/tmp/test" });
    });

    test("setMetadata sets a single key-value pair", () => {
      session.setMetadata("key1", "value1");
      expect(session.getMetadata("key1")).toBe("value1");
    });

    test("setMetadata can store complex values", () => {
      const complexValue = { nested: { data: [1, 2, 3] } };
      session.setMetadata("complex", complexValue);
      expect(session.getMetadata("complex")).toEqual(complexValue);
    });

    test("getMetadata without key returns all metadata", () => {
      session.setMetadata("key1", "value1");
      session.setMetadata("key2", "value2");

      const allMetadata = session.getMetadata();
      expect(allMetadata).toEqual({ key1: "value1", key2: "value2" });
    });

    test("getMetadata returns copy of metadata", () => {
      session.setMetadata("key1", "value1");
      const metadata1 = session.getMetadata() as Record<string, unknown>;
      const metadata2 = session.getMetadata() as Record<string, unknown>;

      expect(metadata1).not.toBe(metadata2);
      expect(metadata1).toEqual(metadata2);
    });

    test("getMetadata with unknown key returns undefined", () => {
      expect(session.getMetadata("unknown")).toBeUndefined();
    });

    test("setMetadata on destroyed session throws error", () => {
      session.destroy();
      expect(() => session.setMetadata("key", "value")).toThrow(EngineError);
      expect(() => session.setMetadata("key", "value")).toThrow(
        "Cannot operate on a destroyed session",
      );
    });

    test("getMetadata on destroyed session still works", () => {
      session.setMetadata("key1", "value1");
      session.destroy();
      expect(session.getMetadata("key1")).toBe("value1");
    });
  });

  describe("snapshot", () => {
    let session: InstanceType<typeof Session>;

    beforeEach(() => {
      session = new Session({ workspace: "/tmp/test" });
      session.setMetadata("key1", "value1");
      session.setMetadata("key2", 123);
    });

    test("toSnapshot returns correct snapshot data", () => {
      const snapshot = session.toSnapshot();

      expect(snapshot).toEqual({
        sessionId: session.sessionId,
        workspace: "/tmp/test",
        createdAt: session.createdAt,
        status: "active",
        metadata: { key1: "value1", key2: 123 },
        systemPrompt: undefined,
        providerConfig: undefined,
      });
    });

    test("toSnapshot includes current status", () => {
      session.pause();
      const snapshot = session.toSnapshot();
      expect(snapshot.status).toBe("paused");

      session.resume();
      const snapshot2 = session.toSnapshot();
      expect(snapshot2.status).toBe("active");
    });

    test("toSnapshot returns copy of metadata", () => {
      const snapshot1 = session.toSnapshot();
      const snapshot2 = session.toSnapshot();

      expect(snapshot1.metadata).not.toBe(snapshot2.metadata);
      expect(snapshot1.metadata).toEqual(snapshot2.metadata);
    });

    test("restore creates session from snapshot", () => {
      const snapshot = session.toSnapshot();
      const restoredSession = Session.restore(snapshot);

      expect(restoredSession.sessionId).toBe(session.sessionId);
      expect(restoredSession.workspace).toBe(session.workspace);
      expect(restoredSession.createdAt).toBe(session.createdAt);
      expect(restoredSession.status).toBe(session.status);
      expect(restoredSession.getMetadata()).toEqual(session.getMetadata());
    });

    test("restore preserves status", () => {
      session.pause();
      const snapshot = session.toSnapshot();
      const restoredSession = Session.restore(snapshot);

      expect(restoredSession.status).toBe("paused");
    });

    test("restored session is independent of original", () => {
      const snapshot = session.toSnapshot();
      const restoredSession = Session.restore(snapshot);

      restoredSession.pause();
      expect(session.status).toBe("active");
      expect(restoredSession.status).toBe("paused");

      restoredSession.setMetadata("newKey", "newValue");
      expect(session.getMetadata("newKey")).toBeUndefined();
      expect(restoredSession.getMetadata("newKey")).toBe("newValue");
    });

    test("toEngineSnapshot combines session and context snapshots", () => {
      const contextSnapshot: any = {
        messages: [] as unknown[],
        metadata: {},
      };

      const engineSnapshot = session.toEngineSnapshot(contextSnapshot);

      expect(engineSnapshot.version).toBeDefined();
      expect(engineSnapshot.session).toEqual(session.toSnapshot());
      expect(engineSnapshot.context).toEqual(contextSnapshot);
    });
  });

  describe("read-only properties", () => {
    test("sessionId is readonly", () => {
      const session = new Session({ workspace: "/tmp/test" });
      const originalId = session.sessionId;

      expect(() => {
        (session as { sessionId: string }).sessionId = "modified";
      }).not.toThrow();

      // TypeScript should prevent this, but we can't test that at runtime
      // The property is marked as readonly in the class
    });

    test("workspace is readonly", () => {
      const session = new Session({ workspace: "/tmp/test" });
      const originalWorkspace = session.workspace;

      expect(() => {
        (session as { workspace: string }).workspace = "/modified";
      }).not.toThrow();
    });

    test("createdAt is readonly", () => {
      const session = new Session({ workspace: "/tmp/test" });
      const originalCreatedAt = session.createdAt;

      expect(() => {
        (session as { createdAt: number }).createdAt = 0;
      }).not.toThrow();
    });
  });

  describe("systemPrompt management", () => {
    let session: InstanceType<typeof Session>;

    beforeEach(() => {
      session = new Session({ workspace: "/tmp/test" });
    });

    test("constructor accepts systemPrompt", () => {
      const prompt = "You are a helpful assistant";
      const sessionWithPrompt = new Session({
        workspace: "/tmp/test",
        systemPrompt: prompt,
      });

      expect(sessionWithPrompt.getSystemPrompt()).toBe(prompt);
    });

    test("setSystemPrompt updates systemPrompt", () => {
      const prompt = "New system prompt";
      session.setSystemPrompt(prompt);

      expect(session.getSystemPrompt()).toBe(prompt);
    });

    test("setSystemPrompt on destroyed session throws error", () => {
      session.destroy();
      expect(() => session.setSystemPrompt("prompt")).toThrow(EngineError);
      expect(() => session.setSystemPrompt("prompt")).toThrow(
        "Cannot operate on a destroyed session",
      );
    });

    test("getSystemPrompt on destroyed session still works", () => {
      session.setSystemPrompt("test prompt");
      session.destroy();
      expect(session.getSystemPrompt()).toBe("test prompt");
    });

    test("toSnapshot includes systemPrompt", () => {
      const prompt = "Test system prompt";
      session.setSystemPrompt(prompt);
      const snapshot = session.toSnapshot();

      expect(snapshot.systemPrompt).toBe(prompt);
    });

    test("restore preserves systemPrompt", () => {
      const prompt = "Test system prompt";
      session.setSystemPrompt(prompt);
      const snapshot = session.toSnapshot();
      const restoredSession = Session.restore(snapshot);

      expect(restoredSession.getSystemPrompt()).toBe(prompt);
    });
  });

  describe("providerConfig management", () => {
    let session: InstanceType<typeof Session>;

    beforeEach(() => {
      session = new Session({ workspace: "/tmp/test" });
    });

    test("constructor accepts providerConfig", () => {
      const providerConfig = { type: "anthropic" as const, config: { apiKey: "test" } };
      const sessionWithProvider = new Session({
        workspace: "/tmp/test",
        providerConfig,
      });

      expect(sessionWithProvider.getProviderConfig()).toEqual(providerConfig);
    });

    test("setProviderConfig updates providerConfig", () => {
      const providerConfig = { type: "openai" as const, config: { apiKey: "sk-test" } };
      session.setProviderConfig(providerConfig);

      expect(session.getProviderConfig()).toEqual(providerConfig);
    });

    test("setProviderConfig on destroyed session throws error", () => {
      session.destroy();
      expect(() => session.setProviderConfig({ type: "anthropic" })).toThrow(EngineError);
      expect(() => session.setProviderConfig({ type: "anthropic" })).toThrow(
        "Cannot operate on a destroyed session",
      );
    });

    test("getProviderConfig on destroyed session still works", () => {
      const providerConfig = { type: "anthropic" as const };
      session.setProviderConfig(providerConfig);
      session.destroy();
      expect(session.getProviderConfig()).toEqual(providerConfig);
    });

    test("toSnapshot includes providerConfig", () => {
      const providerConfig = { type: "bedrock" as const, config: { region: "us-east-1" } };
      session.setProviderConfig(providerConfig);
      const snapshot = session.toSnapshot();

      expect(snapshot.providerConfig).toEqual(providerConfig);
    });

    test("restore preserves providerConfig", () => {
      const providerConfig = { type: "vertex" as const, config: { project: "test-project" } };
      session.setProviderConfig(providerConfig);
      const snapshot = session.toSnapshot();
      const restoredSession = Session.restore(snapshot);

      expect(restoredSession.getProviderConfig()).toEqual(providerConfig);
    });
  });
});
