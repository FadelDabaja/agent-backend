export interface ToolSpec {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface ToolCall {
	id: string;
	name: string;
	input: unknown;
}

export interface ToolResult {
	toolCallId: string;
	content: string;
	isError: boolean;
}

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal";

export interface LlmTurn {
	text: string;
	toolCalls: ToolCall[];
	stopReason: StopReason;
	usage: TokenUsage;
}

/**
 * One conversation. The implementation owns the transcript, so provider content
 * such as thinking blocks goes back to the model unchanged.
 */
export interface Chat {
	sendUserMessage(text: string): Promise<LlmTurn>;
	sendToolResults(results: ToolResult[]): Promise<LlmTurn>;
}

export interface LlmClient {
	startChat(systemPrompt: string, tools: ToolSpec[]): Chat;
}

/** The provider call failed or returned something the loop cannot act on. */
export class LlmError extends Error {}
