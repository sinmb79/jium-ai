import { describe, expect, it } from "vitest";
import { canUseAuthorizedFeedCapability } from "@/lib/authorizedFeedAccess";
import {
  canUseInstitutionCapability,
  institutionSessionToAuthorizedFeedOperatorSession,
  requireInstitutionCapability,
  validateInstitutionAccountSession,
  type InstitutionAccountSession,
} from "@/lib/institutionAuth";

const now = Date.parse("2026-05-31T01:00:00.000Z");

function session(overrides: Partial<InstitutionAccountSession> = {}): InstitutionAccountSession {
  return {
    sessionId: "srv-session-001",
    organizationId: "org-support-center-001",
    organizationName: "Authorized Support Center",
    subjectId: "operator:caseworker-001",
    role: "PLATFORM_TRUST_SAFETY",
    assuranceLevel: "SERVER_SESSION_MFA",
    issuedAt: "2026-05-31T00:00:00.000Z",
    authenticatedAt: "2026-05-31T00:05:00.000Z",
    expiresAt: "2026-05-31T03:00:00.000Z",
    mfaVerifiedAt: "2026-05-31T00:06:00.000Z",
    capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY", "HANDOFF_STATUS_UPDATE"],
    evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    limitations: ["비식별 제한 피드 처리", "배정 사건의 비식별 제출자료 검토"],
    ...overrides,
  };
}

describe("institution account auth and RBAC", () => {
  it("validates a server institution session and converts feed capabilities into an operator session", () => {
    const validSession = session();
    const validation = validateInstitutionAccountSession(validSession, now);
    const feedSession = institutionSessionToAuthorizedFeedOperatorSession(validSession, now);

    expect(validation).toEqual({ valid: true, errors: [] });
    expect(canUseInstitutionCapability(validSession, "AUTHORIZED_FEED_IMPORT", now)).toBe(true);
    expect(feedSession.identity?.issuerName).toBe("Authorized Support Center");
    expect(feedSession.identity?.keyId).toBe("server-session");
    expect(canUseAuthorizedFeedCapability(feedSession, "AUTHORIZED_FEED_IMPORT", now + 1)).toBe(true);
    expect(feedSession.expiresAt).toBeLessThanOrEqual(now + 10 * 60 * 1000);
  });

  it("blocks role escalation outside the institution role matrix", () => {
    const invalid = session({
      role: "VICTIM_SUPPORT_CASEWORKER",
      capabilityIds: ["AUTHORIZED_FEED_IMPORT", "REDACTED_CASE_REVIEW"],
    });
    const validation = validateInstitutionAccountSession(invalid, now);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join("\n")).toContain("VICTIM_SUPPORT_CASEWORKER cannot use AUTHORIZED_FEED_IMPORT");
    expect(() => requireInstitutionCapability(invalid, "AUTHORIZED_FEED_IMPORT", now)).toThrow("cannot use");
  });

  it("requires MFA assurance for trusted key review", () => {
    const withoutMfa = session({
      role: "PROGRAM_ADMIN",
      assuranceLevel: "SERVER_SESSION",
      mfaVerifiedAt: undefined,
      capabilityIds: ["TRUSTED_KEY_REVIEW", "AUTHORIZED_FEED_SUMMARY"],
    });
    const validation = validateInstitutionAccountSession(withoutMfa, now);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join("\n")).toContain("TRUSTED_KEY_REVIEW requires SERVER_SESSION_MFA");
    expect(validation.errors.join("\n")).toContain("requires mfaVerifiedAt");
  });

  it("requires program admin MFA for audit ledger review", () => {
    const valid = session({
      role: "PROGRAM_ADMIN",
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "INSTITUTION_AUDIT_LEDGER_REVIEW"],
    });
    const wrongRole = session({
      role: "PLATFORM_TRUST_SAFETY",
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "INSTITUTION_AUDIT_LEDGER_REVIEW"],
    });

    expect(validateInstitutionAccountSession(valid, now).valid).toBe(true);
    expect(canUseInstitutionCapability(valid, "INSTITUTION_AUDIT_LEDGER_REVIEW", now)).toBe(true);
    expect(validateInstitutionAccountSession(wrongRole, now).errors.join("\n")).toContain(
      "PLATFORM_TRUST_SAFETY cannot use INSTITUTION_AUDIT_LEDGER_REVIEW",
    );
  });

  it("rejects raw account identifiers and expired sessions", () => {
    const raw = validateInstitutionAccountSession(session({ subjectId: "caseworker@example.invalid" }), now);
    const expired = validateInstitutionAccountSession(session({ expiresAt: "2026-05-01T00:00:00.000Z" }), now);

    expect(raw.valid).toBe(false);
    expect(raw.errors.join("\n")).toContain("pseudonymous");
    expect(expired.valid).toBe(false);
    expect(expired.errors.join("\n")).toContain("expired");
  });

  it("does not create a feed operator session when no feed capability is present", () => {
    const noFeed = session({
      role: "VICTIM_SUPPORT_CASEWORKER",
      capabilityIds: ["REDACTED_CASE_REVIEW", "OFFICIAL_PACKET_EXPORT"],
    });

    expect(validateInstitutionAccountSession(noFeed, now).valid).toBe(true);
    expect(() => institutionSessionToAuthorizedFeedOperatorSession(noFeed, now)).toThrow("does not include authorized feed capabilities");
  });
});
