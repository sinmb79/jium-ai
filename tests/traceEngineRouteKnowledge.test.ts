import { describe, expect, it } from "vitest";
import { buildTraceAnalysis } from "@/lib/traceEngine";
import type { CaseInput } from "@/lib/types";

const routeInput: CaseInput = {
  situation: "Digital sex crime route tracing demo",
  title: "Safe route knowledge demo",
  description: "Victim wants to record visible clues and submit an official handoff packet.",
  targetUrl: "https://example.invalid/post",
  platform: "file board",
  keywords: "alias-only",
  evidenceItems: [
    {
      id: "route-1",
      url: "https://example.invalid/private-room-claim",
      platform: "messenger",
      location: "invite-only room claim",
      posterId: "alias-only",
      foundAt: "2026-05-31T09:00:00+09:00",
      capturedByUser: true,
      submissionTarget: "ECRM",
      status: "DISCOVERED",
      notes: "Threat mentions Telegram private room and paid invite access.",
    },
    {
      id: "route-2",
      url: "https://example.invalid/repost",
      platform: "file board",
      location: "webhard mirror",
      posterId: "",
      foundAt: "2026-05-31T11:00:00+09:00",
      capturedByUser: true,
      submissionTarget: "D4U",
      status: "REAPPEARED",
      notes: "Search result cache and webhard reupload language appeared after takedown.",
    },
  ],
  exposedInfo: ["sexual image/video"],
  urgent: true,
  helperMode: "self",
};

describe("trace engine route knowledge", () => {
  it("adds route knowledge signals to the tracing graph", () => {
    const analysis = buildTraceAnalysis(routeInput);

    expect(analysis.learningSignals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(["route-encrypted-private-room", "route-search-cache-archive", "route-p2p-webhard-reupload"]),
    );
    expect(analysis.nodes.some((node) => node.id.includes("route-encrypted-private-room"))).toBe(true);
    expect(analysis.boundaries.join(" ")).toContain("must not be displayed as a browseable directory");
  });
});
