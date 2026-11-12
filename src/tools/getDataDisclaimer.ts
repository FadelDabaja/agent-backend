import { z } from "zod";
import { defineTool } from "../agent/tool.ts";

export const getDataDisclaimerTool = defineTool({
	name: "get_data_disclaimer",
	description:
		"Returns the fixed, approved statement about where these climate facts come from and how reliable they are. Call it when the user asks about the source, reliability or accuracy of the data. Quote the statement exactly.",
	input: z.object({}),
	execute: () =>
		"These climate facts are illustrative sample data defined in code, not measurements. Reference: KB-2026-01.",
});
