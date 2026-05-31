import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { buildPreSubmissionChecklistReport, formatPreSubmissionChecklistMarkdown } from "@/lib/preSubmissionChecklist";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const completeInput: CaseInput = {
  situation: "디지털 성범죄 피해 게시물 발견",
  title: "유포 협박 게시물 제출 준비",
  description: "공개 게시판에 피해 이미지 유포를 암시하는 글과 결제 요구 문구가 발견되었습니다.",
  targetUrl: "https://example.com/post/preflight",
  platform: "Example Forum",
  keywords: "alias paid",
  evidenceItems: [
    {
      id: "ev-preflight-1",
      url: "https://example.com/post/preflight",
      platform: "Example Forum",
      location: "게시판",
      posterId: "alias",
      foundAt: "2026-05-31T09:00:00.000Z",
      capturedAt: "2026-05-31T09:05:00.000Z",
      captureMethod: "USER_SCREENSHOT",
      capturedByUser: true,
      evidenceHash: "sha256-preflight-placeholder",
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
      requestLogs: [
        {
          id: "req-preflight-1",
          target: "Example Forum",
          requestedAt: "2026-05-31T09:20:00.000Z",
          status: "SENT",
          receiptId: "receipt-001",
        },
      ],
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

function savedCase(input: CaseInput = completeInput): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-preflight",
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
    auditLog: [{ id: "audit-1", at: "2026-05-31T10:00:00.000Z", action: "SUBMISSION_VERSION_SAVED", summary: "저장" }],
    notes: [],
  };
}

describe("pre-submission checklist", () => {
  it("marks a complete evidence packet as ready while keeping safety review items visible", () => {
    const report = buildPreSubmissionChecklistReport(savedCase());

    expect(report.overallStatus).toBe("READY_TO_SUBMIT");
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.blockers).toHaveLength(0);
    expect(report.targets.length).toBeGreaterThan(0);
    expect(report.items.map((item) => item.id)).toEqual(expect.arrayContaining(["official-authority-boundary", "original-media-boundary"]));
  });

  it("blocks submission when the case lacks summary and access path", () => {
    const sparseInput: CaseInput = {
      ...completeInput,
      situation: "",
      title: "",
      description: "",
      targetUrl: "",
      platform: "",
      keywords: "",
      evidenceItems: [],
    };
    const report = buildPreSubmissionChecklistReport(savedCase(sparseInput));

    expect(report.overallStatus).toBe("BLOCKED");
    expect(report.blockers.map((item) => item.id)).toEqual(expect.arrayContaining(["case-summary", "evidence-access-path"]));
    expect(report.nextActions.join("\n")).toContain("제출 보류 항목");
  });

  it("formats a safe markdown checklist for agency handoff", () => {
    const report = buildPreSubmissionChecklistReport(savedCase());
    const markdown = formatPreSubmissionChecklistMarkdown(report);

    expect(markdown).toContain("지움AI 수사·심의기관 제출 전 최종 검수표");
    expect(markdown).toContain("전체 상태");
    expect(markdown).toContain("수사·심의기관");
    expect(markdown).not.toContain(".onion");
    expect(markdown).not.toContain("초대코드 구매");
  });
});
