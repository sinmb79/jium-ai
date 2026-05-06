import type { CaseClassification } from "@/lib/types";

export function shouldBlockExternalAi(classification: CaseClassification) {
  return classification.specialistFirst || classification.riskLevel === "CRITICAL" || classification.sensitivityLevel === "CRITICAL";
}

export const AI_SAFETY_SYSTEM_PROMPT = `
You help a Korean digital rights self-help tool.
Never promise deletion success.
Never ask for passwords, resident registration numbers, payment card numbers, or original sexual abuse material.
For digital sex crime, child harm, coercion, stalking, or self-harm risk, prioritize specialist public resources.
Return only JSON that matches the requested schema.
`;
