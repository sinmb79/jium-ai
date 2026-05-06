import { detectSensitiveInput, maskSensitiveText } from "@/lib/pii";
import type { CaseInput } from "@/lib/types";
import type { RedactedCaseInput } from "@/lib/ai/types";

export function redactCaseInput(input: CaseInput): RedactedCaseInput {
  const combined = [input.title, input.description, input.targetUrl, input.platform, input.keywords, input.exposedInfo.join(" ")].filter(Boolean).join("\n");
  const findings = detectSensitiveInput(combined).map((finding) => `${finding.label} ${finding.count}건`);

  return {
    originalIntent: {
      ...input,
      description: maskSensitiveText(input.description),
      targetUrl: input.targetUrl ? maskSensitiveText(input.targetUrl) : input.targetUrl,
      keywords: input.keywords ? maskSensitiveText(input.keywords) : input.keywords,
    },
    redactedDescription: maskSensitiveText(combined),
    findings,
  };
}
