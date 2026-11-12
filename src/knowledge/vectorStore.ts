export interface Embedder {
	embed(texts: readonly string[]): Promise<number[][]>;
}

export interface SearchHit {
	text: string;
	score: number;
}

export interface VectorStore {
	search(query: string, topK: number, minScore: number): Promise<SearchHit[]>;
}

export async function createVectorStore(
	embedder: Embedder,
	documents: readonly string[],
): Promise<VectorStore> {
	const vectors = (await embedder.embed(documents)).map(normalize);
	return {
		async search(query, topK, minScore) {
			const [queryVector] = await embedder.embed([query]);
			const normalizedQuery = normalize(queryVector);
			return documents
				.map((text, index) => ({
					text,
					score: dotProduct(normalizedQuery, vectors[index]),
				}))
				.filter((hit) => hit.score >= minScore)
				.sort((first, second) => second.score - first.score)
				.slice(0, topK);
		},
	};
}

// On unit vectors, cosine similarity is a plain dot product. A zero vector stays
// zero and scores 0 against everything.
function normalize(vector: number[]): number[] {
	const length = Math.hypot(...vector);
	return length === 0 ? vector : vector.map((value) => value / length);
}

function dotProduct(left: number[], right: number[]): number {
	return left.reduce((sum, value, index) => sum + value * right[index], 0);
}
