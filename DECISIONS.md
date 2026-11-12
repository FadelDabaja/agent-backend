# Decisions

## Scope

Written before any code.

**In:** an agent loop in which the model decides which tool to call; two tools, a search over an in-memory vector store of facts defined in code and a function that returns fixed text; `GET /ask` and Swagger UI; configuration from the environment; tests; a smoke script that asks a running server a table of questions.

**Out:** a second LLM provider, a real embedding model, a persistent or external vector store, streaming, conversation memory, authentication and rate limiting, `POST`, an overall request deadline, a refusal fallback model, tracing and metrics, a container, CI, a UI and MCP. Each has a line in [SHORTCUTS.md](SHORTCUTS.md).

## Decisions

### TypeScript on Node.js

- Decision: TypeScript on Node.js for the server, the tests and the scripts.
- Why: of the three allowed stacks it is the one I work in most, and one language covers everything.
- Rejected: C# with ASP.NET Core and Kotlin with Spring Boot, the other allowed stacks.
- Revisit when: the team that maintains it works in one of those.

### Small standard tooling, no build step

- Decision: Vitest for tests, Biome for lint and format, strict TypeScript checked with `tsc --noEmit`, sources run with `tsx`.
- Why: few tools and little configuration. The code uses only erasable TypeScript syntax, so Node's own type stripping could run it too; `tsx` is a convenience.
- Rejected: Jest with ESLint and Prettier (three tools to configure); compiling to JavaScript before running.
- Revisit when: the service is deployed and needs a build artefact.

### A hand-written agent loop

- Decision: `runAgent` in `src/agent/agent.ts` calls the model, runs the tools it asks for, returns their results and stops when the model answers or a step limit is reached.
- Why: with two tools the loop is short, and every step of tool calling stays visible in code that is tested without a network.
- Rejected: the Anthropic SDK's tool runner, which Anthropic's documentation recommends but which is still in beta; agent frameworks, which earn their place with streaming, many tools, approvals or several providers.
- Revisit when: one of those needs appears.

With a single knowledge source, a fixed retrieve-then-answer pipeline would be simpler than an agent. The agent pattern pays for itself when the model has to choose between tools; it is built as an agent because that is the task.

### The loop talks to the model through a port it owns

- Decision: the loop depends on `LlmClient` and `Chat` in `src/agent/llm.ts`. The provider adapter implements them and owns the transcript.
- Why: the loop is tested with a fake. Claude's reply, thinking blocks included, must go back unchanged with the tool results; an adapter that only appends what the model sent cannot drop or rewrite it, while a loop that rebuilt a neutral message list could.
- Rejected: a stateless `complete(messages)` port, which would have to carry provider-specific blocks through neutral types.
- Revisit when: a second provider is added. Provider neutrality is designed here, not proven.

### Claude through the official SDK, one provider

- Decision: `src/llm/anthropicLlm.ts` calls Claude with the non-streaming `messages.create` of `@anthropic-ai/sdk`. It is the only file that imports the SDK, and no other provider is implemented.
- Why: a stable, typed API surface. The task asks for an LLM, not for portability; the port keeps a second provider possible without building one.
- Rejected: the SDK's beta tool runner (above) and frameworks that wrap several providers.
- Revisit when: answers get long enough to stream, or a second provider is required.

### Answers come only from the retrieved facts

- Decision: the system prompt (`src/agent/systemPrompt.ts`) makes the model search before any climate answer, answer only from what the search returns and otherwise say it does not know. This is my design decision, not a requirement of the task.
- Why: the example facts are common knowledge. Without the rule the model could answer from memory, and the search tool would prove nothing.
- Rejected: letting the model mix the facts with its own knowledge.
- Revisit when: the knowledge base should add to the model's knowledge rather than replace it.

### A stand-in embedder inside a real vector store

- Decision: `src/knowledge/hashingEmbedder.ts` turns text into counts of words in 500 hashed buckets. The store around it is real: unit-length vectors, cosine similarity, top-k and a minimum score (`src/knowledge/vectorStore.ts`).
- Why: a mocked vector database is allowed, and Anthropic has no embeddings endpoint, so real embeddings need a second vendor's key or a local model runtime with its own download.
- Rejected: a hosted embedding API and a local embedding model, for those costs.
- Revisit when: questions need synonyms, inflections or other languages. It matches words, not meaning, so it is a stand-in and not semantic search.

## Measured

### Similarity scores behind `MIN_SCORE`

Scores of the six facts for the test queries and the smoke questions as written, from a throwaway script over the real embedder and store. Function words such as "is" and "than" are dropped first, so every fact reads as "warmer" plus two countries.

| Query                                                      | Facts naming a country of the query             | Facts sharing only "warmer"     |
| ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| France Sweden warmer                                       | France and Sweden: 1.00                         | 0.33                            |
| Is France warmer than Sweden? (and the reverse)            | France and Sweden: 1.00                         | 0.33                            |
| Which is colder, Finland or Korea?                         | Korea and Finland: 0.67                         | none ("colder" is not "warmer") |
| Is Korea warmer than Sweden?                               | France and Sweden, Korea and Finland: 0.67 each | 0.33                            |
| Is France warmer than Sweden, and can I trust that?        | France and Sweden: 0.65                         | 0.22                            |
| Is Brazil warmer than Japan?                               | none                                            | 0.33                            |
| capital of Japan; Är det varmare i Frankrike än i Sverige? | none                                            | none                            |

`MIN_SCORE = 0.5` keeps every fact that names a country of the query and drops every fact that shares only the template word. The margin shrinks as queries get longer, which is why the tool asks the model for country names plus one keyword.

Bucket count: at 512 buckets "warmer" shares a bucket with "cold", "norway" with "hotter" and "egypt" with "of"; powers of two use only the low bits of the hash. At 500 buckets none of the 13 words in the facts shares a bucket with another or with 67 other words: every word of the smoke questions, other countries and words about temperature.
