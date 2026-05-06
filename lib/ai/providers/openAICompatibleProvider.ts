import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { AI_SAFETY_SYSTEM_PROMPT } from "@/lib/ai/safetyPolicy";
import type { AiProvider, AiProviderName, RedactedCaseInput, RedactedRequestInput } from "@/lib/ai/types";
import { fetchWithTimeout, parseJsonObject, safeClassification, safeRequestDraft } from "@/lib/ai/providers/shared";

type OpenAICompatibleConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

async function chatJson(baseUrl: string, apiKey: string, model: string, prompt: string) {
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AI_SAFETY_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" ? parseJsonObject(text) : null;
}

export function createOpenAICompatibleProvider(name: AiProviderName, getConfig: () => OpenAICompatibleConfig): AiProvider {
  return {
    name,
    async classify(input: RedactedCaseInput) {
      const { baseUrl, apiKey, model } = getConfig();
      const fallback = classifyCase(input.originalIntent);

      if (!baseUrl || !apiKey || !model) {
        return { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
      }

      const json = await chatJson(
        baseUrl,
        apiKey,
        model,
        `Classify this redacted Korean case and return the full CaseClassification JSON schema only:\n${input.redactedDescription}`,
      );
      const parsed = safeClassification(json);
      return parsed
        ? { ok: true, provider: name, model, data: parsed, redacted: true, fallbackUsed: false }
        : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
    },
    async generateRequest(input: RedactedRequestInput) {
      const { baseUrl, apiKey, model } = getConfig();
      const fallback = generateRequestDraft(input.originalIntent, input.classification);

      if (!baseUrl || !apiKey || !model) {
        return { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
      }

      const json = await chatJson(
        baseUrl,
        apiKey,
        model,
        `Draft a safe Korean request document as RequestDraftOutput JSON. Use only this redacted case:\n${input.redactedDescription}`,
      );
      const parsed = safeRequestDraft(json);
      return parsed
        ? { ok: true, provider: name, model, data: parsed, redacted: true, fallbackUsed: false }
        : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
    },
  };
}

export const openAICompatibleProvider: AiProvider = createOpenAICompatibleProvider("openai-compatible", () => ({
  baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
  apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
  model: process.env.OPENAI_COMPATIBLE_MODEL,
}));
