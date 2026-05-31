import { describe, expect, it } from "vitest";
import { buildTraceAnalysis } from "@/lib/traceEngine";
import type { CaseInput } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "텔레그램 재유포 의심 사건",
  description: "피해 영상이 커뮤니티에서 발견된 뒤 텔레그램 채널과 다크웹 언급으로 이어졌습니다.",
  targetUrl: "https://example.com/post/1",
  platform: "Example Forum",
  keywords: "alias-a",
  evidenceItems: [
    {
      id: "evidence-late",
      url: "https://t.me/example-channel/20",
      platform: "텔레그램 비밀 채널",
      location: "채널 게시글",
      posterId: "alias-a",
      foundAt: "2026-05-06T16:00",
      capturedByUser: false,
      submissionTarget: "경찰 ECRM",
      status: "REAPPEARED",
      notes: "재업로드 정황, VPN 우회 IP를 쓴다는 주장",
    },
    {
      id: "evidence-first",
      url: "https://example.com/post/1",
      platform: "Example Forum",
      location: "게시판 원글",
      posterId: "alias-a",
      foundAt: "2026-05-06T13:30",
      capturedByUser: true,
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
      notes: "첫 발견",
    },
    {
      id: "evidence-dark",
      url: "http://exampleonion.onion/thread",
      platform: "다크웹 언급",
      location: "외부 링크 메모",
      posterId: "",
      foundAt: "2026-05-06T18:10",
      capturedByUser: false,
      submissionTarget: "수사기관 상담",
      status: "DISCOVERED",
      notes: ".onion 주소가 공유됐다는 제보",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

describe("trace engine", () => {
  it("발견 시각 기준으로 시간순 다이어그램과 전파 가설을 만든다", () => {
    const analysis = buildTraceAnalysis(input);

    expect(analysis.timeline.map((entry) => entry.evidenceId)).toEqual(["evidence-first", "evidence-late", "evidence-dark"]);
    expect(analysis.edges.some((edge) => edge.kind === "TIME_SEQUENCE" && edge.confidence === "INFERRED")).toBe(true);
    expect(analysis.nodes.some((node) => node.kind === "ACTOR_ALIAS" && node.detail?.includes("실명 단정 아님"))).toBe(true);
  });

  it("폐쇄형 채널, 다크웹, 우회 IP, 재업로드를 학습 신호로 분리한다", () => {
    const analysis = buildTraceAnalysis(input);

    expect(analysis.learningSignals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(["encrypted-channel", "dark-web", "proxy-or-vpn", "reupload-after-removal"]),
    );
    expect(analysis.learningSignals.every((signal) => signal.learningNote.includes("피해물 원본"))).toBe(true);
    expect(analysis.boundaries.join(" ")).toContain("비밀방 잠입");
  });

  it("증거가 부족하면 담당자가 확인할 질문을 남긴다", () => {
    const analysis = buildTraceAnalysis({
      ...input,
      evidenceItems: [],
      targetUrl: "",
      platform: "",
      keywords: "",
    });

    expect(analysis.nextQuestions).toEqual(expect.arrayContaining(["처음 발견한 날짜와 시간을 입력하면 전파 순서를 더 정확히 볼 수 있습니다."]));
  });
});
