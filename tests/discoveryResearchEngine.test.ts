import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { buildDiscoveryResearchPlan } from "@/lib/discoveryResearchEngine";
import type { CaseInput } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "비공개 서버 재유포 의심",
  description: "딥페이크 이미지가 공개 게시판에서 발견된 뒤 디스코드 비공개 서버와 암호화폐 결제 요구로 이어졌습니다.",
  targetUrl: "https://example.com/post/1",
  platform: "Example Forum",
  keywords: "alias-a",
  evidenceItems: [
    {
      id: "ev-1",
      url: "https://example.com/post/1",
      platform: "Example Forum",
      location: "게시판 원글",
      posterId: "alias-a",
      foundAt: "2026-05-31T09:00",
      capturedAt: "2026-05-31T09:05",
      captureMethod: "USER_SCREENSHOT",
      capturedByUser: true,
      evidenceHash: "sha256-placeholder",
      hashSource: "사용자 기기에서 생성한 이미지 해시",
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
      notes: "디스코드 서버 초대와 암호화폐 결제 요구가 함께 언급됨",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련", "계정 ID"],
  urgent: true,
  helperMode: "self",
};

describe("discovery research engine", () => {
  it("초기 피해 사실을 매칭 채널과 공식 인계 단서로 분리한다", () => {
    const classification = classifyCase(input);
    const plan = buildDiscoveryResearchPlan(input, classification, "2026-05-31T00:00:00.000Z");

    expect(plan.matchChannels.map((channel) => channel.id)).toEqual(
      expect.arrayContaining(["text-keyword-alias", "visual-fingerprint", "platform-log-preservation", "route-discord-private-server", "route-crypto-payment-trade"]),
    );
    expect(plan.matchChannels.find((channel) => channel.id === "route-crypto-payment-trade")?.authority).toBe("OFFICIAL_ONLY");
    expect(plan.officialPreservationRequests.join(" ")).toContain("IP, 가입자 정보");
    expect(plan.boundaries.join(" ")).toContain("초대코드 구매");
  });

  it("자동 잠입이나 피해물 업로드 없이 공개 확인용 쿼리만 만든다", () => {
    const classification = classifyCase(input);
    const plan = buildDiscoveryResearchPlan(input, classification, "2026-05-31T00:00:00.000Z");

    expect(plan.safeQueries.length).toBeGreaterThan(0);
    expect(JSON.stringify(plan).toLowerCase()).not.toContain("discord.gg/");
    expect(JSON.stringify(plan).toLowerCase()).not.toContain("t.me/");
    expect(plan.matchChannels.find((channel) => channel.id === "visual-fingerprint")?.safetyBoundary).toContain("업로드하지 않습니다");
  });
});
