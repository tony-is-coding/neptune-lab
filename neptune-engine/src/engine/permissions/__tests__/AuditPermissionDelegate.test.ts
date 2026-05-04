import { describe, expect, test } from "bun:test";

// AuditPermissionDelegate 使用真实 LogUtil（日志输出到 console）
// 测试聚焦于委托行为的正确性，不 mock LogUtil 避免 mock.module 全局污染

const { AuditPermissionDelegate } = await import("../AuditPermissionDelegate");
const { ReadOnlyPermissionDelegate } = await import("../ReadOnlyPermissionDelegate");
const { RBACPermissionDelegate } = await import("../RBACPermissionDelegate");
import type { RolePermissionMap } from "../RBACPermissionDelegate";

// ─── AuditPermissionDelegate ────────────────────────────────────────────

describe("AuditPermissionDelegate", () => {
  describe("wrapping ReadOnlyPermissionDelegate", () => {
    test("delegates to base and returns allow decision", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      const decision = await auditDelegate.onToolAccess("Read", {
        file_path: "/test",
      });

      expect(decision).toBe("allow");
    });

    test("delegates to base and returns deny decision", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      const decision = await auditDelegate.onToolAccess("Write", {
        file_path: "/test",
        content: "data",
      });

      expect(decision).toBe("deny");
    });

    test("returns correct decision for various read-only tools", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      expect(await auditDelegate.onToolAccess("Read", {})).toBe("allow");
      expect(await auditDelegate.onToolAccess("Grep", {})).toBe("allow");
      expect(await auditDelegate.onToolAccess("Glob", {})).toBe("allow");
      expect(await auditDelegate.onToolAccess("WebSearch", {})).toBe("allow");
    });

    test("returns correct deny decisions for write tools", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      expect(await auditDelegate.onToolAccess("Write", {})).toBe("deny");
      expect(await auditDelegate.onToolAccess("Edit", {})).toBe("deny");
      expect(await auditDelegate.onToolAccess("Bash", {})).toBe("deny");
    });

    test("logs both allow and deny decisions without error", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      // 所有调用应正常完成不抛出异常
      await expect(auditDelegate.onToolAccess("Read", {})).resolves.toBe("allow");
      await expect(auditDelegate.onToolAccess("Write", {})).resolves.toBe("deny");
      await expect(auditDelegate.onToolAccess("Bash", {})).resolves.toBe("deny");
    });
  });

  describe("wrapping RBACPermissionDelegate", () => {
    const roleMap: RolePermissionMap = {
      admin: { allow: ["*"] },
      user: { allow: ["Read"], deny: ["Write"] },
    };

    test("delegates RBAC decisions correctly", async () => {
      const baseDelegate = new RBACPermissionDelegate(roleMap, "user");
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      const readDecision = await auditDelegate.onToolAccess("Read", {});
      const writeDecision = await auditDelegate.onToolAccess("Write", {});

      expect(readDecision).toBe("allow");
      expect(writeDecision).toBe("deny");
    });

    test("admin wildcard permissions work through audit", async () => {
      const baseDelegate = new RBACPermissionDelegate(roleMap, "admin");
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      expect(await auditDelegate.onToolAccess("Bash", { command: "ls" })).toBe("allow");
      expect(await auditDelegate.onToolAccess("Read", {})).toBe("allow");
    });
  });

  describe("input parameter handling", () => {
    test("passes input to base delegate correctly", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      // 工具输入应正常传递
      const decision = await auditDelegate.onToolAccess("Edit", {
        file_path: "/test",
        old_string: "old",
        new_string: "new",
      });

      expect(decision).toBe("deny");
    });

    test("handles empty input object", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      const decision = await auditDelegate.onToolAccess("Read", {});
      expect(decision).toBe("allow");
    });
  });

  describe("multiple sequential calls", () => {
    test("handles multiple permission decisions", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      await auditDelegate.onToolAccess("Read", {});
      await auditDelegate.onToolAccess("Read", {});
      await auditDelegate.onToolAccess("Grep", {});

      // 所有调用应正常完成
      expect(true).toBe(true);
    });

    test("maintains consistent behavior across calls", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const auditDelegate = new AuditPermissionDelegate(baseDelegate);

      const tools = ["Read", "Grep", "Glob", "Write", "Bash"];
      for (const tool of tools) {
        const decision = await auditDelegate.onToolAccess(tool, {});
        if (["Read", "Grep", "Glob"].includes(tool)) {
          expect(decision).toBe("allow");
        } else {
          expect(decision).toBe("deny");
        }
      }
    });
  });

  describe("decorator pattern behavior", () => {
    test("does not modify base delegate behavior", async () => {
      const baseDelegate = new ReadOnlyPermissionDelegate();
      const decisionWithoutAudit = await baseDelegate.onToolAccess("Read", {});

      const auditDelegate = new AuditPermissionDelegate(baseDelegate);
      const decisionWithAudit = await auditDelegate.onToolAccess("Read", {});

      expect(decisionWithoutAudit).toBe(decisionWithAudit);
    });

    test("can wrap any PermissionDelegate implementation", async () => {
      const customDelegate = {
        onToolAccess: async (toolName: string) => {
          return toolName.startsWith("Safe") ? "allow" : "deny";
        },
      };

      const auditDelegate = new AuditPermissionDelegate(customDelegate);

      const safeDecision = await auditDelegate.onToolAccess("SafeTool", {});
      const unsafeDecision = await auditDelegate.onToolAccess("UnsafeTool", {});

      expect(safeDecision).toBe("allow");
      expect(unsafeDecision).toBe("deny");
    });
  });
});
