/**
 * Dev-mode global shims
 *
 * In production builds, MACRO.* constants are injected via Bun.build({ define })
 * or vite.config.ts defines. In dev mode (bun run --watch), they need runtime
 * definitions. This file must be the very first import in main.tsx.
 */

const PKG_VERSION = "1.3.7";

(globalThis as any).MACRO ??= {
	VERSION: PKG_VERSION,
	BUILD_TIME: new Date().toISOString(),
	FEEDBACK_CHANNEL:
		"https://github.com/claude-code-best/claude-code/issues",
	ISSUES_EXPLAINER: "",
	NATIVE_PACKAGE_URL: "",
	PACKAGE_URL: "https://github.com/claude-code-best/claude-code",
	VERSION_CHANGELOG: `https://github.com/claude-code-best/claude-code/releases/tag/${PKG_VERSION}`,
};
