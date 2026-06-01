import { describe, expect, it } from "vitest";
import {
  classifyInstitutionRequestOrigin,
  createInstitutionAuditEvent,
  institutionAuditContainsUnsafeMarker,
  safeInstitutionRequestId,
} from "@/lib/institutionAuditLog";

const now = Date.parse("2026-05-31T03:00:00.000Z");

describe("institution audit log safety", () => {
  it("creates a privacy-minimized institution audit event", () => {
    const event = createInstitutionAuditEvent(
      {
        eventType: "INSTITUTION_LOGIN_SUCCESS",
        outcome: "SUCCESS",
        requestId: "req-login-001",
        originClassification: "ALLOWED",
        organizationName: "Authorized Support Center",
        subjectId: "operator:caseworker-001",
        role: "PLATFORM_TRUST_SAFETY",
        accountId: "iacct-1234ABCD",
        approvalRef: "APPROVAL-2026-001",
        approvalScope: "PROVISION",
        targetRole: "VICTIM_SUPPORT_CASEWORKER",
        targetAccountStatus: "ACTIVE",
        capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY"],
        evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
        sessionExpiresAt: "2026-05-31T04:00:00.000Z",
      },
      now,
    );

    expect(event.id).toContain("institution-audit-");
    expect(event.occurredAt).toBe("2026-05-31T03:00:00.000Z");
    expect(event.approvalRef).toBe("APPROVAL-2026-001");
    expect(event.targetRole).toBe("VICTIM_SUPPORT_CASEWORKER");
    expect(event.dataMinimization.join(" ")).toContain("No server session token");
    expect(JSON.stringify(event)).not.toContain("header.payload.signature");
  });

  it("rejects raw operational indicators in audit events", () => {
    expect(() =>
      createInstitutionAuditEvent(
        {
          eventType: "INSTITUTION_LOGIN_DENIED",
          outcome: "DENIED",
          reasonCode: "INVALID",
          requestId: "req-raw-001",
          originClassification: "REJECTED",
          subjectId: "https://unsafe.example/user",
        },
        now,
      ),
    ).toThrow("unsafe raw indicators");

    expect(() =>
      createInstitutionAuditEvent(
        {
          eventType: "INSTITUTION_ACCOUNT_PROVISIONED",
          outcome: "SUCCESS",
          requestId: "req-account-raw-001",
          originClassification: "ALLOWED",
          accountId: "iacct-1234ABCD",
          approvalRef: "https://unsafe.example/approval",
        },
        now,
      ),
    ).toThrow("approvalRef must be a simple pseudonymous reference");

    expect(institutionAuditContainsUnsafeMarker({ value: "010-1234-5678" })).toContain("phone-like-number");
  });

  it("classifies request origins without storing the origin URL", () => {
    expect(classifyInstitutionRequestOrigin("https://agency.example", ["https://agency.example"])).toBe("ALLOWED");
    expect(classifyInstitutionRequestOrigin("https://evil.example", ["https://agency.example"])).toBe("REJECTED");
    expect(classifyInstitutionRequestOrigin(null, ["https://agency.example"])).toBe("MISSING");
    expect(classifyInstitutionRequestOrigin("https://agency.example", [])).toBe("NOT_CONFIGURED");
  });

  it("sanitizes unsafe request identifiers", () => {
    expect(safeInstitutionRequestId("req.safe-001", now)).toBe("req.safe-001");
    expect(safeInstitutionRequestId("https://unsafe.example/request", now)).toContain(`req-${now}-`);
  });
});
