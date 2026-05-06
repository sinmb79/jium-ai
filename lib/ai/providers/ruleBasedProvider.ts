import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import type { AiProvider } from "@/lib/ai/types";

export const ruleBasedProvider: AiProvider = {
  name: "rule",
  async classify(input) {
    return {
      ok: true,
      provider: "rule",
      data: classifyCase(input.originalIntent),
      redacted: true,
      fallbackUsed: false,
    };
  },
  async generateRequest(input) {
    return {
      ok: true,
      provider: "rule",
      data: generateRequestDraft(input.originalIntent, input.classification),
      redacted: true,
      fallbackUsed: false,
    };
  },
};
