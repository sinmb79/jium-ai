import type { AiProvider } from "@/lib/ai/types";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openAICompatibleProvider";

export const openAIProvider: AiProvider = createOpenAICompatibleProvider("openai", () => ({
  baseUrl: "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
}));
