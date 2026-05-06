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
  evidenceItems: [
    {
      id: "evidence-storage-test",
      url: "https://example.com/private/post/123?name=test",
      platform: "Example Board",
      location: "피해 게시판",
      posterId: "test@example.com",
      foundAt: "2026-05-06T13:30",
      capturedByUser: true,
      submissionTarget: "KISA 개인정보침해 신고센터",
      status: "DISCOVERED",
      notes: "010-1234-5678이 보임",
    },
  ],
  keepExactUrlsForSubmission: false,
  exposedInfo: ["전화번호", "이메일"],
  urgent: false,
  helperMode: "self",
};

function buildSavedCase(overrides: Partial<SavedCase> = {}): SavedCase {
  const caseInput = overrides.input || input;
  const classification = classifyCase(caseInput);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 90);

  return {
    id: "case-storage-test",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    storageMode: "LOCAL_FIRST",
    input: caseInput,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(caseInput, classification),
    responsePack: generateResponsePack(caseInput, classification),
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
    expect(stored.input.evidenceItems?.[0]?.url).toBe("https://example.com/[경로 숨김]");
    expect(stored.input.evidenceItems?.[0]?.posterId).toContain("[이메일 가림]");
    expect(stored.input.evidenceItems?.[0]?.notes).toContain("[전화번호 가림]");
    expect(stored.input.description).toContain("[전화번호 가림]");
    expect(stored.input.keywords).toContain("[이메일 가림]");
    expect(stored.draft.body).not.toContain("010-1234-5678");
    expect(stored.draft.body).not.toContain("/private/post/123");
    expect(stored.notes.join(" ")).toContain("URL 원문");
  });

  it("사용자가 선택한 경우 기관 제출용 정확한 URL을 로컬 보드에 보관한다", () => {
    upsertCase(
      buildSavedCase({
        input: {
          ...input,
          keepExactUrlsForSubmission: true,
        },
      }),
    );

    const [stored] = loadCases();

    expect(stored.input.targetUrl).toBe("https://example.com/private/post/123?name=test");
    expect(stored.input.evidenceItems?.[0]?.url).toBe("https://example.com/private/post/123?name=test");
    expect(stored.input.description).toContain("[전화번호 가림]");
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
