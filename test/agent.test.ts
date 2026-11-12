import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgent } from "../src/agent/agent.ts";
import type {
	LlmClient,
	LlmTurn,
	ToolCall,
	ToolResult,
	ToolSpec,
} from "../src/agent/llm.ts";
import { SYSTEM_PROMPT } from "../src/agent/systemPrompt.ts";
import { defineTool } from "../src/agent/tool.ts";
import { getDataDisclaimerTool } from "../src/tools/getDataDisclaimer.ts";

const usage = { inputTokens: 10, outputTokens: 5 };

const echo = defineTool({
	name: "echo",
	description: "Repeats the text.",
	input: z.object({ text: z.string() }),
	execute: ({ text }) => text,
});

const failing = defineTool({
	name: "failing",
	description: "Always fails.",
	input: z.object({}),
	execute: () => {
		throw new Error("Index unavailable");
	},
});

describe("runAgent", () => {
	it("answers directly when the model asks for no tool", async () => {
		const { llm } = scriptedLlm([answer("Hello.")]);

		const result = await runAgent("Hi", { llm, tools: [echo], maxSteps: 5 });

		expect(result).toEqual({
			outcome: "answered",
			answer: "Hello.",
			toolCalls: [],
			steps: 1,
			usage,
		});
	});

	it("runs the requested tool, returns its result to the model, then answers", async () => {
		const { llm, sent, started } = scriptedLlm([
			askForTools({ id: "call-1", name: "get_data_disclaimer", input: {} }),
			answer("The facts are sample data."),
		]);

		const result = await runAgent("Can I trust the data?", {
			llm,
			tools: [getDataDisclaimerTool],
			maxSteps: 5,
		});

		const disclaimer =
			"These climate facts are illustrative sample data defined in code, not measurements. Reference: KB-2026-01.";
		expect(started).toEqual([
			{ systemPrompt: SYSTEM_PROMPT, tools: [getDataDisclaimerTool] },
		]);
		expect(sent[1]).toEqual([
			{ toolCallId: "call-1", content: disclaimer, isError: false },
		]);
		expect(result).toMatchObject({
			outcome: "answered",
			answer: "The facts are sample data.",
			toolCalls: [
				{
					name: "get_data_disclaimer",
					input: {},
					output: disclaimer,
					isError: false,
				},
			],
			steps: 2,
		});
	});

	it("sends the results of several tool calls from one turn together", async () => {
		const { llm, sent } = scriptedLlm([
			askForTools(
				{ id: "call-1", name: "echo", input: { text: "one" } },
				{ id: "call-2", name: "echo", input: { text: "two" } },
			),
			answer("Done."),
		]);

		await runAgent("Echo twice", { llm, tools: [echo], maxSteps: 5 });

		expect(sent).toEqual([
			"Echo twice",
			[
				{ toolCallId: "call-1", content: "one", isError: false },
				{ toolCallId: "call-2", content: "two", isError: false },
			],
		]);
	});

	it("reports an unknown tool to the model as an error result and carries on", async () => {
		const { llm, sent } = scriptedLlm([
			askForTools({ id: "call-1", name: "teleport", input: {} }),
			answer("I cannot do that."),
		]);

		const result = await runAgent("Teleport me", {
			llm,
			tools: [echo],
			maxSteps: 5,
		});

		expect(sent[1]).toEqual([
			{
				toolCallId: "call-1",
				content: "Unknown tool: teleport",
				isError: true,
			},
		]);
		expect(result.outcome).toBe("answered");
	});

	it("reports invalid tool input to the model as an error result", async () => {
		const { llm, sent } = scriptedLlm([
			askForTools({ id: "call-1", name: "echo", input: { words: "ping" } }),
			answer("Sorry."),
		]);

		await runAgent("Echo", { llm, tools: [echo], maxSteps: 5 });

		expect(sent[1]).toEqual([
			{
				toolCallId: "call-1",
				content: expect.stringContaining("text"),
				isError: true,
			},
		]);
	});

	it("reports a failing tool to the model as an error result", async () => {
		const { llm, sent } = scriptedLlm([
			askForTools({ id: "call-1", name: "failing", input: {} }),
			answer("Sorry."),
		]);

		await runAgent("Try it", { llm, tools: [failing], maxSteps: 5 });

		expect(sent[1]).toEqual([
			{
				toolCallId: "call-1",
				content: expect.stringContaining("Index unavailable"),
				isError: true,
			},
		]);
	});

	it("stops with step_limit when the model keeps asking for tools", async () => {
		const call = { id: "call-1", name: "echo", input: { text: "again" } };
		const { llm } = scriptedLlm([
			askForTools(call),
			askForTools(call),
			askForTools(call),
		]);

		const result = await runAgent("Loop", { llm, tools: [echo], maxSteps: 3 });

		expect(result).toMatchObject({
			outcome: "step_limit",
			answer: null,
			steps: 3,
		});
		expect(result.toolCalls).toHaveLength(2);
	});

	it("reports a refusal and a truncated reply as outcomes without an answer, and runs no tool from a truncated turn", async () => {
		const refusing = scriptedLlm([
			{ text: "", toolCalls: [], stopReason: "refusal", usage },
		]);
		const truncating = scriptedLlm([
			{
				text: "Let me check",
				toolCalls: [{ id: "call-1", name: "echo", input: { text: "cut" } }],
				stopReason: "max_tokens",
				usage,
			},
		]);

		const refused = await runAgent("Hi", {
			llm: refusing.llm,
			tools: [echo],
			maxSteps: 5,
		});
		const truncated = await runAgent("Hi", {
			llm: truncating.llm,
			tools: [echo],
			maxSteps: 5,
		});

		expect(refused).toMatchObject({ outcome: "refused", answer: null });
		expect(truncated).toMatchObject({
			outcome: "truncated",
			answer: null,
			toolCalls: [],
		});
	});

	it("sums token usage over the model calls", async () => {
		const { llm } = scriptedLlm([
			{
				...askForTools({ id: "call-1", name: "echo", input: { text: "ping" } }),
				usage: { inputTokens: 100, outputTokens: 20 },
			},
			{ ...answer("Done."), usage: { inputTokens: 150, outputTokens: 30 } },
		]);

		const result = await runAgent("Echo ping", {
			llm,
			tools: [echo],
			maxSteps: 5,
		});

		expect(result.usage).toEqual({ inputTokens: 250, outputTokens: 50 });
	});
});

function answer(text: string): LlmTurn {
	return { text, toolCalls: [], stopReason: "end_turn", usage };
}

function askForTools(...toolCalls: ToolCall[]): LlmTurn {
	return { text: "", toolCalls, stopReason: "tool_use", usage };
}

function scriptedLlm(turns: LlmTurn[]) {
	const started: { systemPrompt: string; tools: ToolSpec[] }[] = [];
	const sent: (string | ToolResult[])[] = [];
	const nextTurn = async () => {
		const turn = turns.shift();
		if (!turn) {
			throw new Error("The model was called more often than scripted");
		}
		return turn;
	};
	const llm: LlmClient = {
		startChat: (systemPrompt, tools) => {
			started.push({ systemPrompt, tools });
			return {
				sendUserMessage: (text) => {
					sent.push(text);
					return nextTurn();
				},
				sendToolResults: (results) => {
					sent.push(results);
					return nextTurn();
				},
			};
		},
	};
	return { llm, sent, started };
}
