import {describe, expect, test} from "bun:test";
import type {SDKMessage} from "../../types/query-events.js";

// Mock SDKMessage types for testing
const createAssistantMessage = (content: string | unknown[]): SDKMessage => ({
	type: "assistant",
	content,
});

const createToolUseMessage = (name: string, input: Record<string, unknown>): SDKMessage => ({
	type: "tool_use",
	name,
	input,
});

const createUserMessage = (content: string): SDKMessage => ({
	type: "user",
	content,
});

function createMockGenerator(messages: SDKMessage[]): AsyncGenerator<SDKMessage> {
	let index = 0;
	return {
		async next() {
			if (index >= messages.length) {
				return {done: true, value: undefined} as IteratorResult<SDKMessage>;
			}
			const value = messages[index++];
			return {done: false, value};
		},
		async return() {
			return {done: true, value: undefined} as IteratorResult<SDKMessage>;
		},
		async throw(error?: unknown) {
			throw error;
		},
		[Symbol.asyncIterator]() {
			return this;
		},
	} as unknown as AsyncGenerator<SDKMessage>;
}

const {collectText, collectTextWithMeta} = await import("../collectText");

// ─── collectText ────────────────────────────────────────────────────────

describe("collectText", () => {
	test("extracts text from string content assistant messages", async () => {
		const messages = createMockGenerator([
			createAssistantMessage("Hello, world!"),
			createAssistantMessage("How can I help?"),
		]);

		const text = await collectText(messages);
		expect(text).toBe("Hello, world!How can I help?");
	});

	test("extracts text from ContentBlock array format", async () => {
		const messages = createMockGenerator([
			createAssistantMessage([
				{type: "text", text: "First paragraph"},
				{type: "text", text: "Second paragraph"},
			]),
		]);

		const text = await collectText(messages);
		expect(text).toBe("First paragraphSecond paragraph");
	});

	test("filters out non-text blocks from ContentBlock array", async () => {
		const messages = createMockGenerator([
			createAssistantMessage([
				{type: "text", text: "Text content"},
				{type: "image", source: {type: "url", url: "https://example.com/image.png"}},
				{type: "text", text: "More text"},
			]),
		]);

		const text = await collectText(messages);
		expect(text).toBe("Text contentMore text");
	});

	test("handles empty text blocks", async () => {
		const messages = createMockGenerator([
			createAssistantMessage([
				{type: "text", text: "First"},
				{type: "text"},
				{type: "text", text: ""},
				{type: "text", text: "Last"},
			]),
		]);

		const text = await collectText(messages);
		expect(text).toBe("FirstLast");
	});

	test("ignores non-assistant messages", async () => {
		const messages = createMockGenerator([
			createUserMessage("User input"),
			createAssistantMessage("Assistant response"),
			createToolUseMessage("Read", {file_path: "/test"}),
		]);

		const text = await collectText(messages);
		expect(text).toBe("Assistant response");
	});

	test("returns empty string for stream with no assistant messages", async () => {
		const messages = createMockGenerator([
			createUserMessage("User input"),
			createToolUseMessage("Bash", {command: "ls"}),
		]);

		const text = await collectText(messages);
		expect(text).toBe("");
	});

	test("returns empty string for empty stream", async () => {
		const messages = createMockGenerator([]);

		const text = await collectText(messages);
		expect(text).toBe("");
	});

	test("handles mixed content formats", async () => {
		const messages = createMockGenerator([
			createAssistantMessage("String content"),
			createAssistantMessage([{type: "text", text: "Array content"}]),
			createAssistantMessage("Another string"),
		]);

		const text = await collectText(messages);
		expect(text).toBe("String contentArray contentAnother string");
	});

	test("handles malformed ContentBlock gracefully", async () => {
		const messages = createMockGenerator([
			createAssistantMessage([
				{type: "text", text: "Valid block"},
				{notAType: "unknown"},
				null,
				undefined,
				{type: "text", text: "Another valid"},
			]),
		]);

		const text = await collectText(messages);
		expect(text).toBe("Valid blockAnother valid");
	});

	test("handles ContentBlock with missing text property", async () => {
		const messages = createMockGenerator([
			createAssistantMessage([
				{type: "text", text: "Has text"},
				{type: "text"},
				{type: "text", text: "Also has text"},
			]),
		]);

		const text = await collectText(messages);
		expect(text).toBe("Has textAlso has text");
	});
});

// ─── collectTextWithMeta ────────────────────────────────────────────────

describe("collectTextWithMeta", () => {
	test("returns text and metadata for normal stream", async () => {
		const messages = createMockGenerator([
			createAssistantMessage("First"),
			createToolUseMessage("Read", {file_path: "/test"}),
			createAssistantMessage("Second"),
		]);

		const {text, metadata} = await collectTextWithMeta(messages);

		expect(text).toBe("FirstSecond");
		expect(metadata.messageCount).toBe(3);
		expect(metadata.typeCounts).toEqual({
			assistant: 2,
			tool_use: 1,
		});
	});

	test("counts message types correctly", async () => {
		const messages = createMockGenerator([
			createUserMessage("User 1"),
			createAssistantMessage("Assistant 1"),
			createToolUseMessage("Read", {file_path: "/test"}),
			createToolUseMessage("Write", {file_path: "/test2"}),
			createUserMessage("User 2"),
			createAssistantMessage("Assistant 2"),
		]);

		const {metadata} = await collectTextWithMeta(messages);

		expect(metadata.messageCount).toBe(6);
		expect(metadata.typeCounts).toEqual({
			user: 2,
			assistant: 2,
			tool_use: 2,
		});
	});

	test("handles empty stream", async () => {
		const messages = createMockGenerator([]);

		const {text, metadata} = await collectTextWithMeta(messages);

		expect(text).toBe("");
		expect(metadata.messageCount).toBe(0);
		expect(metadata.typeCounts).toEqual({});
	});

	test("returns empty text when no assistant messages", async () => {
		const messages = createMockGenerator([
			createUserMessage("User"),
			createToolUseMessage("Bash", {command: "ls"}),
		]);

		const {text, metadata} = await collectTextWithMeta(messages);

		expect(text).toBe("");
		expect(metadata.messageCount).toBe(2);
		expect(metadata.typeCounts).toEqual({
			user: 1,
			tool_use: 1,
		});
	});

	test("handles single message stream", async () => {
		const messages = createMockGenerator([createAssistantMessage("Only message")]);

		const {text, metadata} = await collectTextWithMeta(messages);

		expect(text).toBe("Only message");
		expect(metadata.messageCount).toBe(1);
		expect(metadata.typeCounts).toEqual({
			assistant: 1,
		});
	});

	test("metadata includes all message types present", async () => {
		const messages = createMockGenerator([
			createAssistantMessage("Response"),
			{type: "custom_event", data: "custom"} as any,
			createAssistantMessage("More response"),
		]);

		const {metadata} = await collectTextWithMeta(messages);

		expect(metadata.typeCounts).toHaveProperty("assistant", 2);
		expect(metadata.typeCounts).toHaveProperty("custom_event", 1);
	});

	test("collects text correctly with metadata enabled", async () => {
		const messages = createMockGenerator([
			createAssistantMessage([{type: "text", text: "Part 1"}]),
			createAssistantMessage("Part 2"),
			createAssistantMessage([{type: "text", text: "Part 3"}]),
		]);

		const {text, metadata} = await collectTextWithMeta(messages);

		expect(text).toBe("Part 1Part 2Part 3");
		expect(metadata.messageCount).toBe(3);
		expect(metadata.typeCounts.assistant).toBe(3);
	});
});
