import Anthropic from "@anthropic-ai/sdk";
import {
	type LlmClient,
	LlmError,
	type LlmTurn,
	type StopReason,
	type ToolResult,
	type ToolSpec,
} from "../agent/llm.ts";

type CreateMessage = (
	params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>;

export function createAnthropicLlm(
	createMessage: CreateMessage,
	model: string,
): LlmClient {
	return {
		startChat(systemPrompt, tools) {
			const toolDefinitions = tools.map(toToolDefinition);
			const messages: Anthropic.MessageParam[] = [];

			async function send(
				content: string | Anthropic.ToolResultBlockParam[],
			): Promise<LlmTurn> {
				messages.push({ role: "user", content });
				const response = await callModel(createMessage, {
					model,
					// A ceiling, not a target: thinking counts against it.
					max_tokens: 16_000,
					system: systemPrompt,
					tools: toolDefinitions,
					messages,
					// The model's default effort, pinned so behaviour does not drift.
					output_config: { effort: "medium" },
				});
				messages.push({ role: "assistant", content: response.content });
				return toTurn(response);
			}

			return {
				sendUserMessage: (text) => send(text),
				sendToolResults: (results) => send(results.map(toToolResultBlock)),
			};
		},
	};
}

export function createAnthropicClient(apiKey: string): CreateMessage {
	// A timed-out request is retried, so one model call can take up to 60 seconds.
	const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
	return (params) => client.messages.create(params);
}

async function callModel(
	createMessage: CreateMessage,
	params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
	try {
		return await createMessage(params);
	} catch (error) {
		if (error instanceof Anthropic.APIError) {
			throw new LlmError("The Anthropic API request failed", { cause: error });
		}
		throw error;
	}
}

function toTurn(response: Anthropic.Message): LlmTurn {
	return {
		text: response.content
			.filter((block) => block.type === "text")
			.map((block) => block.text)
			.join(""),
		toolCalls: response.content
			.filter((block) => block.type === "tool_use")
			.map(({ id, name, input }) => ({ id, name, input })),
		stopReason: toStopReason(response.stop_reason),
		usage: {
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
		},
	};
}

function toStopReason(stopReason: Anthropic.StopReason | null): StopReason {
	switch (stopReason) {
		case "end_turn":
		case "tool_use":
		case "max_tokens":
		case "refusal":
			return stopReason;
		default:
			throw new LlmError(`Unexpected stop reason: ${stopReason}`);
	}
}

function toToolDefinition(tool: ToolSpec): Anthropic.Tool {
	return {
		name: tool.name,
		description: tool.description,
		// The API accepts only object schemas here, and every tool input is a z.object.
		input_schema: { ...tool.inputSchema, type: "object" },
	};
}

function toToolResultBlock(result: ToolResult): Anthropic.ToolResultBlockParam {
	return {
		type: "tool_result",
		tool_use_id: result.toolCallId,
		content: result.content,
		is_error: result.isError,
	};
}
