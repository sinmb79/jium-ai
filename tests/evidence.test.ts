import { describe, expect, it } from "vitest";
import { formatEvidenceLedgerForDocument, getEvidenceLedger } from "@/lib/evidence";
import type { CaseInput } from "@/lib/types";

const input: CaseInput = {
  situation: "긴급한 유포/협박 피해예요",
  title: "유포 피해",
  description: "딥페이크 영상이 퍼졌어요.",
  targetUrl: "https://example.com/post/1",
  platform: "Example SNS",
  keywords: "suspect-id",
  evidenceItems: [
    {
      id: "evidence-1",
      url: "https://example.com/post/1",
      platform: "Example SNS",
      location: "피해 게시판",
      posterId: "suspect-id",
      foundAt: "2026-05-06T13:30",
      capturedByUser: true,
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
      notes: "첫 발견",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

describe("evidence ledger", () => {
  it("명시된 접근경로 증거목록을 문서용 목록으로 정리한다", () => {
    const document = formatEvidenceLedgerForDocument(input);

    expect(document).toContain("https://example.com/post/1");
    expect(document).toContain("피해 게시판");
    expect(document).toContain("중앙디지털성범죄피해자지원센터");
    expect(document).toContain("사용자 캡처 보유: 예");
  });

  it("증거목록이 없으면 기본 URL 입력값으로 접근경로를 만든다", () => {
    const ledger = getEvidenceLedger({ ...input, evidenceItems: [] });

    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.url).toBe("https://example.com/post/1");
    expect(ledger[0]?.posterId).toBe("suspect-id");
  });
});
