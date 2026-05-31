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

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-readonly",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
    storageMode: "LOCAL_FIRST",
    input,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(input, classification),
    responsePack: generateResponsePack(input, classification),
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
});
