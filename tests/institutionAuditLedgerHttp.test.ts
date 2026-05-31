import { describe, expect, it } from "vitest";
import { createInstitutionSessionToken, type InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";
import { serializeInstitutionSessionCookie } from "@/lib/institutionSessionCookie";
import { appendInstitutionAuditLedgerRecord, createInstitutionAuditLedgerSink, type InstitutionAuditLedgerRecord } from "@/lib/institutionAuditLedger";
import { createInstitutionAuditEvent } from "@/lib/institutionAuditLog";
import { handleInstitutionAuditLedgerSummaryRequest } from "@/lib/institutionAuditLedgerHttp";
import type { InstitutionAccountSession } from "@/lib/institutionAuth";

const now = Date.parse("2026-06-01T02:00:00.000Z");
const origin = "https://agency.example";
const tokenKey: InstitutionSessionTokenKey = {
  keyId: "audit-ledger-session-key",
  secret: "0123456789abcdef0123456789abcdef",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
};

function adminSession(overrides: Partial<InstitutionAccountSession> = {}): InstitutionAccountSession {
  return {
    sessionId: "srv-audit-admin-001",
    organizationId: "org-support-center",
    organizationName: "Authorized Support Center",
    subjectId: "operator:audit-admin-001",
    role: "PROGRAM_ADMIN",
    assuranceLevel: "SERVER_SESSION_MFA",
    issuedAt: "2026-06-01T01:00:00.000Z",
    authenticatedAt: "2026-06-01T01:05:00.000Z",
    expiresAt: "2026-06-01T03:00:00.000Z",
    mfaVerifiedAt: "2026-06-01T01:06:00.000Z",
    capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "INSTITUTION_AUDIT_LEDGER_REVIEW"],
    evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    limitations: ["기관 인증 감사 원장 검토", "원문 지표 조회 금지"],
    ...overrides,
  };
}

function auditEvent(index: number) {
  return createInstitutionAuditEvent(
    {
      eventType: index === 1 ? "INSTITUTION_LOGIN_SUCCESS" : "INSTITUTION_LOGOUT",
      outcome: "SUCCESS",
      requestId: `req-audit-http-${index}`,
      originClassification: "ALLOWED",
      organizationName: "Authorized Support Center",
      subjectId: "operator:caseworker-001",
      role: "PLATFORM_TRUST_SAFETY",
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY"],
      evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    },
    now + index,
  );
}

async function cookie(session: InstitutionAccountSession) {
  const token = await createInstitutionSessionToken(session, tokenKey, { now });
  return serializeInstitutionSessionCookie(token, { secure: true });
}

function request(cookieHeader?: string) {
  return new Request("https://jium.example/api/institution/audit-ledger", {
    headers: {
      Origin: origin,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
}

describe("institution audit ledger HTTP summary", () => {
  it("returns a redacted audit ledger report to an authorized institution session", async () => {
    const records: InstitutionAuditLedgerRecord[] = [];
    records.push(await appendInstitutionAuditLedgerRecord(records, auditEvent(1), now));
    records.push(await appendInstitutionAuditLedgerRecord(records, auditEvent(2), now + 1));
    const response = await handleInstitutionAuditLedgerSummaryRequest(request(await cookie(adminSession())), {
      tokenKeys: [tokenKey],
      secureCookies: true,
      allowedOrigins: [origin],
      readAuditRecords: async () => records,
      auditSink: createInstitutionAuditLedgerSink(records, { now: () => now + 2 }),
      now,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.report.verification.valid).toBe(true);
    expect(body.report.verification.recordCount).toBe(2);
    expect(body.report.recentRecords[0]).toMatchObject({ eventType: "INSTITUTION_LOGOUT", outcome: "SUCCESS" });
    expect(JSON.stringify(body)).not.toContain("header.payload.signature");
    expect(JSON.stringify(body)).not.toContain(origin);
    expect(records.at(-1)?.event.eventType).toBe("INSTITUTION_AUDIT_LEDGER_VIEWED");
  });

  it("rejects missing sessions and records a denied audit event", async () => {
    const records: InstitutionAuditLedgerRecord[] = [];
    const response = await handleInstitutionAuditLedgerSummaryRequest(request(), {
      tokenKeys: [tokenKey],
      secureCookies: true,
      allowedOrigins: [origin],
      readAuditRecords: async () => records,
      auditSink: createInstitutionAuditLedgerSink(records, { now: () => now }),
      now,
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errorCode).toBe("INSTITUTION_SESSION_REQUIRED");
    expect(records[0]?.event.eventType).toBe("INSTITUTION_AUDIT_LEDGER_VIEW_DENIED");
  });

  it("rejects sessions without audit ledger review capability", async () => {
    const response = await handleInstitutionAuditLedgerSummaryRequest(
      request(
        await cookie(
          adminSession({
            capabilityIds: ["AUTHORIZED_FEED_SUMMARY"],
          }),
        ),
      ),
      {
        tokenKeys: [tokenKey],
        secureCookies: true,
        allowedOrigins: [origin],
        readAuditRecords: async () => [],
        now,
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.errorCode).toBe("AUDIT_LEDGER_REVIEW_NOT_ALLOWED");
  });

  it("returns a controlled error when the audit store cannot be read", async () => {
    const response = await handleInstitutionAuditLedgerSummaryRequest(request(await cookie(adminSession())), {
      tokenKeys: [tokenKey],
      secureCookies: true,
      allowedOrigins: [origin],
      readAuditRecords: async () => {
        throw new Error("disk offline");
      },
      now,
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.errorCode).toBe("AUDIT_LEDGER_STORE_UNAVAILABLE");
  });
});
