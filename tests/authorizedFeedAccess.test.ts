import { describe, expect, it } from "vitest";
import {
  authorizedFeedAccessBoundaryText,
  authorizedFeedSessionStatus,
  canUseAuthorizedFeedCapability,
  openAuthorizedFeedOperatorSession,
  refreshAuthorizedFeedOperatorSession,
} from "@/lib/authorizedFeedAccess";

describe("authorized feed operator access", () => {
  it("opens a short local operator session with explicit limitations", () => {
    const session = openAuthorizedFeedOperatorSession("authorized feed passphrase", 1_000);

    expect(session.role).toBe("AUTHORIZED_OPERATOR");
    expect(session.expiresAt).toBeGreaterThan(session.openedAt);
    expect(session.capabilityIds).toContain("AUTHORIZED_FEED_IMPORT");
    expect(session.limitations.join("\n")).toContain("원문 URL");
    expect(authorizedFeedAccessBoundaryText()).toContain("조직 인증");
    expect(canUseAuthorizedFeedCapability(session, "AUTHORIZED_FEED_IMPORT", 1_001)).toBe(true);
    expect(authorizedFeedSessionStatus(session, 1_001)).toContain("열림");
  });

  it("rejects weak confirmation text and expired sessions", () => {
    expect(() => openAuthorizedFeedOperatorSession("short")).toThrow("16자 이상");

    const session = openAuthorizedFeedOperatorSession("authorized feed passphrase", 1_000);
    expect(canUseAuthorizedFeedCapability(session, "AUTHORIZED_FEED_IMPORT", session.expiresAt + 1)).toBe(false);
    expect(authorizedFeedSessionStatus(session, session.expiresAt + 1)).toContain("만료");
  });

  it("refreshes activity without granting new capabilities", () => {
    const session = openAuthorizedFeedOperatorSession("authorized feed passphrase", 1_000);
    const refreshed = refreshAuthorizedFeedOperatorSession(session, 2_000);

    expect(refreshed.lastActivityAt).toBe(2_000);
    expect(refreshed.capabilityIds).toEqual(session.capabilityIds);
    expect(refreshed.expiresAt).toBeGreaterThan(session.expiresAt);
  });
});
