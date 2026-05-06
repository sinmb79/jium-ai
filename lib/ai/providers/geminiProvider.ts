import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { AI_SAFETY_SYSTEM_PROMPT } from "@/lib/ai/safetyPolicy";
import type { AiProvider } from "@/lib/ai/types";
import { fetchWithTimeout, parseJsonObject, safeClassification, safeRequestDraft } from "@/lib/ai/providers/shared";

async function geminiJson(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) {
    return null;
  }

  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `${AI_SAFETY_SYSTEM_PROMPT}\n${prompt}` }],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? parseJsonObject(text) : null;
}

export const geminiProvider: AiProvider = {
  name: "gemini",
  async classify(input) {
    const fallback = classifyCase(input.originalIntent);
    const json = await geminiJson(`Return CaseClassification JSON only:\n${input.redactedDescription}`);
    const parsed = safeClassification(json);
    return parsed
      ? { ok: true, provider: "gemini", model: process.env.GEMINI_MODEL, data: parsed, redacted: true, fallbackUsed: false }
      : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
  },
  async generateRequest(input) {
    const fallback = generateRequestDraft(input.originalIntent, input.classification);
    const json = await geminiJson(`Return RequestDraftOutput JSON only:\n${input.redactedDescription}`);
    const parsed = safeRequestDraft(json);
    return parsed
      ? { ok: true, provider: "gemini", model: process.env.GEMINI_MODEL, data: parsed, redacted: true, fallbackUsed: false }
      : { ok: true, provider: "rule", data: fallback, redacted: true, fallbackUsed: true };
  },
};
