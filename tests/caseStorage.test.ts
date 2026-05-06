import { describe, expect, it, beforeEach } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { clearCases, loadCases, saveCases, upsertCase } from "@/lib/caseStorage";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "개인정보가 노출됐어요",
  title: "전화번호 노출",
  description: "전화번호는 010-1234-5678이고 글에 함께 적혀 있어요.",
  targetUrl: "https://example.com/private/post/123?name=test",
  platform: "Example Board",
  keywords: "test@example.com",
  exposedInfo: ["전화번호", "이메일"],
  urgent: false,
  helperMode: "self",
};

function buildSavedCase(overrides: Partial<SavedCase> = {}): SavedCase {
  const classification = classifyCase(input);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 90);

  return {
    id: "case-storage-test",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    storageMode: "LOCAL_FIRST",
    input,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(input, classification),
    responsePack: generateResponsePack(input, classification),
    status: "READY",
    notes: [],
    ...overrides,
  };
}

describe("caseStorage", () => {
  beforeEach(() => {
    clearCases();
  });

  it("로컬 저장 전에 URL 원문과 민감정보를 낮춘 사본으로 바꾼다", () => {
    upsertCase(buildSavedCase());

    const [stored] = loadCases();

    expect(stored.input.targetUrl).toBe("https://example.com/[경로 숨김]");
    expect(stored.input.description).toContain("[전화번호 가림]");
    expect(stored.input.keywords).toContain("[이메일 가림]");
    expect(stored.draft.body).not.toContain("010-1234-5678");
    expect(stored.draft.body).not.toContain("/private/post/123");
    expect(stored.notes.join(" ")).toContain("URL 원문");
  });

  it("만료된 로컬 사건은 로드할 때 자동 정리한다", () => {
    const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const futureAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    saveCases([
      buildSavedCase({ id: "expired-case", expiresAt: expiredAt }),
      buildSavedCase({ id: "active-case", expiresAt: futureAt }),
    ]);

    const cases = loadCases();

    expect(cases).toHaveLength(1);
    expect(cases[0]?.id).toBe("active-case");
    expect(window.localStorage.getItem("jium-ai.local-cases.v1")).not.toContain("expired-case");
  });
});
