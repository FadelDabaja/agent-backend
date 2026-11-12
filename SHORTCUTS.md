# Shortcuts

This is a work-in-progress case. Each entry names a deliberate gap: where it is, what was done instead, why that is acceptable here, and what a real system needs.

## Shortcuts taken

1. **Embeddings are a stand-in.** Tool 1 searches with a deterministic word-hashing embedder instead of an embedding model. Acceptable because a mocked vector database is allowed, the facts are a handful of sentences, and Anthropic has no embeddings endpoint, so a real model means a second vendor key or a local model runtime of several hundred megabytes. A real system needs an embedding model behind the same interface.
2. **The vector store lives in memory.** It is rebuilt at every start. Acceptable for facts defined in code. A real system needs a persistent vector store.
3. **Single-turn, no streaming.** Each request is one question, and the answer arrives when it is complete. A real assistant needs conversation memory and a streamed answer.
4. **No authentication, rate limiting or spend limit.** Anyone who can reach the server can spend the API key's budget. Acceptable for a server that listens on localhost. A real deployment needs all three.
5. **One LLM provider.** Claude is the only model behind the agent. A real system that needs a second provider adds an adapter.
6. **No build step, container, CI pipeline or infrastructure code.** Nothing here was asked for. A real service needs a pipeline that runs the checks and deploys an artefact.
