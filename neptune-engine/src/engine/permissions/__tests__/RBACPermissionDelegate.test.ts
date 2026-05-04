import { describe, expect, test } from "bun:test";

// RBACPermissionDelegate 不依赖 LogUtil，无需 mock

const { RBACPermissionDelegate } = await import("../RBACPermissionDelegate");
import type { RolePermissionMap, ToolPermissionRule } from "../RBACPermissionDelegate";

// ─── RBACPermissionDelegate ─────────────────────────────────────────────

describe("RBACPermissionDelegate", () => {
  describe("admin role with wildcard permission", () => {
    const roleMap: RolePermissionMap = {
      admin: { allow: ["*"] },
    };

    test("allows all tools with wildcard", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "admin");
      expect(await delegate.onToolAccess("Read", {})).toBe("allow");
      expect(await delegate.onToolAccess("Write", {})).toBe("allow");
      expect(await delegate.onToolAccess("Bash", {})).toBe("allow");
      expect(await delegate.onToolAccess("CustomTool", {})).toBe("allow");
    });
  });

  describe("user role with allow/deny lists", () => {
    const roleMap: RolePermissionMap = {
      user: {
        allow: ["Read", "Write", "Grep", "Glob"],
        deny: ["Delete"],
      },
    };

    test("allows tools in allow list", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("Read", {})).toBe("allow");
      expect(await delegate.onToolAccess("Write", {})).toBe("allow");
      expect(await delegate.onToolAccess("Grep", {})).toBe("allow");
      expect(await delegate.onToolAccess("Glob", {})).toBe("allow");
    });

    test("denies tools in deny list (priority over allow)", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("Delete", {})).toBe("deny");
    });

    test("returns ask for tools not in allow list", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("Bash", {})).toBe("ask");
      expect(await delegate.onToolAccess("Edit", {})).toBe("ask");
    });

    test("deny list takes priority over allow list", async () => {
      const roleMapWithConflict: RolePermissionMap = {
        user: {
          allow: ["*"],
          deny: ["Delete"],
        },
      };
      const delegate = new RBACPermissionDelegate(roleMapWithConflict, "user");
      expect(await delegate.onToolAccess("Read", {})).toBe("allow");
      expect(await delegate.onToolAccess("Delete", {})).toBe("deny");
    });
  });

  describe("wildcard prefix matching", () => {
    const roleMap: RolePermissionMap = {
      user: {
        allow: ["File*", "Web*"],
        deny: ["FileDelete*"],
      },
    };

    test("allows tools matching prefix wildcard", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("FileRead", {})).toBe("allow");
      expect(await delegate.onToolAccess("FileWrite", {})).toBe("allow");
      expect(await delegate.onToolAccess("WebSearch", {})).toBe("allow");
      expect(await delegate.onToolAccess("WebFetch", {})).toBe("allow");
    });

    test("denies tools matching deny prefix wildcard", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("FileDelete", {})).toBe("deny");
      expect(await delegate.onToolAccess("FileDeleteAll", {})).toBe("deny");
    });

    test("returns ask for non-matching tools", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("Bash", {})).toBe("ask");
      expect(await delegate.onToolAccess("Edit", {})).toBe("ask");
    });
  });

  describe("readonly role", () => {
    const roleMap: RolePermissionMap = {
      readonly: {
        allow: ["Read", "Grep", "Glob"],
      },
    };

    test("only allows read-only tools", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "readonly");
      expect(await delegate.onToolAccess("Read", {})).toBe("allow");
      expect(await delegate.onToolAccess("Grep", {})).toBe("allow");
      expect(await delegate.onToolAccess("Glob", {})).toBe("allow");
    });

    test("denies write operations", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "readonly");
      expect(await delegate.onToolAccess("Write", {})).toBe("ask");
      expect(await delegate.onToolAccess("Edit", {})).toBe("ask");
      expect(await delegate.onToolAccess("Bash", {})).toBe("ask");
    });
  });

  describe("unknown role", () => {
    const roleMap: RolePermissionMap = {
      admin: { allow: ["*"] },
    };

    test("returns ask for unknown role", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "unknown");
      expect(await delegate.onToolAccess("Read", {})).toBe("ask");
      expect(await delegate.onToolAccess("Write", {})).toBe("ask");
      expect(await delegate.onToolAccess("Bash", {})).toBe("ask");
    });
  });

  describe("role switching", () => {
    const roleMap: RolePermissionMap = {
      admin: { allow: ["*"] },
      readonly: { allow: ["Read", "Grep"] },
      user: { allow: ["Read", "Write"] },
    };

    test("setRole changes current role", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "readonly");
      expect(await delegate.onToolAccess("Write", {})).toBe("ask");

      delegate.setRole("admin");
      expect(await delegate.onToolAccess("Write", {})).toBe("allow");
    });

    test("getRole returns current role", () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(delegate.getRole()).toBe("user");

      delegate.setRole("admin");
      expect(delegate.getRole()).toBe("admin");
    });

    test("switching to unknown role returns ask", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "admin");
      expect(await delegate.onToolAccess("Read", {})).toBe("allow");

      delegate.setRole("unknown");
      expect(await delegate.onToolAccess("Read", {})).toBe("ask");
    });
  });

  describe("empty allow/deny lists", () => {
    test("empty rule returns ask for all tools", async () => {
      const roleMap: RolePermissionMap = {
        user: {},
      };
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("Read", {})).toBe("ask");
      expect(await delegate.onToolAccess("Write", {})).toBe("ask");
    });

    test("only deny list without allow list", async () => {
      const roleMap: RolePermissionMap = {
        user: {
          deny: ["Delete", "Bash"],
        },
      };
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("Delete", {})).toBe("deny");
      expect(await delegate.onToolAccess("Bash", {})).toBe("deny");
      expect(await delegate.onToolAccess("Read", {})).toBe("ask");
    });

    test("only allow list without deny list", async () => {
      const roleMap: RolePermissionMap = {
        user: {
          allow: ["Read", "Write"],
        },
      };
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      expect(await delegate.onToolAccess("Read", {})).toBe("allow");
      expect(await delegate.onToolAccess("Write", {})).toBe("allow");
      expect(await delegate.onToolAccess("Bash", {})).toBe("ask");
    });
  });

  describe("input parameter handling", () => {
    const roleMap: RolePermissionMap = {
      user: { allow: ["Read"] },
    };

    test("ignores input parameter", async () => {
      const delegate = new RBACPermissionDelegate(roleMap, "user");
      const decision1 = await delegate.onToolAccess("Read", {});
      const decision2 = await delegate.onToolAccess("Read", {
        file_path: "/etc/passwd",
      });
      expect(decision1).toBe("allow");
      expect(decision2).toBe("allow");
    });
  });
});
