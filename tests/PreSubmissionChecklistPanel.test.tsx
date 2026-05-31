import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreSubmissionChecklistPanel } from "@/components/PreSubmissionChecklistPanel";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 피해 게시물 발견",
  title: "최종 검수 화면 테스트",
  description: "공개 게시판에 피해 이미지 유포를 암시하는 글이 발견되었습니다.",
  targetUrl: "https://example.com/post/preflight-ui",
  platform: "Example Forum",
  keywords: "alias",
  evidenceItems: [
    {
      id: "ev-preflight-ui",
      url: "https://example.com/post/preflight-ui",
      platform: "Example Forum",
      location: "게시판",
      posterId: "alias",
      foundAt: "2026-05-31T09:00:00.000Z",
      capturedAt: "2026-05-31T09:05:00.000Z",
      captureMethod: "USER_SCREENSHOT",
      capturedByUser: true,
      evidenceHash: "sha256-ui-preflight",
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
    id: "case-preflight-ui",
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

describe("PreSubmissionChecklistPanel", () => {
  it("renders final pre-submission readiness and export action", () => {
    render(<PreSubmissionChecklistPanel savedCase={savedCase()} />);

    expect(screen.getByText("제출 전 최종 검수")).toBeInTheDocument();
    expect(screen.getByText(/수사·심의기관에 제출하기 직전/)).toBeInTheDocument();
    expect(screen.getByText(/점수/)).toBeInTheDocument();
    expect(screen.getByText("검수표 저장")).toBeInTheDocument();
  });
});
