import { describe, expect, it } from "vitest";
import { FACTS } from "../src/knowledge/facts.ts";
import { hashingEmbedder } from "../src/knowledge/hashingEmbedder.ts";
import { createVectorStore } from "../src/knowledge/vectorStore.ts";
import { createSearchClimateFactsTool } from "../src/tools/searchClimateFacts.ts";

const tool = createSearchClimateFactsTool(
	await createVectorStore(hashingEmbedder, FACTS),
);

describe("search_climate_facts", () => {
	it('returns the France and Sweden fact first for "France Sweden warmer"', async () => {
		const output = await tool.run({ query: "France Sweden warmer" });

		expect(output.split("\n")[0]).toContain(
			"It's warmer in France than Sweden.",
		);
	});

	it('still returns the Korea and Finland fact for "Which is colder, Finland or Korea?"', async () => {
		const output = await tool.run({
			query: "Which is colder, Finland or Korea?",
		});

		expect(output).toContain("It's warmer in Korea than Finland.");
	});

	it('returns no facts for "Is Brazil warmer than Japan?"', async () => {
		const output = await tool.run({ query: "Is Brazil warmer than Japan?" });

		expect(output).toBe("No relevant facts found.");
	});

	it('returns no facts for "capital of Japan"', async () => {
		const output = await tool.run({ query: "capital of Japan" });

		expect(output).toBe("No relevant facts found.");
	});

	it("rejects input without a query", async () => {
		await expect(tool.run({})).rejects.toThrow(/query/);
	});
});
