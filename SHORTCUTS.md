# Shortcuts

This is a work-in-progress case. Each entry names a deliberate gap: where it is, what was done instead, why that is acceptable here, and what a real system needs.

## Shortcuts taken

1. **Embeddings are a word-matching stand-in.** `src/knowledge/hashingEmbedder.ts` counts words in hashed buckets, so it knows no synonyms, inflections or other languages. Because all facts share one sentence template, declining for unknown countries finally relies on the threshold and on the model. Acceptable because a mocked vector database is allowed, and Anthropic has no embeddings endpoint, so a real model means a second vendor's key or a local model runtime. A real system needs an embedding model behind the existing `Embedder` interface.
2. **The vector store is an in-memory linear scan.** `src/knowledge/vectorStore.ts` embeds the facts at every start and scores every fact on every search. Acceptable for six facts defined in code. A real system needs a persistent vector store with an index.
3. **The threshold is hand-tuned on six facts.** `MIN_SCORE` in `src/tools/searchClimateFacts.ts` was set from the scores of a dozen queries (see Measured in [DECISIONS.md](DECISIONS.md)). A real system needs an evaluation set for retrieval and a threshold tuned on it.
4. **No authentication, rate limiting or spend limit.** Anyone who can reach the server can spend the API key's budget. Acceptable for a server that listens on localhost. A real deployment needs all three.
5. **Single-turn, no streaming.** Each request is one question, and the answer arrives when it is complete. A real assistant needs conversation memory and a streamed answer.
6. **One LLM provider.** Claude is the only model behind the agent. A real system that needs a second provider adds an adapter.
7. **Provider failures, refusals and truncated replies are reported, not handled.** Every SDK error becomes one `LlmError` in `src/llm/anthropicLlm.ts`, after the SDK's single retry with a 30-second timeout per attempt; there is no overall deadline or cancellation. `runAgent` returns refusals and truncated replies as the outcomes `refused` and `truncated`, without retrying, and there is no fallback model, because Anthropic's server-side fallback is a beta feature. Acceptable because the caller sees exactly what happened. A real system needs a retry and fallback policy, a request deadline and cancellation.
8. **Retrieved text is trusted.** The search tool hands the facts to the model as they are; the system prompt only says that tool results are data, not instructions. Acceptable because the facts are defined in code. With real documents, retrieved text is untrusted input that can carry prompt injection, and needs to be treated as such.
9. **No build step, container, CI pipeline or infrastructure code.** Nothing here was asked for. A real service needs a pipeline that runs the checks and deploys an artefact.
