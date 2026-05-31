import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstitutionAccountAdminPanel } from "@/components/InstitutionAccountAdminPanel";

const session = {
  sessionId: "srv-session-ui",
  organizationId: "org-support-center-ui",
  organizationName: "Authorized Support Center",
  subjectId: "operator:caseworker-ui",
  role: "VICTIM_SUPPORT_CASEWORKER",
  assuranceLevel: "SERVER_SESSION",
  issuedAt: "2026-01-01T00:00:00.000Z",
  authenticatedAt: "2026-01-01T00:05:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
  capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "REDACTED_CASE_REVIEW", "OFFICIAL_PACKET_EXPORT"],
  evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
  limitations: ["비식별 사건 검토", "공식 제출 패킷 준비"],
};

describe("InstitutionAccountAdminPanel", () => {
  it("reviews institution account sessions and enables a report export", async () => {
    render(<InstitutionAccountAdminPanel />);

    fireEvent.change(screen.getByPlaceholderText(/srv-session-001/), {
      target: { value: JSON.stringify({ sessions: [session] }) },
    });
    fireEvent.click(screen.getByText("계정 세션 검토"));

    await waitFor(() => expect(screen.getByText("운영 가능 1건")).toBeInTheDocument());
    expect(screen.getAllByText(/operator:caseworker-ui/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("리포트 저장")).not.toBeDisabled();
  });

  it("shows validation failures for unsafe account identifiers", async () => {
    render(<InstitutionAccountAdminPanel />);

    fireEvent.change(screen.getByPlaceholderText(/srv-session-001/), {
      target: { value: JSON.stringify({ sessions: [{ ...session, subjectId: "caseworker@example.invalid" }] }) },
    });
    fireEvent.click(screen.getByText("계정 세션 검토"));

    await waitFor(() => expect(screen.getByText("검토 필요 1건")).toBeInTheDocument());
    expect(screen.getByText(/오류 1건/)).toBeInTheDocument();
  });
});
