import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import {
	hasZodFastifySchemaValidationErrors,
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import type { AgentResult } from "../agent/agent.ts";
import { LlmError } from "../agent/llm.ts";

const askQuery = z.object({
	question: z
		.string()
		.trim()
		.min(1)
		.max(500)
		.describe("For example: Is France warmer than Sweden?"),
});

const askResponse = z.object({
	outcome: z.enum(["answered", "refused", "truncated", "step_limit"]),
	answer: z.string().nullable(),
	toolCalls: z.array(
		z.object({
			name: z.string(),
			input: z.unknown(),
			output: z.string(),
			isError: z.boolean(),
		}),
	),
	steps: z.number(),
	usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
	model: z.string(),
});

const errorResponse = z.object({ error: z.string() });

export async function buildApp({
	ask,
	model,
	logger,
}: {
	ask: (question: string) => Promise<AgentResult>;
	model: string;
	logger: boolean;
}): Promise<FastifyInstance> {
	const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	app.setErrorHandler((error, request, reply) => {
		if (hasZodFastifySchemaValidationErrors(error)) {
			return reply.code(400).send({ error: error.message });
		}
		if (error instanceof LlmError) {
			request.log.error(error);
			return reply
				.code(502)
				.send({ error: "The language model request failed." });
		}
		throw error;
	});

	// Swagger documents only the routes that are added after it has loaded.
	await app.register(fastifySwagger, {
		openapi: { info: { title: "Agent backend", version: "0.1.0" } },
		transform: jsonSchemaTransform,
	});
	await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

	app.get("/", { schema: { hide: true } }, (_request, reply) =>
		reply.redirect("/docs"),
	);

	app.get(
		"/ask",
		{
			schema: {
				summary: "Ask the agent a question",
				querystring: askQuery,
				response: { 200: askResponse, 400: errorResponse, 502: errorResponse },
			},
		},
		async (request, reply) => {
			const result = await ask(request.query.question);
			reply.header("cache-control", "no-store");
			return { ...result, model };
		},
	);

	return app;
}
