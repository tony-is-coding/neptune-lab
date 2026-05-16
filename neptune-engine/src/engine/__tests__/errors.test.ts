import {describe, expect, test} from "bun:test";

const {EngineError, EngineErrorCode} = await import("../errors");
import type {EngineErrorCodeType} from "../errors";

// ─── EngineErrorCode ──────────────────────────────────────────────────────

describe("EngineErrorCode", () => {
	test("contains all session-related error codes", () => {
		expect(EngineErrorCode.SESSION_NOT_FOUND).toBe("SESSION_NOT_FOUND");
		expect(EngineErrorCode.SESSION_PAUSED).toBe("SESSION_PAUSED");
		expect(EngineErrorCode.SESSION_WORKSPACE_CONFLICT).toBe("SESSION_WORKSPACE_CONFLICT");
		expect(EngineErrorCode.SESSION_LIMIT_EXCEEDED).toBe("SESSION_LIMIT_EXCEEDED");
		expect(EngineErrorCode.SESSION_ALREADY_DESTROYED).toBe("SESSION_ALREADY_DESTROYED");
		expect(EngineErrorCode.SESSION_CREATE_FAILED).toBe("SESSION_CREATE_FAILED");
		expect(EngineErrorCode.SESSION_OPERATION_FAILED).toBe("SESSION_OPERATION_FAILED");
		expect(EngineErrorCode.SESSION_INVALID_OPERATION).toBe("SESSION_INVALID_OPERATION");
	});

	test("contains provider-related error codes", () => {
		expect(EngineErrorCode.AUTH_ERROR).toBe("AUTH_ERROR");
		expect(EngineErrorCode.RATE_LIMIT).toBe("RATE_LIMIT");
		expect(EngineErrorCode.NETWORK_ERROR).toBe("NETWORK_ERROR");
		expect(EngineErrorCode.PROVIDER_NOT_FOUND).toBe("PROVIDER_NOT_FOUND");
	});

	test("contains timeout and tool error codes", () => {
		expect(EngineErrorCode.TIMEOUT_ERROR).toBe("TIMEOUT_ERROR");
		expect(EngineErrorCode.TOOL_ERROR).toBe("TOOL_ERROR");
	});

	test("contains configuration and execution error codes", () => {
		expect(EngineErrorCode.CONFIGURATION_ERROR).toBe("CONFIGURATION_ERROR");
		expect(EngineErrorCode.EXECUTION_ERROR).toBe("EXECUTION_ERROR");
	});

	test("all error codes are const (readonly)", () => {
		// This test verifies that error codes maintain their values
		const originalCode = EngineErrorCode.SESSION_NOT_FOUND;
		// TypeScript readonly is compile-time only, but we verify the value stays consistent
		expect(EngineErrorCode.SESSION_NOT_FOUND).toBe(originalCode);
		expect(EngineErrorCode.SESSION_NOT_FOUND).toBe("SESSION_NOT_FOUND");
	});
});

// ─── EngineError ─────────────────────────────────────────────────────────

describe("EngineError", () => {
	test("creates error with code and message", () => {
		const error = new EngineError("SESSION_NOT_FOUND", "Session not found");
		expect(error.code).toBe("SESSION_NOT_FOUND");
		expect(error.message).toBe("Session not found");
		expect(error.name).toBe("EngineError");
	});

	test("supports cause chain via options", () => {
		const rootCause = new Error("Database connection failed");
		const error = new EngineError("SESSION_CREATE_FAILED", "Failed to create session", {
			cause: rootCause,
		});

		expect(error.cause).toBe(rootCause);
		expect(error.message).toBe("Failed to create session");
	});

	test("cause chain preserves stack information", () => {
		const rootCause = new Error("Root error");
		rootCause.stack = "Error: Root error\n    at test.js:10:15";

		const intermediateCause = new Error("Intermediate error", {cause: rootCause});
		const finalError = new EngineError("EXECUTION_ERROR", "Final error", {
			cause: intermediateCause,
		});

		expect(finalError.cause).toBe(intermediateCause);
		expect((finalError.cause as Error).cause).toBe(rootCause);
	});

	test("instanceof check works correctly", () => {
		const error = new EngineError("AUTH_ERROR", "Authentication failed");
		expect(error instanceof EngineError).toBe(true);
		expect(error instanceof Error).toBe(true);
	});

	test("all error codes can be used", () => {
		const codes: EngineErrorCodeType[] = [
			"SESSION_NOT_FOUND",
			"SESSION_PAUSED",
			"SESSION_WORKSPACE_CONFLICT",
			"SESSION_LIMIT_EXCEEDED",
			"SESSION_ALREADY_DESTROYED",
			"SESSION_CREATE_FAILED",
			"SESSION_OPERATION_FAILED",
			"SESSION_INVALID_OPERATION",
			"CONFIGURATION_ERROR",
			"EXECUTION_ERROR",
			"AUTH_ERROR",
			"RATE_LIMIT",
			"NETWORK_ERROR",
			"PROVIDER_NOT_FOUND",
			"TIMEOUT_ERROR",
			"TOOL_ERROR",
		];

		for (const code of codes) {
			const error = new EngineError(code, `Test ${code}`);
			expect(error.code).toBe(code);
			expect(error.name).toBe("EngineError");
		}
	});

	test("error without cause works correctly", () => {
		const error = new EngineError("CONFIGURATION_ERROR", "Invalid configuration");
		expect(error.cause).toBeUndefined();
		expect(error.code).toBe("CONFIGURATION_ERROR");
	});

	test("error can be thrown and caught", () => {
		expect(() => {
			throw new EngineError("RATE_LIMIT", "Rate limit exceeded");
		}).toThrow(EngineError);
	});

	test("error stack trace contains useful information", () => {
		const error = new EngineError("NETWORK_ERROR", "Connection failed");
		expect(error.stack).toContain("EngineError");
		expect(error.stack).toContain("Connection failed");
	});

	test("null/undefined cause is handled gracefully", () => {
		const error1 = new EngineError("PROVIDER_NOT_FOUND", "Provider not found", {
			cause: undefined as unknown as Error,
		});
		expect(error1.cause).toBeUndefined();

		const error2 = new EngineError("TIMEOUT_ERROR", "Request timeout", {
			cause: null as unknown as Error,
		});
		expect(error2.cause).toBeNull();
	});
});
