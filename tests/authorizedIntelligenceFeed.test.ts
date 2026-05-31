import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAuthorizedFeedSummary,
  clearAuthorizedFeedIndicators,
  importAuthorizedFeedBundle,
  loadAuthorizedFeedIndicators,
  saveAuthorizedFeedIndicators,
  unsafeAuthorizedFeedStorageMarkers,
  validateAuthorizedFeedIndicator,
  type AuthorizedFeedBundle,
  type AuthorizedFeedIndicator,
} from "@/lib/authorizedIntelligenceFeed";

const digest = "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function indicator(overrides: Partial<AuthorizedFeedIndicator> = {}): AuthorizedFeedIndicator {
  return {
    id: "partner-feed-001",
    kind: "ROUTE_PATTERN",
    label: "비공개방 유도 반복 패턴",
    publicSummary: "공개 표면에서 폐쇄형 채널 이동과 결제 요구가 함께 나타난 비식별 지표",
    sourceName: "Authorized NGO Partner",
    sourceType: "AUTHORIZED_PARTNER_FEED",
    sourceDate: "2026-05-01T00:00:00.000Z",
    lastCheckedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
    accessLevel: "AUTHORIZED_INTEL_ONLY",
    confidence: "HIGH",
    riskLevel: "CRITICAL",
    routePatternId: "encrypted-private-room",
    promotionSurfaceId: "platform-migration-signal",
    indicatorDigest: digest,
    signalTags: ["private-room", "payment", "handoff"],
    allowedUses: ["피해자 사건 증거목록과 비식별 매칭", "공식기관 제출 우선순위 판단"],
    prohibitedUses: ["공개 목록 게시", "비공개방 잠입", "초대 요청", "구매 또는 다운로드"],
    officialHandoff: ["중앙디지털성범죄피해자지원센터", "경찰 ECRM"],
    auditLog: [],
    ...overrides,
  };
}

describe("authorized intelligence feed", () => {
  beforeEach(() => {
    clearAuthorizedFeedIndicators();
  });

  it("imports only authorized, provenance-rich, non-raw indicators", () => {
    const { auditLog, sourceName, sourceType, ...bundleIndicator } = indicator();
    const bundle: AuthorizedFeedBundle = {
      version: "jium-authorized-feed-v1",
      generatedAt: "2026-05-31T00:00:00.000Z",
      sourceName: "Authorized NGO Partner",
      sourceType: "AUTHORIZED_PARTNER_FEED",
      authorizationRef: "MOU-2026-05-PARTNER",
      indicators: [bundleIndicator],
    };
    const imported = importAuthorizedFeedBundle(bundle, "2026-05-31T01:00:00.000Z");

    expect(imported).toHaveLength(1);
    expect(imported[0]?.auditLog[0]?.action).toBe("IMPORTED");
    expect(imported[0]?.sourceName).toBe("Authorized NGO Partner");
    expect(imported[0]?.indicatorDigest).toBe(digest);
    expect(unsafeAuthorizedFeedStorageMarkers(imported)).toEqual([]);
  });

  it("rejects raw URLs, invite links, handles, and unsupported pattern ids", () => {
    const unsafe = indicator({
      id: "unsafe-feed",
      publicSummary: "raw target https://example.invalid/path and t.me/unsafe-room",
      routePatternId: "unknown-pattern",
    });
    const validation = validateAuthorizedFeedIndicator(unsafe);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join("\n")).toContain("raw URLs");
    expect(validation.errors.join("\n")).toContain("unknown routePatternId");
  });

  it("stores feed indicators with retention and exposes only aggregate summaries", () => {
    const active = indicator({ id: "active-feed", expiresAt: "2026-06-20T00:00:00.000Z" });
    const expired = indicator({ id: "expired-feed", expiresAt: "2026-05-01T00:00:00.000Z" });

    saveAuthorizedFeedIndicators([active, expired], "2026-05-31T00:00:00.000Z");
    const loaded = loadAuthorizedFeedIndicators();
    const summary = buildAuthorizedFeedSummary(loaded, "2026-05-31T00:00:00.000Z");

    expect(loaded.map((item) => item.id)).toEqual(["active-feed"]);
    expect(summary.total).toBe(1);
    expect(summary.byRoutePattern["encrypted-private-room"]).toBe(1);
    expect(summary.byPromotionSurface["platform-migration-signal"]).toBe(1);
    expect(summary.byAccessLevel.AUTHORIZED_INTEL_ONLY).toBe(1);
    expect(summary.expiringWithin30Days).toBe(1);
  });
});
