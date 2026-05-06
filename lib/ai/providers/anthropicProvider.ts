import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { AI_SAFETY_SYSTEM_PROMPT } from "@/lib/ai/safetyPolicy";
import type { AiProvider } from "@/lib/ai/types";
import { fetchWithTimeout, parseJsonObject, safeClassification, safeRequestDraft } from "@/lib/ai/providers/shared";

async function anthropicJson(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  if (!apiKey) {
    return null;
  }

  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      temperature: 0.2,
      system: AI_SAFETY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const text = data?.content?.find((item: { type?: string; text?: string }) => item.type === "text")?.text;
  return typeof text === "string" ? parseJsonObject(text) : null;
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",
  async classify(input) {
    const fallback = classifyCase(input.originalIntent);
    const json = await anthropicJson(`Return CaseClassification JSON only:\n${input.redactedDescription}`);
    const parsed = safeClassification(json);
    return parsed
      ? { ok: true, provider: "anthropic", model: process.env.ANTHROPIC_MODEL, data: parsed, redacted: true, fallbackUsed: false }
      : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
  },
  async generateRequest(input) {
    const fallback = generateRequestDraft(input.originalIntent, input.classification);
    const json = await anthropicJson(`Return RequestDraftOutput JSON only:\n${input.redactedDescription}`);
    const parsed = safeRequestDraft(json);
    return parsed
      ? { ok: true, provider: "anthropic", model: process.env.ANTHROPIC_MODEL, data: parsed, redacted: true, fallbackUsed: false }
      : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
  },
};
