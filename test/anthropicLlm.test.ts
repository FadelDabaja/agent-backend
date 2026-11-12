import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { LlmError, type ToolSpec } from "../src/agent/llm.ts";
import { createAnthropicLlm } from "../src/llm/anthropicLlm.ts";

const lookup: ToolSpec = {
	name: "lookup",
	description: "Looks something up.",
	inputSchema: {
		type: "object",
		properties: { query: { type: "string" } },
		required: ["query"],
	},
};

const thinking: Anthropic.ThinkingBlock = {
	type: "thinking",
	thinking: "",
	signature: "signature-1",
};

describe("createAnthropicLlm", () => {
	it("sends the system prompt, the tool definitions and the user message", async () => {
		const { createMessage, requests } = scriptedCreateMessage(
			reply([text("Hello.")], "end_turn"),
		);
		const chat = createAnthropicLlm(createMessage, "claude-test").startChat(
			"Be brief.",
			[lookup],
		);

		await chat.sendUserMessage("Hi");

		expect(requests).toEqual([
			{
				model: "claude-test",
				max_tokens: 16_000,
				system: "Be brief.",
				tools: [
					{
						name: "lookup",
						description: "Looks something up.",
						input_schema: lookup.inputSchema,
					},
				],
				messages: [{ role: "user", content: "Hi" }],
				output_config: { effort: "medium" },
			},
		]);
	});

	it("maps text and two tool_use blocks in one reply to an LlmTurn, ignoring a thinking block that precedes them", async () => {
		const { createMessage } = scriptedCreateMessage(
			reply(
				[
					thinking,
					text("Let me look."),
					toolUse("call-1", { query: "a" }),
					toolUse("call-2", { query: "b" }),
				],
				"tool_use",
			),
		);
		const chat = createAnthropicLlm(createMessage, "claude-test").startChat(
			"",
			[lookup],
		);

		const turn = await chat.sendUserMessage("Look up a and b");

		expect(turn).toEqual({
			text: "Let me look.",
			toolCalls: [
				{ id: "call-1", name: "lookup", input: { query: "a" } },
				{ id: "call-2", name: "lookup", input: { query: "b" } },
			],
			stopReason: "tool_use",
			usage: { inputTokens: 10, outputTokens: 5 },
		});
	});

	it("replays the assistant content unchanged, including a thinking block with empty text, and puts all tool results in one user message", async () => {
		const firstReply = reply(
			[
				thinking,
				toolUse("call-1", { query: "a" }),
				toolUse("call-2", { query: "b" }),
			],
			"tool_use",
		);
		const { createMessage, requests } = scriptedCreateMessage(
			firstReply,
			reply([text("Done.")], "end_turn"),
		);
		const chat = createAnthropicLlm(createMessage, "claude-test").startChat(
			"",
			[lookup],
		);

		await chat.sendUserMessage("Look up a and b");
		await chat.sendToolResults([
			{ toolCallId: "call-1", content: "Found a.", isError: false },
			{ toolCallId: "call-2", content: "Nothing for b.", isError: true },
		]);

		expect(requests[1].messages).toEqual([
			{ role: "user", content: "Look up a and b" },
			{ role: "assistant", content: firstReply.content },
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "call-1",
						content: "Found a.",
						is_error: false,
					},
					{
						type: "tool_result",
						tool_use_id: "call-2",
						content: "Nothing for b.",
						is_error: true,
					},
				],
			},
		]);
	});

	it("maps each of the four stop reasons and reports token usage", async () => {
		for (const stopReason of [
			"end_turn",
			"tool_use",
			"max_tokens",
			"refusal",
		] as const) {
			const { createMessage } = scriptedCreateMessage(reply([], stopReason));
			const chat = createAnthropicLlm(createMessage, "claude-test").startChat(
				"",
				[],
			);

			const turn = await chat.sendUserMessage("Hi");

			expect(turn).toMatchObject({
				stopReason,
				usage: { inputTokens: 10, outputTokens: 5 },
			});
		}
	});

	it("wraps an SDK error in LlmError", async () => {
		const sdkError = new Anthropic.APIConnectionError({
			message: "Connection error.",
		});
		const failingCreateMessage = async () => {
			throw sdkError;
		};
		const chat = createAnthropicLlm(
			failingCreateMessage,
			"claude-test",
		).startChat("", []);

		const error = await chat
			.sendUserMessage("Hi")
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(LlmError);
		expect(error).toHaveProperty("cause", sdkError);
	});

	it("throws LlmError on an unexpected stop reason", async () => {
		const { createMessage } = scriptedCreateMessage(reply([], "pause_turn"));
		const chat = createAnthropicLlm(createMessage, "claude-test").startChat(
			"",
			[],
		);

		await expect(chat.sendUserMessage("Hi")).rejects.toThrow(LlmError);
	});
});

function text(value: string): Anthropic.TextBlock {
	return { type: "text", text: value, citations: null };
}

function toolUse(id: string, input: unknown): Anthropic.ToolUseBlock {
	return {
		type: "tool_use",
		id,
		name: "lookup",
		input,
		caller: { type: "direct" },
	};
}

function reply(
	content: Anthropic.ContentBlock[],
	stopReason: Anthropic.StopReason,
): Anthropic.Message {
	// The one cast in the tests: a real Message has many fields (id, model,
	// cache usage, ...) that the adapter never reads.
	return {
		content,
		stop_reason: stopReason,
		usage: { input_tokens: 10, output_tokens: 5 },
	} as Anthropic.Message;
}

function scriptedCreateMessage(...replies: Anthropic.Message[]) {
	const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
	const createMessage = async (
		params: Anthropic.MessageCreateParamsNonStreaming,
	) => {
		// The adapter keeps appending to the same messages array, so record a snapshot.
		requests.push(structuredClone(params));
		const next = replies.shift();
		if (!next) {
			throw new Error("More requests than scripted replies");
		}
		return next;
	};
	return { createMessage, requests };
}
