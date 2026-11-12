import { z } from "zod";
import { defineTool, type Tool } from "../agent/tool.ts";
import type { VectorStore } from "../knowledge/vectorStore.ts";

const TOP_K = 3;
// Facts that name a country of the query scored 0.65 or more, facts that share
// only the word "warmer" 0.41 or less. The measurements are in DECISIONS.md.
const MIN_SCORE = 0.5;

export function createSearchClimateFactsTool(store: VectorStore): Tool {
	return defineTool({
		name: "search_climate_facts",
		description: `Searches the knowledge base of statements comparing how warm countries are. Call it before answering any question about climate or temperature. Returns up to ${TOP_K} matching statements with similarity scores, or says that nothing relevant was found. The statements are the only source of truth.`,
		input: z.object({
			query: z
				.string()
				.min(1)
				.max(200)
				.describe(
					"The country names in English plus a keyword, for example: France Sweden warmer",
				),
		}),
		async execute({ query }) {
			const hits = await store.search(query, TOP_K, MIN_SCORE);
			if (hits.length === 0) {
				return "No relevant facts found.";
			}
			return hits
				.map((hit) => `${hit.text} (score ${hit.score.toFixed(2)})`)
				.join("\n");
		},
	});
}
