import { describe, expect, it } from "vitest";
import {
  formatInstitutionAccountAdminReport,
  parseInstitutionAccountSessionsText,
  reviewInstitutionAccountSessions,
} from "@/lib/institutionAccountAdmin";
import type { InstitutionAccountSession } from "@/lib/institutionAuth";

const now = Date.parse("2026-06-01T00:00:00.000Z");

function session(overrides: Partial<InstitutionAccountSession> = {}): InstitutionAccountSession {
  return {
    sessionId: "srv-session-001",
    organizationId: "org-support-center-001",
    organizationName: "Authorized Support Center",
    subjectId: "operator:caseworker-001",
    role: "VICTIM_SUPPORT_CASEWORKER",
    assuranceLevel: "SERVER_SESSION",
    issuedAt: "2026-06-01T00:00:00.000Z",
    authenticatedAt: "2026-06-01T00:05:00.000Z",
    expiresAt: "2026-06-01T02:00:00.000Z",
    capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "REDACTED_CASE_REVIEW", "OFFICIAL_PACKET_EXPORT"],
    evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    limitations: ["비식별 사건 검토", "공식 제출 패킷 준비"],
    ...overrides,
  };
}

describe("institution account admin", () => {
  it("summarizes valid, expiring, expired, invalid, and high-risk sessions", () => {
    const report = reviewInstitutionAccountSessions(
      [
        session(),
        session({ sessionId: "expiring", subjectId: "operator:soon", expiresAt: "2026-06-01T00:20:00.000Z" }),
        session({ sessionId: "expired", subjectId: "operator:expired", expiresAt: "2026-05-31T23:00:00.000Z" }),
        session({
          sessionId: "admin",
          subjectId: "operator:admin",
          role: "PROGRAM_ADMIN",
          assuranceLevel: "SERVER_SESSION_MFA",
          mfaVerifiedAt: "2026-06-01T00:06:00.000Z",
          capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "TRUSTED_KEY_REVIEW", "INSTITUTION_AUDIT_LEDGER_REVIEW"],
          evidenceAccessScope: "OFFICIAL_REQUEST_ONLY",
        }),
        session({ sessionId: "raw", subjectId: "caseworker@example.invalid" }),
      ],
      { now, expiringWithinMinutes: 60 },
    );

    expect(report.total).toBe(5);
    expect(report.validCount).toBe(3);
    expect(report.expiringSoonCount).toBe(1);
    expect(report.expiredCount).toBe(1);
    expect(report.invalidCount).toBe(1);
    expect(report.highRiskAccountCount).toBe(1);
    expect(report.roleCounts.PROGRAM_ADMIN).toBe(1);
    expect(report.capabilityCounts.TRUSTED_KEY_REVIEW).toBe(1);
    expect(report.warnings.join("\n")).toContain("고위험 권한");
    expect(report.entries.find((entry) => entry.sessionId === "raw")?.errors.join("\n")).toContain("pseudonymous");
  });

  it("parses array and object session JSON and formats a report", () => {
    const parsedArray = parseInstitutionAccountSessionsText(JSON.stringify([session()]));
    const parsedObject = parseInstitutionAccountSessionsText(JSON.stringify({ sessions: [session({ sessionId: "object" })] }));
    const markdown = formatInstitutionAccountAdminReport(reviewInstitutionAccountSessions(parsedObject, { now }));

    expect(parsedArray).toHaveLength(1);
    expect(parsedObject[0]?.sessionId).toBe("object");
    expect(markdown).toContain("# 기관 계정 관리자 검토 리포트");
    expect(markdown).toContain("Authorized Support Center");
  });

  it("rejects unsupported registry JSON shapes", () => {
    expect(() => parseInstitutionAccountSessionsText(JSON.stringify({ accounts: [] }))).toThrow("sessions array");
  });
});
