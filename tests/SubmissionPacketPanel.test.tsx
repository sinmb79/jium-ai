import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubmissionPacketPanel } from "@/components/SubmissionPacketPanel";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 피해",
  title: "기관별 제출 준비도 화면 테스트",
  description: "딥페이크 이미지 게시글과 비공개방 유도 문구가 발견됐습니다.",
  targetUrl: "https://example.com/post/ui",
  platform: "Example Forum",
  keywords: "alias",
  evidenceItems: [
    {
      id: "ev-ui-1",
      url: "https://example.com/post/ui",
      platform: "Example Forum",
      location: "게시판",
      posterId: "alias",
      foundAt: "2026-05-31T09:00:00.000Z",
      capturedAt: "2026-05-31T09:05:00.000Z",
      captureMethod: "USER_SCREENSHOT",
      capturedByUser: true,
      evidenceHash: "sha256-ui-placeholder",
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-ui",
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
    notes: [],
  };
}

describe("SubmissionPacketPanel", () => {
  it("renders agency workflow readiness cards for the submission packet", () => {
    render(<SubmissionPacketPanel savedCase={savedCase()} />);

    expect(screen.getByText("기관별 제출 준비도")).toBeInTheDocument();
    expect(screen.getByText("중앙디지털성범죄피해자지원센터")).toBeInTheDocument();
    expect(screen.getAllByText("경찰청 사이버범죄 신고시스템").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("공식 경로 열기").length).toBeGreaterThanOrEqual(2);
  });
});
