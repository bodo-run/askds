import OpenAI from "openai";

import { Config, Message } from "./types.js";
import { ui } from "./ui.js";

export async function streamAIResponse(
  config: Config,
  messages: Message[]
): Promise<string> {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: "https://api.fireworks.ai/inference/v1",
  });

  try {
    if (config.debug) {
      ui.appendOutputLog("Sending messages to AI...");
    }

    const response = await openai.chat.completions.create({
      model: "@kortix-ai/fast-apply-7b-v1.0",
      messages,
      temperature: 0.01,
      max_tokens: 4096,
    });

    return response.choices[0].message.content || "";
  } catch (error: unknown) {
    if (config.debug) {
      ui.appendOutputLog(
        `API Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    throw error;
  }
}
