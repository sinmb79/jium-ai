import { describe, expect, it } from "vitest";
import { classifyWithProvider } from "@/lib/ai/providerRouter";
import { redactCaseInput } from "@/lib/ai/redaction";
import type { CaseInput } from "@/lib/types";

describe("AI provider router", () => {
  it("AI_MODE 기본값에서는 rule-based fallback으로 동작한다", async () => {
    const input: CaseInput = {
      situation: "검색 결과에 계속 떠요",
      title: "검색 캐시 문제",
      description: "원본 글은 지웠는데 검색 결과 캐시가 남아 있어요",
      targetUrl: "",
      platform: "",
      keywords: "홍길동",
      exposedInfo: [],
      urgent: false,
      helperMode: "self",
    };

    const result = await classifyWithProvider(redactCaseInput(input));
    expect(result.provider).toBe("rule");
    expect(result.data?.caseType).toBe("SEARCH_RESULT_REMOVAL");
  });
});
