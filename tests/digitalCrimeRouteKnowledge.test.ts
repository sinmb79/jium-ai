import { describe, expect, it } from "vitest";
import {
  DIGITAL_CRIME_ROUTE_BOUNDARIES,
  DIGITAL_CRIME_ROUTE_PATTERNS,
  detectDigitalCrimeRoutePatterns,
  unsafeOperationalTargetMarkersInRouteKnowledge,
} from "@/lib/digitalCrimeRouteKnowledge";
import type { EvidenceItem } from "@/lib/types";

const evidence: EvidenceItem[] = [
  {
    id: "ev-private-room",
    url: "https://example.invalid/placeholder",
    platform: "messenger",
    location: "invite-only private room claim",
    posterId: "alias-only",
    foundAt: "2026-05-31T09:00:00+09:00",
    capturedByUser: true,
    status: "DISCOVERED",
    notes: "Victim received a threat mentioning a Telegram private room and paid invite access.",
  },
  {
    id: "ev-reupload",
    url: "https://example.invalid/reupload",
    platform: "file board",
    location: "webhard repost mirror",
    posterId: "",
    foundAt: "2026-05-31T10:00:00+09:00",
    capturedByUser: true,
    status: "REAPPEARED",
    notes: "Search result cache and webhard reupload language appeared after takedown.",
  },
];

describe("digital crime route knowledge base", () => {
  it("keeps route intelligence as safe patterns instead of operational target links", () => {
    expect(DIGITAL_CRIME_ROUTE_PATTERNS.length).toBeGreaterThanOrEqual(8);
    expect(unsafeOperationalTargetMarkersInRouteKnowledge()).toEqual([]);
    expect(DIGITAL_CRIME_ROUTE_BOUNDARIES.join(" ")).toContain("must not be displayed as a browseable directory");
  });

  it("classifies public clues into route categories for faster official handoff", () => {
    const matches = detectDigitalCrimeRoutePatterns(evidence);
    const ids = matches.map((match) => match.id);

    expect(ids).toEqual(
      expect.arrayContaining(["encrypted-private-room", "search-cache-archive", "p2p-webhard-reupload"]),
    );
    expect(matches.find((match) => match.id === "encrypted-private-room")?.accessLevel).toBe("AUTHORIZED_INTEL_ONLY");
    expect(matches.find((match) => match.id === "p2p-webhard-reupload")?.doNotDo.join(" ")).toContain("Do not download");
  });
});
