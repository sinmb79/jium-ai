import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import {
  buildSupportHandoffArchive,
  buildSupportHandoffPayload,
  decryptSupportHandoffArchive,
  formatSupportHandoffInstruction,
  serializeSupportHandoffArchive,
} from "@/lib/supportHandoff";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 피해",
  title: "지원자 전달 테스트 사건",
  description: "공개 게시물에서 비공개방 유도와 유포 협박이 확인됐습니다.",
  targetUrl: "https://example.com/private/support-handoff",
  platform: "Example Forum",
  keywords: "alias paid",
  evidenceItems: [],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-support-handoff",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    storageMode: "LOCAL_FIRST",
    input,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(input, classification),
    responsePack: generateResponsePack(input, classification),
    status: "READY",
    notes: [],
  };
}

describe("support handoff archive", () => {
  it("encrypts a read-only support handoff without plaintext case details", async () => {
    const archive = await buildSupportHandoffArchive(savedCase(), "long support access code", {
      recipientRole: "COUNSELOR",
      generatedAt: "2026-06-01T00:00:00.000Z",
      validHours: 24,
      accessCodeHint: "전화로 공유",
    });
    const serialized = serializeSupportHandoffArchive(archive);

    expect(serialized).toContain("JIUM_SUPPORT_HANDOFF_ARCHIVE");
    expect(serialized).toContain("전화로 공유");
    expect(serialized).not.toContain("지원자 전달 테스트 사건");
    expect(serialized).not.toContain("https://example.com/private/support-handoff");

    const payload = await decryptSupportHandoffArchive(serialized, "long support access code", Date.parse("2026-06-01T01:00:00.000Z"));
    expect(payload.recipientRole).toBe("COUNSELOR");
    expect(payload.readOnlyMarkdown).toContain("지원자 전달 테스트 사건");
    expect(payload.prohibitedActions.join(" ")).toContain("IP");
  });

  it("rejects expired handoff files and formats a separate instruction memo", async () => {
    const archive = await buildSupportHandoffArchive(savedCase(), "long support access code", {
      recipientRole: "SUPPORTER",
      generatedAt: "2026-06-01T00:00:00.000Z",
      expiresAt: "2026-06-01T01:00:00.000Z",
    });
    const instruction = formatSupportHandoffInstruction(archive);

    expect(instruction).toContain("지움AI 지원자 전달 파일 안내");
    expect(instruction).toContain("피해자 지원자");
    await expect(decryptSupportHandoffArchive(serializeSupportHandoffArchive(archive), "long support access code", Date.parse("2026-06-01T02:00:00.000Z"))).rejects.toThrow(
      "expired",
    );
  });

  it("clamps validity hours and keeps the payload read-only", () => {
    const payload = buildSupportHandoffPayload(savedCase(), {
      generatedAt: "2026-06-01T00:00:00.000Z",
      validHours: 999,
    });

    expect(payload.expiresAt).toBe("2026-06-15T00:00:00.000Z");
    expect(payload.allowedActions.join(" ")).toContain("검토");
    expect(payload.prohibitedActions.join(" ")).toContain("자동 제출");
  });
});
