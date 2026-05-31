import { describe, expect, it } from "vitest";
import { appendInstitutionAuditLedgerRecord, type InstitutionAuditLedgerRecord } from "@/lib/institutionAuditLedger";
import { createInstitutionAuditEvent } from "@/lib/institutionAuditLog";
import {
  buildInstitutionAuditLedgerReport,
  formatInstitutionAuditLedgerReport,
  parseInstitutionAuditLedgerText,
} from "@/lib/institutionAuditLedgerReport";

const now = Date.parse("2026-06-01T00:00:00.000Z");

function event(index: number) {
  return createInstitutionAuditEvent(
    {
      eventType: index === 1 ? "INSTITUTION_LOGIN_SUCCESS" : "INSTITUTION_LOGOUT",
      outcome: "SUCCESS",
      requestId: `req-report-${index}`,
      originClassification: "ALLOWED",
      organizationName: "Authorized Support Center",
      subjectId: "operator:auditor-001",
      role: "PLATFORM_TRUST_SAFETY",
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY"],
      evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    },
    now + index,
  );
}

async function records() {
  const first = await appendInstitutionAuditLedgerRecord([], event(1), now);
  const second = await appendInstitutionAuditLedgerRecord([first], event(2), now + 1);
  return [first, second];
}

describe("institution audit ledger report", () => {
  it("parses JSONL and builds a verified redacted report", async () => {
    const ledger = await records();
    const text = ledger.map((record) => JSON.stringify(record)).join("\n");
    const report = await buildInstitutionAuditLedgerReport(text);
    const markdown = formatInstitutionAuditLedgerReport(report);

    expect(report.verification.valid).toBe(true);
    expect(report.verification.recordCount).toBe(2);
    expect(report.byEventType.INSTITUTION_LOGIN_SUCCESS).toBe(1);
    expect(report.byOutcome.SUCCESS).toBe(2);
    expect(report.byOrganization["Authorized Support Center"]).toBe(2);
    expect(report.recentRecords[0]?.sequence).toBe(2);
    expect(markdown).toContain("기관 인증 감사 원장 검증 리포트");
    expect(markdown).not.toContain("header.payload.signature");
  });

  it("accepts JSON arrays as an operator export format", async () => {
    const ledger = await records();
    const parsed = parseInstitutionAuditLedgerText(JSON.stringify(ledger));

    expect(parsed.records).toHaveLength(2);
    expect(parsed.errors).toEqual([]);
  });

  it("surfaces parse errors without pretending the ledger is valid", async () => {
    const report = await buildInstitutionAuditLedgerReport("{not-json}");

    expect(report.verification.valid).toBe(false);
    expect(report.verification.errors.join("\n")).toContain("line 1 is not valid JSON");
  });

  it("reports tampered chains", async () => {
    const ledger = await records();
    const tampered: InstitutionAuditLedgerRecord = {
      ...ledger[1]!,
      event: {
        ...ledger[1]!.event,
        outcome: "DENIED",
      },
    };
    const report = await buildInstitutionAuditLedgerReport([ledger[0], tampered].map((record) => JSON.stringify(record)).join("\n"));

    expect(report.verification.valid).toBe(false);
    expect(report.verification.errors.join("\n")).toContain("event digest mismatch");
    expect(report.verification.errors.join("\n")).toContain("record digest mismatch");
  });
});
