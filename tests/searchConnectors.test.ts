import { describe, expect, it } from "vitest";
import { buildSafeSearchActions, unsafeSearchActionMarkers } from "@/lib/searchConnectors";
import type { DiscoveryResearchPlan } from "@/lib/discoveryResearchEngine";

const plan: DiscoveryResearchPlan = {
  title: "test",
  summary: "test",
  generatedAt: "2026-05-31T00:00:00.000Z",
  safeQueries: [
    {
      id: "q1",
      query: "alias-a Example Forum",
      purpose: "공개 검색 확인",
      authority: "VICTIM_SAFE",
      boundary: "safe",
    },
    {
      id: "q2",
      query: "discord private room",
      purpose: "공식 인계",
      authority: "OFFICIAL_ONLY",
      boundary: "official",
    },
  ],
  matchChannels: [],
  evidenceGaps: [],
  officialPreservationRequests: [],
  expertLessons: [],
  boundaries: [],
};

describe("safe search connectors", () => {
  it("builds external search links only for victim-safe queries", () => {
    const actions = buildSafeSearchActions(plan);

    expect(actions).toHaveLength(3);
    expect(actions.map((action) => action.provider)).toEqual(["GOOGLE", "NAVER", "BING"]);
    expect(actions.every((action) => action.query === "alias-a Example Forum")).toBe(true);
    expect(unsafeSearchActionMarkers(actions)).toEqual([]);
  });
});
