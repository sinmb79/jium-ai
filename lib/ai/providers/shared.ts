import type { CaseClassification, RequestDraftOutput } from "@/lib/types";
import { CaseClassificationSchema, RequestDraftSchema } from "@/lib/ai/schemas";

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : trimmed);
}

export function safeClassification(data: unknown): CaseClassification | null {
  const parsed = CaseClassificationSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function safeRequestDraft(data: unknown): RequestDraftOutput | null {
  const parsed = RequestDraftSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
