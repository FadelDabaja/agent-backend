import { z } from "zod";

const environment = z.object({
	ANTHROPIC_API_KEY: z.string().min(1),
	ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5-5"),
	PORT: z.coerce.number().int().default(3000),
});

export function loadConfig(): z.infer<typeof environment> {
	const parsed = environment.safeParse(process.env);
	if (!parsed.success) {
		throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
	}
	return parsed.data;
}
