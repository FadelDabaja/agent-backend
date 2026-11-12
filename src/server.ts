import { runAgent } from "./agent/agent.ts";
import { loadConfig } from "./config.ts";
import { buildApp } from "./http/app.ts";
import { FACTS } from "./knowledge/facts.ts";
import { hashingEmbedder } from "./knowledge/hashingEmbedder.ts";
import { createVectorStore } from "./knowledge/vectorStore.ts";
import {
	createAnthropicClient,
	createAnthropicLlm,
} from "./llm/anthropicLlm.ts";
import { getDataDisclaimerTool } from "./tools/getDataDisclaimer.ts";
import { createSearchClimateFactsTool } from "./tools/searchClimateFacts.ts";

const config = loadConfig();
const store = await createVectorStore(hashingEmbedder, FACTS);
const tools = [createSearchClimateFactsTool(store), getDataDisclaimerTool];
const llm = createAnthropicLlm(
	createAnthropicClient(config.ANTHROPIC_API_KEY),
	config.ANTHROPIC_MODEL,
);

const app = await buildApp({
	ask: (question) => runAgent(question, { llm, tools, maxSteps: 5 }),
	model: config.ANTHROPIC_MODEL,
	logger: true,
});
await app.listen({ host: "localhost", port: config.PORT });
