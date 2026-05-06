import { detectSensitiveInput, hasBlockingSensitiveInput, maskSensitiveText } from "@/lib/pii";
import type { CaseInput } from "@/lib/types";
import type { RedactedCaseInput } from "@/lib/ai/types";

function redactValue(value: string) {
  return maskSensitiveText(value);
}

export function redactCaseInput(input: CaseInput): RedactedCaseInput {
  const combined = [input.title, input.description, input.targetUrl, input.platform, input.keywords, input.exposedInfo.join(" ")].filter(Boolean).join("\n");
  const findings = detectSensitiveInput(combined).map((finding) => `${finding.label} ${finding.count}건`);

  return {
    originalIntent: {
      ...input,
      situation: redactValue(input.situation),
      title: redactValue(input.title),
      description: redactValue(input.description),
      targetUrl: input.targetUrl ? redactValue(input.targetUrl) : input.targetUrl,
      platform: input.platform ? redactValue(input.platform) : input.platform,
      keywords: input.keywords ? redactValue(input.keywords) : input.keywords,
      exposedInfo: input.exposedInfo.map(redactValue),
    },
    redactedDescription: maskSensitiveText(combined),
    findings,
    blocked: hasBlockingSensitiveInput(combined),
  };
}
