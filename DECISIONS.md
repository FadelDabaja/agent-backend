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
