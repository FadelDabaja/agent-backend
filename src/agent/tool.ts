import { z } from "zod";
import type { ToolSpec } from "./llm.ts";

export interface Tool extends ToolSpec {
	/** Validates the input, then executes. Throws on invalid input or failure. */
	run(input: unknown): Promise<string>;
}

export function defineTool<Input>(definition: {
	name: string;
	description: string;
	input: z.ZodType<Input>;
	execute(input: Input): Promise<string> | string;
}): Tool {
	return {
		name: definition.name,
		description: definition.description,
		inputSchema: z.toJSONSchema(definition.input),
		async run(input) {
			const parsed = definition.input.safeParse(input);
			if (!parsed.success) {
				throw new Error(z.prettifyError(parsed.error));
			}
			return definition.execute(parsed.data);
		},
	};
}
