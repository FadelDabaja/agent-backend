# Agent backend

A small TypeScript backend that exposes an LLM agent over a REST API. Claude decides when to call its two tools, a search over an in-memory vector store of climate facts and a function that returns a fixed disclaimer, and answers questions about climate only from the facts the search returns.

## Run it

Prerequisites: Node.js 22.12 or later (developed on 22.16) and an Anthropic API key.

```sh
npm ci
cp .env.example .env    # then set ANTHROPIC_API_KEY in .env
npm start
```

Open <http://localhost:3000/docs> for Swagger UI. `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `PORT` (default `3000`) are optional.

## Try it

Responses below were captured from `claude-opus-5-5`; only the indentation was added.

Tool 1, the fact search: <http://localhost:3000/ask?question=Is%20France%20warmer%20than%20Sweden%3F>

```json
{
	"outcome": "answered",
	"answer": "Yes, France is warmer than Sweden.",
	"toolCalls": [
		{
			"name": "search_climate_facts",
			"input": { "query": "France Sweden warmer" },
			"output": "It's warmer in France than Sweden. (score 1.00)",
			"isError": false
		}
	],
	"steps": 2,
	"usage": { "inputTokens": 1749, "outputTokens": 75 },
	"model": "claude-opus-5-5"
}
```

Tool 2, the disclaimer: <http://localhost:3000/ask?question=Where%20do%20these%20facts%20come%20from%3F>

```json
{
	"outcome": "answered",
	"answer": "The approved statement says: \"These climate facts are illustrative sample data defined in code, not measurements. Reference: KB-2026-01.\"",
	"toolCalls": [
		{
			"name": "get_data_disclaimer",
			"input": {},
			"output": "These climate facts are illustrative sample data defined in code, not measurements. Reference: KB-2026-01.",
			"isError": false
		}
	],
	"steps": 2,
	"usage": { "inputTokens": 1732, "outputTokens": 77 },
	"model": "claude-opus-5-5"
}
```

Both tools: <http://localhost:3000/ask?question=Is%20France%20warmer%20than%20Sweden%2C%20and%20can%20I%20trust%20that%3F>

```json
{
	"outcome": "answered",
	"answer": "Our data says France is warmer than Sweden, but here's the official note on how much to trust it: \"These climate facts are illustrative sample data defined in code, not measurements. Reference: KB-2026-01.\"",
	"toolCalls": [
		{
			"name": "search_climate_facts",
			"input": { "query": "France Sweden warmer" },
			"output": "It's warmer in France than Sweden. (score 1.00)",
			"isError": false
		},
		{
			"name": "get_data_disclaimer",
			"input": {},
			"output": "These climate facts are illustrative sample data defined in code, not measurements. Reference: KB-2026-01.",
			"isError": false
		}
	],
	"steps": 2,
	"usage": { "inputTokens": 1888, "outputTokens": 178 },
	"model": "claude-opus-5-5"
}
```

Two questions the agent declines, from the smoke run:

- Facts that do not link the countries, "Is Korea warmer than Sweden?": "I don't know, because my facts don't compare Korea and Sweden. They only say Korea is warmer than Finland and France is warmer than Sweden, and nothing connects those two comparisons."
- General knowledge the facts do not hold, "Is Brazil warmer than Japan?": "I don't know. My knowledge base has nothing comparing Brazil and Japan, or either country with anywhere else, so I can't say which one is warmer."

## How it works

One request, as it goes over the wire:

1. `GET /ask?question=...` arrives; zod checks that the trimmed question has 1 to 500 characters.
2. `runAgent` starts a chat and sends the question to the Anthropic Messages API with the system prompt and the two tool definitions, whose JSON Schemas come from the tools' zod schemas.
3. Claude replies with `stop_reason: "tool_use"` and a block such as `search_climate_facts {"query": "France Sweden warmer"}`.
4. The loop validates that input with the same zod schema and runs the tool: the store embeds the query, scores the six facts by cosine similarity and keeps up to three that score 0.5 or more.
5. The adapter appends Claude's reply unchanged, thinking blocks included, and sends every tool result of the turn in one user message.
6. Claude replies with `stop_reason: "end_turn"`; the loop maps it to `outcome: "answered"`. At most five model calls are made per question.
7. The response carries the answer and a trace: every tool call with its input and output, the number of model calls and the summed token usage.

## Where each requirement is met

| Requirement                                               | Where                                               |
| --------------------------------------------------------- | --------------------------------------------------- |
| A small backend driven by an LLM agent                    | `src/agent/agent.ts`                                |
| The agent has two tools                                   | `src/server.ts` gives it exactly the two below      |
| Tool 1: a vector store, kept simple, over strings in code | `src/tools/searchClimateFacts.ts`, `src/knowledge/` |
| Tool 2: returns fixed text                                | `src/tools/getDataDisclaimer.ts`                    |
| The agent reachable over REST, through Swagger or a GET   | `src/http/app.ts`                                   |
| A real language model, local or hosted                    | `src/llm/anthropicLlm.ts` (Claude)                  |
| One of the allowed languages                              | TypeScript throughout                               |
| Shortcuts written down in Markdown                        | [SHORTCUTS.md](SHORTCUTS.md)                        |

## Project layout

```text
src/
  server.ts                    composition root: config, store, tools, model, HTTP server
  config.ts                    reads and validates the environment
  agent/
    agent.ts                   runAgent: the loop, the outcome and the tool-call trace
    llm.ts                     the port the loop talks to the model through
    systemPrompt.ts            the system prompt
    tool.ts                    Tool and defineTool
  llm/
    anthropicLlm.ts            the port implemented with @anthropic-ai/sdk
  knowledge/
    facts.ts                   the six facts
    hashingEmbedder.ts         the stand-in embedder
    vectorStore.ts             the in-memory vector store
  tools/
    searchClimateFacts.ts      Tool 1
    getDataDisclaimer.ts       Tool 2
  http/
    app.ts                     GET /ask, Swagger UI and the error mapping
scripts/
  smoke.ts                     asks a running server ten questions
test/                          Vitest: the loop, the adapter, the store, Tool 1 and the HTTP layer
```

Two boundary rules: only `src/config.ts` reads `process.env`, and within `src/` only `src/llm/anthropicLlm.ts` imports `@anthropic-ai/sdk`.

## Checks

```sh
npm run check                            # Biome, tsc --noEmit and Vitest; no API key needed
npm run smoke                            # ten questions against http://localhost:3000
npm run smoke -- http://localhost:3001   # or against another base URL
```

[DECISIONS.md](DECISIONS.md) records the scope, the decisions with their alternatives, the measurements and the problems met. [SHORTCUTS.md](SHORTCUTS.md) lists the deliberate gaps, what I would do with more time and what I would refactor first. [AGENTS.md](AGENTS.md) holds the coding rules.
