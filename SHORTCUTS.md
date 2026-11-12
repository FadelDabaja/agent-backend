# Shortcuts

Each entry names a deliberate gap: where it is, what was done instead, why that is acceptable here, and what a real system needs.

## Shortcuts taken

1. **Embeddings are a word-matching stand-in.** `src/knowledge/hashingEmbedder.ts` counts words in hashed buckets, so it knows no synonyms, inflections or other languages. Because all facts share one sentence template, declining for unknown countries finally relies on the threshold and on the model. Acceptable because a mocked vector database is allowed, and Anthropic has no embeddings endpoint, so a real model means a second vendor's key or a local model runtime. A real system needs an embedding model behind the existing `Embedder` interface.
2. **The vector store is an in-memory linear scan.** `src/knowledge/vectorStore.ts` embeds the facts at every start and scores every fact on every search. Acceptable for six facts defined in code. A real system needs a persistent vector store with an index.
3. **The threshold is hand-tuned, and ten questions are the only evaluation.** `MIN_SCORE` in `src/tools/searchClimateFacts.ts` was chosen from the scores of about ten test and smoke queries against six facts and confirmed against the queries the models sent (see Measured in [DECISIONS.md](DECISIONS.md)). `scripts/smoke.ts` is the only evaluation of retrieval, tool routing and grounding: ten questions, one run per model, tools asserted and answers read by a person. Acceptable for a seed. A real system needs an evaluation set with graded answers, run on every change to a prompt, a tool description or the model.
4. **A `GET` triggers a paid call, and nothing guards it.** `GET /ask` in `src/http/app.ts` starts a model call that costs money and is not repeatable, and the question ends up in URLs, browser history and the request log. There is no authentication, rate limiting or spend limit. Acceptable because the task names a browsable GET as one of its two options, and the server listens on localhost only. A real deployment needs `POST`, authentication, rate limits and a spend cap.
5. **Single-turn, no streaming.** `runAgent` starts a new chat for every request, and the answer arrives when it is complete. Acceptable because each question here stands on its own. A real assistant needs conversation memory and a streamed answer.
6. **One LLM provider.** The port in `src/agent/llm.ts` is written for more than one provider, but only `src/llm/anthropicLlm.ts` implements it, so that design is unproven. Acceptable because the task asks for a language model, not for a choice of them. A real system that needs a second provider adds an adapter and learns what the port missed.
7. **Provider failures, refusals and truncated replies are reported, not handled.** Every API, connection and timeout error from the SDK (`Anthropic.APIError`) becomes one `LlmError` in `src/llm/anthropicLlm.ts`, after at most one retry by the SDK and a 30-second timeout per attempt, and `src/http/app.ts` answers every `LlmError` with the same 502. There is no overall deadline or cancellation. `runAgent` returns refusals and truncated replies as the outcomes `refused` and `truncated`, without retrying, and there is no fallback model, because Anthropic's server-side fallback is a beta feature. Acceptable because the caller sees exactly what happened. A real system needs a retry and fallback policy, a request deadline and cancellation.
8. **Retrieved text is trusted.** The search tool hands the facts to the model as they are; the system prompt only says that tool results are data, not instructions. Acceptable because the facts are defined in code. With real documents, retrieved text is untrusted input that can carry prompt injection, and needs to be treated as such.
9. **Observability is the request log and the trace in the response.** Every response carries `toolCalls`, `steps` and `usage`, which is a demo aid and not an API contract; Fastify logs each request, and `src/http/app.ts` logs the cause of every 502. There is no tracing, no metrics and no cost reporting. Acceptable because the trace is what shows that both tools work. A real system needs all three, and a response that does not expose tool inputs and outputs.
10. **No build step, container, CI pipeline, infrastructure code or user interface beyond Swagger UI.** Nothing here was asked for. A real service needs a pipeline that runs the checks and deploys an artefact.

## With more time

In priority order:

1. **An evaluation set for routing and grounding**, because every change to a prompt, a tool description or the model needs graded answers, not ten questions read by eye.
2. **A real embedding model and a persistent vector store** behind the existing `Embedder` and `VectorStore` types, so that questions match by meaning and the facts outlive a restart.
3. **`POST` with authentication and rate limits**, because every call spends money.
4. **Streaming**, because answers took up to ten seconds in the smoke runs and the caller sees nothing until the end.
5. **Tracing** of every model call and tool call with its tokens and cost, to see where time and money go.
6. **A pipeline and a deployment**: CI that runs `npm run check`, a container and infrastructure as code.
7. **The tools over MCP**, so that other agents can use them.

## What I would refactor first

1. **The response schema in `src/http/app.ts` restates `AgentResult` by hand.** The type checker catches a removed or renamed field, but a new field would be dropped by the serializer without a word. One schema should produce both.
2. **A `Chat` cannot be reused after a failed model call.** The adapter appends the user message before the call, so retrying on the same chat would send it twice. The loop never retries, but nothing enforces that.
3. **The tool calls of a turn run one after another.** That is the simplest correct order while both tools are in memory; once a tool does I/O, they should run concurrently and keep their order.
