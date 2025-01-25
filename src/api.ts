import OpenAI from "openai";

import { Config, Message } from "./types.js";
import { ui } from "./ui.js";

export const apis = {
  DEEPSEEK: {
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com",
    model: "deepseek-reasoner",
    apiKey: process.env.DEEPSEEK_API_KEY,
    maxTokens: 4096,
    temperature: 0.01,
  },
  FIREWORKS: {
    name: "Fireworks",
    endpoint: "https://api.fireworks.ai/inference/v1",
    model: "accounts/me-63642b/deployedModels/fast-apply-de5bd7ca",
    apiKey: process.env.FIREWORKS_AI_API_KEY,
    maxTokens: 4096,
    temperature: 0.6,
  },
} as const;

export async function streamAIResponse({
  api,
  config,
  messages,
  appendReasoningMessages = false,
}: {
  api: (typeof apis)[keyof typeof apis];
  config: Config;
  messages: Message[];
  appendReasoningMessages?: boolean;
}): Promise<string> {
  if (!api.apiKey) {
    throw new Error(`API key for ${api.name} is not set`);
  }

  const client = new OpenAI({
    apiKey: api.apiKey,
    baseURL: api.endpoint,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    if (config.debug) {
      ui.appendOutputLog(`Sending messages to ${api.name}...`);
    }

    if (appendReasoningMessages) {
      const streamResponse = await client.chat.completions.create(
        {
          model: api.model,
          messages,
          temperature: api.temperature,
          max_tokens: api.maxTokens,
          stream: true,
        },
        {
          signal: controller.signal,
        }
      );

      let fullContent = "";
      let fullReasoning = "";
      let chunkCount = 0;

      for await (const chunk of streamResponse) {
        chunkCount++;
        const contentChunk = chunk.choices[0]?.delta?.content || "";
        const reasoningChunk =
          (chunk as any).choices[0]?.delta?.reasoning_content || "";

        if (config.debug && chunkCount % 25 === 0) {
          ui.appendOutputLog(
            `[${api.name}] Received ${chunkCount} chunks. ` +
              `Content: ${contentChunk.length}b, ` +
              `Reasoning: ${reasoningChunk.length}b\n`
          );
        }

        fullContent += contentChunk;
        fullReasoning += reasoningChunk;

        const displayText = reasoningChunk || contentChunk;
        ui.appendReasoningLog(displayText);
      }

      return fullContent || fullReasoning;
    } else {
      const response = await client.chat.completions.create(
        {
          model: api.model,
          messages,
          temperature: api.temperature,
          max_tokens: api.maxTokens,
        },
        {
          signal: controller.signal,
        }
      );

      return response.choices[0].message.content || "";
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `API request timed out after ${config.timeout / 1000} seconds`
      );
    }

    if (config.debug) {
      ui.appendOutputLog(
        `[${api.name}] API Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
