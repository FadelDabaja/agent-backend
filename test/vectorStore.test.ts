import { describe, expect, it } from "vitest";
import {
	createVectorStore,
	type Embedder,
} from "../src/knowledge/vectorStore.ts";

const embedder = fixedEmbedder({
	north: [1, 0],
	east: [0, 1],
	northeast: [1, 1],
	blank: [0, 0],
	"mostly north": [3, 1],
});

const store = await createVectorStore(embedder, ["east", "north", "northeast"]);

describe("createVectorStore", () => {
	it("ranks documents by cosine similarity", async () => {
		const hits = await store.search("mostly north", 3, 0);

		expect(hits.map((hit) => hit.text)).toEqual(["north", "northeast", "east"]);
		expect(hits[0].score).toBeCloseTo(3 / Math.sqrt(10));
		expect(hits[1].score).toBeCloseTo(4 / Math.sqrt(20));
		expect(hits[2].score).toBeCloseTo(1 / Math.sqrt(10));
	});

	it("returns at most topK hits", async () => {
		const hits = await store.search("mostly north", 2, 0);

		expect(hits.map((hit) => hit.text)).toEqual(["north", "northeast"]);
	});

	it("drops hits below minScore", async () => {
		const hits = await store.search("mostly north", 3, 0.5);

		expect(hits.map((hit) => hit.text)).toEqual(["north", "northeast"]);
	});

	it("scores a zero vector as 0", async () => {
		const blankStore = await createVectorStore(embedder, ["blank"]);

		const hits = await blankStore.search("mostly north", 1, 0);

		expect(hits).toEqual([{ text: "blank", score: 0 }]);
	});
});

function fixedEmbedder(vectors: Record<string, number[]>): Embedder {
	return { embed: async (texts) => texts.map((text) => vectors[text]) };
}
