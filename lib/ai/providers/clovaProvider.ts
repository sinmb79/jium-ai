import type { AiProvider } from "@/lib/ai/types";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openAICompatibleProvider";

export const clovaProvider: AiProvider = createOpenAICompatibleProvider("clova", () => ({
  baseUrl: process.env.CLOVA_BASE_URL,
  apiKey: process.env.CLOVA_API_KEY,
  model: process.env.CLOVA_MODEL,
}));
