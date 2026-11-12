// A stand-in for an embedding model. It counts words into hashed buckets, so it
// matches words, not meaning: no synonyms, no inflections, no other languages.
import type { Embedder } from "./vectorStore.ts";

// Not a power of two: those keep only the low bits of the hash, where "warmer"
// and "cold" collide. See the measurements in DECISIONS.md.
const BUCKETS = 500;

const FUNCTION_WORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"do",
	"in",
	"is",
	"it",
	"of",
	"or",
	"s",
	"than",
	"the",
	"what",
	"which",
]);

export const hashingEmbedder: Embedder = {
	async embed(texts) {
		return texts.map(embedText);
	},
};

function embedText(text: string): number[] {
	const vector = new Array<number>(BUCKETS).fill(0);
	for (const word of contentWords(text)) {
		vector[fnv1a(word) % BUCKETS] += 1;
	}
	return vector;
}

function contentWords(text: string): string[] {
	const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
	return words.filter((word) => !FUNCTION_WORDS.has(word));
}

// FNV-1a, 32-bit: a small, deterministic string hash.
function fnv1a(word: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < word.length; index++) {
		hash = Math.imul(hash ^ word.charCodeAt(index), 0x01000193);
	}
	return hash >>> 0;
}
