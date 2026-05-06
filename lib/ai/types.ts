import type { CaseClassification, CaseInput, RequestDraftOutput } from "@/lib/types";

export type AiTask = "classify" | "draft_request" | "summarize_case" | "rewrite_plain";

export type AiProviderName =
  | "rule"
  | "openai"
  | "anthropic"
  | "gemini"
  | "clova"
  | "upstage"
  | "azure-openai"
  | "openai-compatible";

export type RedactedCaseInput = {
  originalIntent: CaseInput;
  redactedDescription: string;
  findings: string[];
};

export type RedactedRequestInput = RedactedCaseInput & {
  classification: CaseClassification;
};

export type AiProviderResult<T> = {
  ok: boolean;
  provider: AiProviderName;
  model?: string;
  data?: T;
  redacted: boolean;
  fallbackUsed: boolean;
  safeMessage?: string;
};

export interface AiProvider {
  name: AiProviderName;
  classify(input: RedactedCaseInput): Promise<AiProviderResult<CaseClassification>>;
  generateRequest(input: RedactedRequestInput): Promise<AiProviderResult<RequestDraftOutput>>;
}
