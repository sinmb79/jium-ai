import type { AiProvider } from "@/lib/ai/types";
import { createOpenAICompatibleProvider } from "@/lib/ai/providers/openAICompatibleProvider";

export const upstageProvider: AiProvider = createOpenAICompatibleProvider("upstage", () => ({
  baseUrl: "https://api.upstage.ai/v1",
  apiKey: process.env.UPSTAGE_API_KEY,
  model: process.env.UPSTAGE_MODEL || "solar-pro2",
}));
