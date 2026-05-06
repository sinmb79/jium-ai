import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import type { AiProvider, AiProviderName, AiProviderResult, RedactedCaseInput, RedactedRequestInput } from "@/lib/ai/types";
import type { CaseClassification, RequestDraftOutput } from "@/lib/types";
import { shouldBlockExternalAi } from "@/lib/ai/safetyPolicy";
import { ruleBasedProvider } from "@/lib/ai/providers/ruleBasedProvider";
import { openAIProvider } from "@/lib/ai/providers/openaiProvider";
import { anthropicProvider } from "@/lib/ai/providers/anthropicProvider";
import { geminiProvider } from "@/lib/ai/providers/geminiProvider";
import { clovaProvider } from "@/lib/ai/providers/clovaProvider";
import { upstageProvider } from "@/lib/ai/providers/upstageProvider";
import { azureOpenAIProvider } from "@/lib/ai/providers/azureOpenAIProvider";
import { openAICompatibleProvider } from "@/lib/ai/providers/openAICompatibleProvider";

const providers: Record<AiProviderName, AiProvider> = {
  rule: ruleBasedProvider,
  openai: openAIProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  clova: clovaProvider,
  upstage: upstageProvider,
  "azure-openai": azureOpenAIProvider,
  "openai-compatible": openAICompatibleProvider,
};

export function getConfiguredProviderName(): AiProviderName {
  const mode = process.env.AI_MODE || "off";
  if (mode === "off") {
    return "rule";
  }

  const configured = process.env.AI_PROVIDER as AiProviderName | undefined;
  return configured && providers[configured] ? configured : "rule";
}

export async function classifyWithProvider(input: RedactedCaseInput): Promise<AiProviderResult<CaseClassification>> {
  const providerName = getConfiguredProviderName();
  const fallback = classifyCase(input.originalIntent);

  if (providerName === "rule") {
    return ruleBasedProvider.classify(input);
  }

  if (shouldBlockExternalAi(fallback)) {
    return {
      ok: true,
      provider: "rule",
      data: fallback,
      redacted: true,
      fallbackUsed: true,
      safeMessage: "고위험 사건은 외부 AI 전송 없이 기본 안전 라우팅을 사용했습니다.",
    };
  }

  try {
    const result = await providers[providerName].classify(input);
    if (result.ok && result.data) {
      return result;
    }
  } catch {
    // Do not expose raw input or provider error details.
  }

  return {
    ok: true,
    provider: "rule",
    data: fallback,
    redacted: true,
    fallbackUsed: true,
    safeMessage: "AI provider 장애로 기본 모드 안내를 사용했습니다.",
  };
}

export async function generateRequestWithProvider(input: RedactedRequestInput): Promise<AiProviderResult<RequestDraftOutput>> {
  const providerName = getConfiguredProviderName();
  const fallback = generateRequestDraft(input.originalIntent, input.classification);

  if (providerName === "rule" || shouldBlockExternalAi(input.classification)) {
    return {
      ok: true,
      provider: "rule",
      data: fallback,
      redacted: true,
      fallbackUsed: providerName !== "rule",
      safeMessage: providerName === "rule" ? undefined : "고위험 사건은 외부 AI 전송 없이 템플릿을 사용했습니다.",
    };
  }

  try {
    const result = await providers[providerName].generateRequest(input);
    if (result.ok && result.data) {
      return result;
    }
  } catch {
    // Keep provider failure private.
  }

  return {
    ok: true,
    provider: "rule",
    data: fallback,
    redacted: true,
    fallbackUsed: true,
    safeMessage: "AI provider 장애로 기본 템플릿을 사용했습니다.",
  };
}
