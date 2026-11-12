import type {
	LlmClient,
	StopReason,
	TokenUsage,
	ToolCall,
	ToolResult,
} from "./llm.ts";
import { SYSTEM_PROMPT } from "./systemPrompt.ts";
import type { Tool } from "./tool.ts";

export type AgentOutcome = "answered" | "refused" | "truncated" | "step_limit";

export interface ToolCallRecord {
	name: string;
	input: unknown;
	output: string;
	isError: boolean;
}

export interface AgentResult {
	outcome: AgentOutcome;
	answer: string | null;
	toolCalls: ToolCallRecord[];
	steps: number;
	usage: TokenUsage;
}

const OUTCOMES: Record<Exclude<StopReason, "tool_use">, AgentOutcome> = {
	end_turn: "answered",
	refusal: "refused",
	max_tokens: "truncated",
};

export async function runAgent(
	question: string,
	{ llm, tools, maxSteps }: { llm: LlmClient; tools: Tool[]; maxSteps: number },
): Promise<AgentResult> {
	const chat = llm.startChat(SYSTEM_PROMPT, tools);
	const toolCalls: ToolCallRecord[] = [];
	let turn = await chat.sendUserMessage(question);
	let steps = 1;
	let usage = turn.usage;

	while (turn.stopReason === "tool_use") {
		if (steps >= maxSteps) {
			return { outcome: "step_limit", answer: null, toolCalls, steps, usage };
		}
		const results: ToolResult[] = [];
		for (const call of turn.toolCalls) {
			const { output, isError } = await runToolCall(call, tools);
			toolCalls.push({ name: call.name, input: call.input, output, isError });
			results.push({ toolCallId: call.id, content: output, isError });
		}
		turn = await chat.sendToolResults(results);
		steps += 1;
		usage = addUsage(usage, turn.usage);
	}

	const outcome = OUTCOMES[turn.stopReason];
	return {
		outcome,
		answer: outcome === "answered" ? turn.text : null,
		toolCalls,
		steps,
		usage,
	};
}

async function runToolCall(
	call: ToolCall,
	tools: Tool[],
): Promise<{ output: string; isError: boolean }> {
	const tool = tools.find((candidate) => candidate.name === call.name);
	if (!tool) {
		return { output: `Unknown tool: ${call.name}`, isError: true };
	}
	try {
		return { output: await tool.run(call.input), isError: false };
	} catch (error) {
		return { output: String(error), isError: true };
	}
}

function addUsage(total: TokenUsage, turn: TokenUsage): TokenUsage {
	return {
		inputTokens: total.inputTokens + turn.inputTokens,
		outputTokens: total.outputTokens + turn.outputTokens,
	};
}
