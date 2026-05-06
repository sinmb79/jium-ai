import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { AI_SAFETY_SYSTEM_PROMPT } from "@/lib/ai/safetyPolicy";
import type { AiProvider } from "@/lib/ai/types";
import { fetchWithTimeout, parseJsonObject, safeClassification, safeRequestDraft } from "@/lib/ai/providers/shared";

async function azureChatJson(prompt: string) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";

  if (!endpoint || !deployment || !apiKey) {
    return null;
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
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

export const azureOpenAIProvider: AiProvider = {
  name: "azure-openai",
  async classify(input) {
    const fallback = classifyCase(input.originalIntent);
    const json = await azureChatJson(`Return CaseClassification JSON only:\n${input.redactedDescription}`);
    const parsed = safeClassification(json);
    return parsed
      ? {
          ok: true,
          provider: "azure-openai",
          model: process.env.AZURE_OPENAI_DEPLOYMENT,
          data: parsed,
          redacted: true,
          fallbackUsed: false,
        }
      : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
  },
  async generateRequest(input) {
    const fallback = generateRequestDraft(input.originalIntent, input.classification);
    const json = await azureChatJson(`Return RequestDraftOutput JSON only:\n${input.redactedDescription}`);
    const parsed = safeRequestDraft(json);
    return parsed
      ? {
          ok: true,
          provider: "azure-openai",
          model: process.env.AZURE_OPENAI_DEPLOYMENT,
          data: parsed,
          redacted: true,
          fallbackUsed: false,
        }
      : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
  },
};
