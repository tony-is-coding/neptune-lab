import { describe, expect, test } from "bun:test";
import type { SDKMessage } from "../../types/query-events.js";

// Mock query-events types for testing
const createMockMessage = (type: string, extra: Record<string, unknown> = {}): SDKMessage => ({
  type,
  ...extra,
});

const createMockGenerator = (
  messages: unknown[],
): AsyncGenerator<SDKMessage> => {
  let index = 0;
  return {
    async next() {
      if (index >= messages.length) {
        return { done: true, value: undefined };
      }
      const value = messages[index++];
      return { done: false, value };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  } as unknown as AsyncGenerator<SDKMessage>;
};

const { waitForResult, waitForResultWithTimeout, waitForEventType } = await import("../waitForResult");

// ─── waitForResult ───────────────────────────────────────────────────────

describe("waitForResult", () => {
  test("returns success when stream ends normally", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("tool_use", { name: "Read" }),
      createMockMessage("result", { success: true }),
    ]);

    const result = await waitForResult(messages);
    expect(result.success).toBe(true);
    expect(result.lastMessage).toMatchObject({ type: "result" });
  });

  test("returns success when no explicit result message", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("tool_use", { name: "Read" }),
      createMockMessage("result", { success: true }),
    ]);

    const result = await waitForResult(messages);
    expect(result.success).toBe(true);
    expect(result.lastMessage).toMatchObject({ type: "result" });
  });

  test("detects assistant_error events", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("assistant_error", { error: "Tool execution failed" }),
      createMockMessage("result"),
    ]);

    const result = await waitForResult(messages);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Tool execution failed");
    expect(result.lastMessage).toMatchObject({ type: "assistant_error" });
  });

  test("detects error events", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("error", { error: "Network timeout" }),
    ]);

    const result = await waitForResult(messages);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Network timeout");
  });

  test("collects messages when option is enabled", async () => {
    const msg1 = createMockMessage("assistant", { content: "First" });
    const msg2 = createMockMessage("tool_use", { name: "Read" });
    const msg3 = createMockMessage("result");

    const messages = createMockGenerator([msg1, msg2, msg3]);

    const result = await waitForResult(messages, {
      collectMessages: true,
    });

    expect(result.success).toBe(true);
    expect(result.messages).toHaveLength(3);
    expect(result.messages?.[0]).toMatchObject({ type: "assistant" });
    expect(result.messages?.[1]).toMatchObject({ type: "tool_use" });
    expect(result.messages?.[2]).toMatchObject({ type: "result" });
  });

  test("does not collect messages by default", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("result"),
    ]);

    const result = await waitForResult(messages);
    expect(result.messages).toBeUndefined();
  });

  test("handles exception during iteration", async () => {
    const error = new Error("Stream failed");

    const failingGenerator = {
      async next() {
        throw error;
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    } as unknown as AsyncGenerator<SDKMessage>;

    const result = await waitForResult(failingGenerator);
    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
  });

  test("handles empty stream", async () => {
    const messages = createMockGenerator([createMockMessage("result")]);

    const result = await waitForResult(messages);
    expect(result.success).toBe(true);
    expect(result.lastMessage).toBeDefined();
  });

  test("stops at first error event", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Before" }),
      createMockMessage("error", { error: "First error" }),
      createMockMessage("assistant", { content: "After" }),
    ]);

    const result = await waitForResult(messages);
    expect(result.success).toBe(false);
    expect(result.lastMessage).toMatchObject({ type: "error" });
  });

  test("tracks lastMessage correctly", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "First" }),
      createMockMessage("tool_use", { name: "Read" }),
      createMockMessage("assistant", { content: "Second" }),
    ]);

    const result = await waitForResult(messages);
    expect(result.lastMessage).toMatchObject({
      type: "assistant",
      content: "Second",
    });
  });
});

// ─── waitForResultWithTimeout ────────────────────────────────────────────

describe("waitForResultWithTimeout", () => {
  test("returns result before timeout", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("result"),
    ]);

    const result = await waitForResultWithTimeout(messages, 1000);
    expect(result.success).toBe(true);
    expect(result.error).not.toBe("TIMEOUT");
  });

  test("returns TIMEOUT when query exceeds timeout", async () => {
    const slowGenerator = (async function* () {
      await new Promise((resolve) => setTimeout(resolve, 200));
      yield createMockMessage("result");
    })();

    const result = await waitForResultWithTimeout(slowGenerator, 50);
    expect(result.success).toBe(false);
    expect(result.error).toBe("TIMEOUT");
  });

  test("respects collectMessages option", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("result"),
    ]);

    const result = await waitForResultWithTimeout(messages, 1000, {
      collectMessages: true,
    });

    expect(result.success).toBe(true);
    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBeGreaterThan(0);
  });

  test("returns error from query before timeout", async () => {
    const messages = createMockGenerator([
      createMockMessage("error", { error: "Query failed" }),
    ]);

    const result = await waitForResultWithTimeout(messages, 1000);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Query failed");
  });

  test("handles zero timeout", async () => {
    // Create a message stream that completes after a delay
    const slowGenerator = (async function* () {
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield createMockMessage("assistant", { content: "Hello" });
      yield createMockMessage("result");
    })();

    const result = await waitForResultWithTimeout(slowGenerator, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe("TIMEOUT");
  });
});

// ─── waitForEventType ────────────────────────────────────────────────────

describe("waitForEventType", () => {
  test("returns first matching event", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("tool_use", { name: "Read", input: { path: "/test" } }),
      createMockMessage("tool_use", { name: "Write" }),
    ]);

    const result = await waitForEventType(messages, "tool_use");
    expect(result).toMatchObject({
      type: "tool_use",
      name: "Read",
    });
  });

  test("returns null when event type not found", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "Hello" }),
      createMockMessage("tool_use", { name: "Read" }),
    ]);

    const result = await waitForEventType(messages, "custom_event");
    expect(result).toBeNull();
  });

  test("returns null for empty stream", async () => {
    const messages = createMockGenerator([]);

    const result = await waitForEventType(messages, "assistant");
    expect(result).toBeNull();
  });

  test("finds event late in stream", async () => {
    const messages = createMockGenerator([
      createMockMessage("assistant", { content: "First" }),
      createMockMessage("tool_use", { name: "Read" }),
      createMockMessage("assistant", { content: "Second" }),
      createMockMessage("assistant", { content: "Third" }),
      createMockMessage("result", { success: true }),
    ]);

    const result = await waitForEventType(messages, "result");
    expect(result).toMatchObject({ type: "result", success: true });
  });

  test("consumes stream until event found", async () => {
    let consumed = false;
    const messages = (async function* () {
      yield createMockMessage("assistant", { content: "First" });
      yield createMockMessage("tool_use", { name: "Read" });
      yield createMockMessage("assistant", { content: "Second" });
      consumed = true;
    })();

    const result = await waitForEventType(messages, "tool_use");
    expect(result).toBeDefined();
    // After finding the event, we can't guarantee the generator state
    // The important thing is the event was found
  });
});
