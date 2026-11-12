# Working in this repository

The rules this code is written under. Follow them when you change it, and run `npm run check` before every commit.

## Need

- Every file, function, type, option and dependency serves a requirement. If you cannot name it, delete it.
- No speculative generality: no interface without a second implementation (a test fake counts), no options nobody sets, no extension points, no base classes, no "utils" or "helpers" modules.
- No dead code, unused exports, commented-out code, TODOs or duplicated logic.

## Reading

- Names come from the problem: question, answer, fact, tool, turn, outcome. No `Manager`, `Service`, `Helper`, `Impl`, `Util`, `Data` or `Info` suffixes, no abbreviations.
- Functions do one thing and fit on a screen. Early returns, no nested ternaries, no clever one-liners.
- Functions and plain objects over classes; the one error class is the exception. Named exports only.
- A file reads top-down: the exported function first, its helpers below.

## Comments and types

- Comment only the why the code cannot say. No banners, no JSDoc on self-explanatory functions.
- Strict TypeScript. No `any`, no non-null `!`, no `as` casts in `src/` (`as const` is fine). Annotate exported signatures.
- Model alternatives as unions of string literals.

## Errors and boundaries

- Handle only what can actually happen, at the one place that can act on it. No `catch` that logs and rethrows.
- Bad configuration fails at start-up with one readable message.
- Only `src/config.ts` reads `process.env`. Only `src/llm/anthropicLlm.ts` imports `@anthropic-ai/sdk`.

## Tests

- Write the test first. Test behaviour through the public interface; a test that would survive deleting the code goes.
- Small hand-written fakes in the test file that uses them. No mocking library, no snapshots, no network.

Settled choices and their reasons are in [DECISIONS.md](DECISIONS.md); deliberate gaps are in [SHORTCUTS.md](SHORTCUTS.md).
