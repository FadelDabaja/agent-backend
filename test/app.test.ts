import { describe, expect, it } from "vitest";
import type { AgentResult } from "../src/agent/agent.ts";
import { LlmError } from "../src/agent/llm.ts";
import { buildApp } from "../src/http/app.ts";

const result: AgentResult = {
	outcome: "answered",
	answer: "Yes, France is warmer than Sweden.",
	toolCalls: [
		{
			name: "search_climate_facts",
			input: { query: "France Sweden warmer" },
			output: "It's warmer in France than Sweden. (score 1.00)",
			isError: false,
		},
	],
	steps: 2,
	usage: { inputTokens: 1200, outputTokens: 80 },
};

describe("GET /ask", () => {
	it("returns 200 with the agent result and the model for a valid question", async () => {
		const questions: string[] = [];
		const app = await buildApp({
			ask: async (question) => {
				questions.push(question);
				return result;
			},
			model: "claude-test",
			logger: false,
		});

		const response = await app.inject({
			url: "/ask",
			query: { question: "  Is France warmer than Sweden?  " },
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(response.json()).toEqual({ ...result, model: "claude-test" });
		expect(questions).toEqual(["Is France warmer than Sweden?"]);
	});

	it("returns 400 for a missing, empty or over-long question", async () => {
		const app = await buildApp({
			ask: async () => result,
			model: "claude-test",
			logger: false,
		});

		const queries: Record<string, string>[] = [
			{},
			{ question: "   " },
			{ question: "x".repeat(501) },
		];
		for (const query of queries) {
			const response = await app.inject({ url: "/ask", query });

			expect(response.statusCode).toBe(400);
			expect(response.json()).toEqual({ error: expect.any(String) });
		}
	});

	it("returns 502 without provider details when the language model call fails", async () => {
		const app = await buildApp({
			ask: async () => {
				throw new LlmError("The Anthropic API request failed", {
					cause: new Error("401 invalid x-api-key"),
				});
			},
			model: "claude-test",
			logger: false,
		});

		const response = await app.inject({
			url: "/ask",
			query: { question: "Hi" },
		});

		expect(response.statusCode).toBe(502);
		expect(response.json()).toEqual({
			error: "The language model request failed.",
		});
	});

	it("serves an OpenAPI document that lists GET /ask", async () => {
		const app = await buildApp({
			ask: async () => result,
			model: "claude-test",
			logger: false,
		});

		const response = await app.inject({ url: "/docs/json" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			paths: { "/ask": { get: expect.any(Object) } },
		});
	});
});
