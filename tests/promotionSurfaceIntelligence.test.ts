import { describe, expect, it } from "vitest";
import {
  buildPromotionSurfacePlan,
  detectPromotionSurfaceRoutes,
  unsafePromotionSurfaceMarkers,
} from "@/lib/promotionSurfaceIntelligence";
import type { CaseInput, EvidenceItem } from "@/lib/types";

const evidence: EvidenceItem[] = [
  {
    id: "promo-1",
    url: "https://example.invalid/public-post",
    platform: "public forum",
    location: "댓글 모집글",
    posterId: "alias-only",
    foundAt: "2026-05-31T10:00",
    capturedByUser: true,
    status: "DISCOVERED",
    notes: "댓글에서 디스코드 서버 초대, 유료 결제, 코인 지갑 문의를 유도함",
  },
  {
    id: "promo-2",
    url: "https://example.invalid/profile",
    platform: "SNS profile",
    location: "프로필 링크모음",
    posterId: "profile-alias",
    foundAt: "2026-05-31T10:20",
    capturedByUser: true,
    status: "DISCOVERED",
    notes: "프로필 bio와 고정글에서 DM 문의와 링크모음을 안내함",
  },
];

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "비공개방 홍보면 추적",
  description: "공개 게시판과 프로필에서 비공개 서버 유입이 의심됩니다.",
  targetUrl: "",
  platform: "public forum",
  keywords: "alias-only",
  evidenceItems: evidence,
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

describe("promotion surface intelligence", () => {
  it("detects public recruitment and payment surfaces without operational target links", () => {
    const matches = detectPromotionSurfaceRoutes(evidence);
    const ids = matches.map((match) => match.id);

    expect(ids).toEqual(
      expect.arrayContaining(["public-teaser-post", "comment-reply-recruitment", "payment-or-price-signal", "platform-migration-signal", "social-profile-linkhub"]),
    );
    expect(matches.find((match) => match.id === "payment-or-price-signal")?.accessLevel).toBe("OFFICIAL_ONLY");
    expect(unsafePromotionSurfaceMarkers()).toEqual([]);
  });

  it("builds a safe route surface plan from case evidence", () => {
    const plan = buildPromotionSurfacePlan(input);

    expect(plan.matches.length).toBeGreaterThan(0);
    expect(plan.routeSeeds).toEqual(expect.arrayContaining(["public forum", "alias-only"]));
    expect(plan.safeCollectionChecklist.join(" ")).toContain("비공개방 입장");
    expect(plan.boundaries.join(" ")).toContain("공개 디렉터리");
  });
});
