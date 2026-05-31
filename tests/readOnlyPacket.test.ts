import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import { buildReadOnlyPacketHtml, buildReadOnlyPacketMarkdown } from "@/lib/readOnlyPacket";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "개인정보가 노출됐어요",
  title: "전화번호 노출",
  description: "전화번호가 게시됐습니다.",
  targetUrl: "https://example.com/post/1",
  platform: "Example",
  keywords: "alias",
  evidenceItems: [],
  exposedInfo: ["전화번호"],
  urgent: false,
  helperMode: "self",
};

function savedCase(overrides: Partial<CaseInput> = {}): SavedCase {
  const caseInput = { ...input, ...overrides };
  const classification = classifyCase(caseInput);
  return {
    id: "case-readonly",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
    storageMode: "LOCAL_FIRST",
    input: caseInput,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(caseInput, classification),
    responsePack: generateResponsePack(caseInput, classification),
    status: "READY",
    auditLog: [{ id: "audit-1", at: "2026-05-31T00:01:00.000Z", action: "CREATED", summary: "생성" }],
    notes: [],
  };
}

describe("read-only packet", () => {
  it("exports a static 담당자 패킷 without edit controls", () => {
    const markdown = buildReadOnlyPacketMarkdown(savedCase());
    const html = buildReadOnlyPacketHtml(savedCase());

    expect(markdown).toContain("담당자용 감사로그");
    expect(markdown).toContain("읽기전용 안내");
    expect(html).toContain("지움AI 읽기전용 담당자 패킷");
    expect(html).not.toContain("<script");
  });

  it("escapes user-controlled case fields in the 담당자 HTML packet", () => {
    const malicious = `<img src=x onerror="alert('xss')"><script>alert('xss')</script>`;
    const html = buildReadOnlyPacketHtml(
      savedCase({
        title: malicious,
        description: `설명 ${malicious}`,
        platform: `Forum ${malicious}`,
        targetUrl: `https://example.com/${malicious}`,
        evidenceItems: [
          {
            id: "ev-xss",
            url: `https://example.com/${malicious}`,
            platform: malicious,
            location: malicious,
            posterId: malicious,
            foundAt: "2026-05-31T09:00:00.000Z",
            capturedAt: "2026-05-31T09:05:00.000Z",
            captureMethod: "USER_SCREENSHOT",
            capturedByUser: true,
            notes: malicious,
            status: "DISCOVERED",
          },
        ],
      }),
    );

    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&#39;xss&#39;");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("onerror=\"alert");
  });
});
