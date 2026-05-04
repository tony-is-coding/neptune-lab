import { describe, expect, test } from "bun:test";

// ReadOnlyPermissionDelegate 不依赖 LogUtil，无需 mock

const { ReadOnlyPermissionDelegate } = await import("../ReadOnlyPermissionDelegate");

// ─── ReadOnlyPermissionDelegate ────────────────────────────────────────

describe("ReadOnlyPermissionDelegate", () => {
  test("allows Read tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("Read", { file_path: "/test" });
    expect(decision).toBe("allow");
  });

  test("allows Grep tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("Grep", { pattern: "test" });
    expect(decision).toBe("allow");
  });

  test("allows Glob tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("Glob", { pattern: "*.ts" });
    expect(decision).toBe("allow");
  });

  test("allows WebSearch tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("WebSearch", { query: "test" });
    expect(decision).toBe("allow");
  });

  test("denies Write tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("Write", {
      file_path: "/test",
      content: "data",
    });
    expect(decision).toBe("deny");
  });

  test("denies Edit tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("Edit", {
      file_path: "/test",
      old_string: "old",
      new_string: "new",
    });
    expect(decision).toBe("deny");
  });

  test("denies Bash tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("Bash", { command: "rm -rf /" });
    expect(decision).toBe("deny");
  });

  test("allows Agent tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("Agent", { to: "test-agent" });
    expect(decision).toBe("allow");
  });

  test("allows WebFetch tool access", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("WebFetch", { url: "https://example.com" });
    expect(decision).toBe("allow");
  });

  test("denies unknown tools by default", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision = await delegate.onToolAccess("CustomTool", { param: "value" });
    expect(decision).toBe("deny");
  });

  test("ignores input parameter and only checks tool name", async () => {
    const delegate = new ReadOnlyPermissionDelegate();
    const decision1 = await delegate.onToolAccess("Read", {});
    const decision2 = await delegate.onToolAccess("Read", {
      file_path: "/etc/passwd",
    });
    expect(decision1).toBe("allow");
    expect(decision2).toBe("allow");
  });
});
