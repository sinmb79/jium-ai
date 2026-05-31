import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstitutionAuditLedgerPanel } from "@/components/InstitutionAuditLedgerPanel";
import { appendInstitutionAuditLedgerRecord } from "@/lib/institutionAuditLedger";
import { createInstitutionAuditEvent } from "@/lib/institutionAuditLog";

const now = Date.parse("2026-06-01T01:00:00.000Z");

function event() {
  return createInstitutionAuditEvent(
    {
      eventType: "INSTITUTION_LOGIN_SUCCESS",
      outcome: "SUCCESS",
      requestId: "req-ui-ledger-1",
      originClassification: "ALLOWED",
      organizationName: "Authorized Support Center",
      subjectId: "operator:auditor-ui",
      role: "PLATFORM_TRUST_SAFETY",
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY"],
      evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    },
    now,
  );
}

describe("InstitutionAuditLedgerPanel", () => {
  it("verifies a pasted audit ledger and renders a safe summary", async () => {
    const record = await appendInstitutionAuditLedgerRecord([], event(), now);
    render(<InstitutionAuditLedgerPanel />);

    fireEvent.change(screen.getByPlaceholderText(/jium-institution-audit-ledger-v1/), {
      target: { value: JSON.stringify(record) },
    });
    fireEvent.click(screen.getByText("원장 검증"));

    await waitFor(() => expect(screen.getByText("체인 정상")).toBeInTheDocument());
    expect(screen.getByText("기록 1건")).toBeInTheDocument();
    expect(screen.getByText(/INSTITUTION_LOGIN_SUCCESS: 1건/)).toBeInTheDocument();
    expect(screen.queryByText(/header\.payload\.signature/)).not.toBeInTheDocument();
    expect(screen.queryByText(/https:\/\/agency\.example/)).not.toBeInTheDocument();
  });

  it("shows parse failures", async () => {
    render(<InstitutionAuditLedgerPanel />);

    fireEvent.change(screen.getByPlaceholderText(/jium-institution-audit-ledger-v1/), {
      target: { value: "{bad-json}" },
    });
    fireEvent.click(screen.getByText("원장 검증"));

    await waitFor(() => expect(screen.getByText("확인 필요")).toBeInTheDocument());
    expect(screen.getByText(/line 1 is not valid JSON/)).toBeInTheDocument();
  });
});
