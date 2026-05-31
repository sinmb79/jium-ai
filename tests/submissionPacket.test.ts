import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateResponsePack } from "@/lib/responsePack";
import { buildSubmissionPacket, submissionPacketToMarkdown, traceAnalysisToMermaid } from "@/lib/submissionPacket";
import { buildTraceAnalysis } from "@/lib/traceEngine";
import type { CaseInput } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "텔레그램·디스코드 재유포 의심 사건",
  description: "딥페이크 이미지가 게시판에서 발견되고, 디스코드 비공개 서버와 암호화폐 결제 요구가 언급됐습니다.",
  targetUrl: "https://example.com/post/1",
  platform: "Example Forum",
  keywords: "alias-a",
  evidenceItems: [
    {
      id: "ev-first",
      url: "https://example.com/post/1",
      platform: "Example Forum",
      location: "게시판 원글",
      posterId: "alias-a",
      foundAt: "2026-05-31T09:00",
      capturedAt: "2026-05-31T09:05",
      captureMethod: "USER_SCREENSHOT",
      capturedByUser: true,
      evidenceHash: "sha256-placeholder",
      hashSource: "사용자 기기",
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
      notes: "디스코드 서버 초대와 crypto wallet 결제 요구 언급",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

describe("submission packet", () => {
  it("기관 제출용 다이어그램과 법적 권한 메모를 만든다", () => {
    const classification = classifyCase(input);
    const responsePack = generateResponsePack(input, classification);
    const packet = buildSubmissionPacket(input, classification, responsePack, "2026-05-31T00:00:00.000Z");
    const markdown = submissionPacketToMarkdown(packet);

    expect(packet.traceMermaid).toContain("graph TD");
    expect(markdown).toContain("기관 제출 패킷");
    expect(markdown).toContain("IP, 가입자 정보");
    expect(markdown).toContain("디스코드");
    expect(markdown).toContain("sha256-placeholder");
    expect(markdown).not.toContain("직접 잠입");
  });

  it("추적 그래프를 mermaid 형식으로 변환한다", () => {
    const mermaid = traceAnalysisToMermaid(buildTraceAnalysis(input));

    expect(mermaid).toContain("graph TD");
    expect(mermaid).toContain("Example Forum");
    expect(mermaid).toContain("관찰된 게시자");
  });
});
