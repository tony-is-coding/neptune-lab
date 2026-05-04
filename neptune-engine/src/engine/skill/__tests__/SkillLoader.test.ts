import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";

const { loadSkillsToWorkspace, cleanupEngineSkills } = await import("../SkillLoader");
import type { SkillExtension } from "../SkillLoader";

// ─── Test utilities ────────────────────────────────────────────────────

let testWorkspace: string;

function createTestWorkspace(): string {
  const workspace = join(tmpdir(), `skill-test-${Date.now()}`);
  mkdirSync(workspace, { recursive: true });
  return workspace;
}

function cleanupTestWorkspace(workspace: string): void {
  if (existsSync(workspace)) {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function getSkillFileContent(workspace: string, skillName: string): string {
  const skillFile = join(workspace, ".claude", "skills", skillName, "SKILL.md");
  if (!existsSync(skillFile)) {
    throw new Error(`Skill file not found: ${skillFile}`);
  }
  return readFileSync(skillFile, "utf-8");
}

// ─── loadSkillsToWorkspace ─────────────────────────────────────────────

describe("loadSkillsToWorkspace", () => {
  beforeEach(() => {
    testWorkspace = createTestWorkspace();
  });

  afterEach(() => {
    cleanupTestWorkspace(testWorkspace);
  });

  test("creates skills directory structure", () => {
    const skills: SkillExtension[] = [
      {
        name: "test-skill",
        description: "Test skill",
        content: "Test content",
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    const skillDir = join(testWorkspace, ".claude", "skills", "test-skill");
    expect(existsSync(skillDir)).toBe(true);
    expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
  });

  test("writes skill markdown file with frontmatter", () => {
    const skills: SkillExtension[] = [
      {
        name: "test-skill",
        description: "Test skill description",
        content: "This is the skill content.",
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    const content = getSkillFileContent(testWorkspace, "test-skill");

    expect(content).toContain("---");
    expect(content).toContain("name: test-skill");
    expect(content).toContain("description: Test skill description");
    expect(content).toContain("source: engine-extension");
    expect(content).toContain("This is the skill content.");
  });

  test("includes optional frontmatter fields", () => {
    const skills: SkillExtension[] = [
      {
        name: "complex-skill",
        description: "Complex skill",
        content: "Content",
        whenToUse: "When testing",
        allowedTools: ["Read", "Write"],
        model: "claude-sonnet-4-20250514",
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    const content = getSkillFileContent(testWorkspace, "complex-skill");

    expect(content).toContain("when_to_use: When testing");
    expect(content).toContain("allowed-tools:");
    expect(content).toContain("  - Read");
    expect(content).toContain("  - Write");
    expect(content).toContain("model: claude-sonnet-4-20250514");
  });

  test("handles multiple skills", () => {
    const skills: SkillExtension[] = [
      {
        name: "skill-1",
        description: "First skill",
        content: "Content 1",
      },
      {
        name: "skill-2",
        description: "Second skill",
        content: "Content 2",
      },
      {
        name: "skill-3",
        description: "Third skill",
        content: "Content 3",
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    for (const skill of skills) {
      const skillDir = join(testWorkspace, ".claude", "skills", skill.name);
      expect(existsSync(skillDir)).toBe(true);
      expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
    }
  });

  test("overwrites existing skill files", () => {
    const skills1: SkillExtension[] = [
      {
        name: "test-skill",
        description: "Original description",
        content: "Original content",
      },
    ];

    loadSkillsToWorkspace(skills1, testWorkspace);

    const skills2: SkillExtension[] = [
      {
        name: "test-skill",
        description: "Updated description",
        content: "Updated content",
      },
    ];

    loadSkillsToWorkspace(skills2, testWorkspace);

    const content = getSkillFileContent(testWorkspace, "test-skill");

    expect(content).toContain("Updated description");
    expect(content).toContain("Updated content");
    expect(content).not.toContain("Original description");
  });

  test("handles skills with markdown content", () => {
    const markdownContent = `
# Heading

Some text with **bold** and *italic*.

- List item 1
- List item 2

\`\`\`typescript
const code = "here";
\`\`\`
    `.trim();

    const skills: SkillExtension[] = [
      {
        name: "markdown-skill",
        description: "Markdown skill",
        content: markdownContent,
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    const content = getSkillFileContent(testWorkspace, "markdown-skill");

    expect(content).toContain("# Heading");
    expect(content).toContain("**bold**");
    expect(content).toContain("*italic*");
    expect(content).toContain("```typescript");
  });

  test("handles skills with special characters in name", () => {
    const skills: SkillExtension[] = [
      {
        name: "skill-with-dashes",
        description: "Test",
        content: "Content",
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    const skillDir = join(testWorkspace, ".claude", "skills", "skill-with-dashes");
    expect(existsSync(skillDir)).toBe(true);
  });

  test("handles empty content", () => {
    const skills: SkillExtension[] = [
      {
        name: "empty-skill",
        description: "Empty skill",
        content: "",
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    const content = getSkillFileContent(testWorkspace, "empty-skill");

    expect(content).toContain("---");
    expect(content).toContain("name: empty-skill");
  });

  test("creates .claude directory if not exists", () => {
    const newWorkspace = join(tmpdir(), `no-claude-dir-${Date.now()}`);

    try {
      const skills: SkillExtension[] = [
        {
          name: "test-skill",
          description: "Test",
          content: "Content",
        },
      ];

      loadSkillsToWorkspace(skills, newWorkspace);

      const skillDir = join(newWorkspace, ".claude", "skills", "test-skill");
      expect(existsSync(skillDir)).toBe(true);
    } finally {
      cleanupTestWorkspace(newWorkspace);
    }
  });

  test("handles allowedTools array with single tool", () => {
    const skills: SkillExtension[] = [
      {
        name: "single-tool-skill",
        description: "Single tool",
        content: "Content",
        allowedTools: ["Read"],
      },
    ];

    loadSkillsToWorkspace(skills, testWorkspace);

    const content = getSkillFileContent(testWorkspace, "single-tool-skill");

    expect(content).toContain("allowed-tools:");
    expect(content).toContain("  - Read");
  });
});

// ─── cleanupEngineSkills ───────────────────────────────────────────────

describe("cleanupEngineSkills", () => {
  beforeEach(() => {
    testWorkspace = createTestWorkspace();
  });

  afterEach(() => {
    cleanupTestWorkspace(testWorkspace);
  });

  test("removes skills with engine-extension marker", () => {
    // Create engine skill
    const engineSkills: SkillExtension[] = [
      {
        name: "engine-skill",
        description: "Engine skill",
        content: "Content",
      },
    ];

    loadSkillsToWorkspace(engineSkills, testWorkspace);

    // Verify it exists
    const skillDir = join(testWorkspace, ".claude", "skills", "engine-skill");
    expect(existsSync(skillDir)).toBe(true);

    // Cleanup
    cleanupEngineSkills(testWorkspace);

    // Verify it's removed
    expect(existsSync(skillDir)).toBe(false);
  });

  test("preserves user-created skills without engine-extension marker", () => {
    const skillsDir = join(testWorkspace, ".claude", "skills", "user-skill");
    mkdirSync(skillsDir, { recursive: true });

    const userSkillContent = `---
name: user-skill
description: User created skill
---
User skill content
    `.trim();

    const { writeFileSync } = require("fs");
    writeFileSync(join(skillsDir, "SKILL.md"), userSkillContent, "utf-8");

    // Cleanup
    cleanupEngineSkills(testWorkspace);

    // User skill should still exist
    expect(existsSync(skillsDir)).toBe(true);
    const content = readFileSync(join(skillsDir, "SKILL.md"), "utf-8");
    expect(content).toContain("User skill content");
  });

  test("handles empty skills directory", () => {
    const skillsDir = join(testWorkspace, ".claude", "skills");
    mkdirSync(skillsDir, { recursive: true });

    // Should not throw
    expect(() => cleanupEngineSkills(testWorkspace)).not.toThrow();
  });

  test("handles non-existent skills directory", () => {
    const nonExistentWorkspace = join(tmpdir(), `non-existent-${Date.now()}`);

    // Should not throw
    expect(() => cleanupEngineSkills(nonExistentWorkspace)).not.toThrow();
  });

  test("removes only engine skills when mixed with user skills", () => {
    // Create engine skill
    const engineSkills: SkillExtension[] = [
      {
        name: "engine-skill",
        description: "Engine skill",
        content: "Content",
      },
    ];

    loadSkillsToWorkspace(engineSkills, testWorkspace);

    // Create user skill
    const userSkillDir = join(testWorkspace, ".claude", "skills", "user-skill");
    mkdirSync(userSkillDir, { recursive: true });

    const userSkillContent = `---
name: user-skill
description: User skill
---
User content
    `.trim();

    const { writeFileSync } = require("fs");
    writeFileSync(join(userSkillDir, "SKILL.md"), userSkillContent, "utf-8");

    // Cleanup
    cleanupEngineSkills(testWorkspace);

    // Engine skill should be removed
    expect(existsSync(join(testWorkspace, ".claude", "skills", "engine-skill"))).toBe(false);

    // User skill should remain
    expect(existsSync(userSkillDir)).toBe(true);
  });

  test("handles multiple engine skills", () => {
    const engineSkills: SkillExtension[] = [
      {
        name: "engine-1",
        description: "Engine 1",
        content: "Content 1",
      },
      {
        name: "engine-2",
        description: "Engine 2",
        content: "Content 2",
      },
      {
        name: "engine-3",
        description: "Engine 3",
        content: "Content 3",
      },
    ];

    loadSkillsToWorkspace(engineSkills, testWorkspace);

    // Verify all exist
    for (const skill of engineSkills) {
      const skillDir = join(testWorkspace, ".claude", "skills", skill.name);
      expect(existsSync(skillDir)).toBe(true);
    }

    // Cleanup
    cleanupEngineSkills(testWorkspace);

    // Verify all are removed
    for (const skill of engineSkills) {
      const skillDir = join(testWorkspace, ".claude", "skills", skill.name);
      expect(existsSync(skillDir)).toBe(false);
    }
  });
});

// ─── Integration tests ─────────────────────────────────────────────────

describe("SkillLoader integration", () => {
  beforeEach(() => {
    testWorkspace = createTestWorkspace();
  });

  afterEach(() => {
    cleanupTestWorkspace(testWorkspace);
  });

  test("load and cleanup cycle works correctly", () => {
    const skills: SkillExtension[] = [
      {
        name: "test-skill",
        description: "Test",
        content: "Content",
      },
    ];

    // Load
    loadSkillsToWorkspace(skills, testWorkspace);
    const skillDir = join(testWorkspace, ".claude", "skills", "test-skill");
    expect(existsSync(skillDir)).toBe(true);

    // Cleanup
    cleanupEngineSkills(testWorkspace);
    expect(existsSync(skillDir)).toBe(false);

    // Load again
    loadSkillsToWorkspace(skills, testWorkspace);
    expect(existsSync(skillDir)).toBe(true);
  });

  test("updating existing skill works correctly", () => {
    const skills1: SkillExtension[] = [
      {
        name: "test-skill",
        description: "Original",
        content: "Original content",
      },
    ];

    loadSkillsToWorkspace(skills1, testWorkspace);

    const skills2: SkillExtension[] = [
      {
        name: "test-skill",
        description: "Updated",
        content: "Updated content",
      },
    ];

    loadSkillsToWorkspace(skills2, testWorkspace);

    const content = getSkillFileContent(testWorkspace, "test-skill");
    expect(content).toContain("Updated");
    expect(content).toContain("source: engine-extension");

    // Cleanup should still work
    cleanupEngineSkills(testWorkspace);
    const skillDir = join(testWorkspace, ".claude", "skills", "test-skill");
    expect(existsSync(skillDir)).toBe(false);
  });
});
