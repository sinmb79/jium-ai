import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InstitutionAccountAdminPanel } from "@/components/InstitutionAccountAdminPanel";
import type { PublicInstitutionAccountView } from "@/lib/institutionAccountRegistry";

const session = {
  sessionId: "srv-session-ui",
  organizationId: "org-support-center-ui",
  organizationName: "공인 피해자 지원기관",
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

const account: PublicInstitutionAccountView = {
  accountId: "iacct-0000ABCD",
  organizationId: "org-support-center-ui",
  organizationName: "공인 피해자 지원기관",
  subjectId: "operator:caseworker-ui",
  role: "VICTIM_SUPPORT_CASEWORKER",
  capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "REDACTED_CASE_REVIEW", "OFFICIAL_PACKET_EXPORT"],
  evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
  status: "ACTIVE",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InstitutionAccountAdminPanel", () => {
  it("reviews institution account sessions and enables a report export", async () => {
    render(<InstitutionAccountAdminPanel />);

    fireEvent.change(screen.getByPlaceholderText(/srv-session-001/), {
      target: { value: JSON.stringify({ sessions: [session] }) },
    });
    fireEvent.click(screen.getByText("세션 검토"));

    await waitFor(() => expect(screen.getByText("운영 가능 1건")).toBeInTheDocument());
    expect(screen.getAllByText(/operator:caseworker-ui/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("리포트 저장")).not.toBeDisabled();
  });

  it("shows validation failures for unsafe account identifiers", async () => {
    render(<InstitutionAccountAdminPanel />);

    fireEvent.change(screen.getByPlaceholderText(/srv-session-001/), {
      target: { value: JSON.stringify({ sessions: [{ ...session, subjectId: "caseworker@example.invalid" }] }) },
    });
    fireEvent.click(screen.getByText("세션 검토"));

    await waitFor(() => expect(screen.getByText("검토 필요 1건")).toBeInTheDocument());
    expect(screen.getByText(/오류 1건/)).toBeInTheDocument();
  });

  it("lists server-provisioned institution accounts with protected request headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      jsonResponse({
        ok: true,
        registryVersion: "jium-institution-account-registry-v1",
        updatedAt: "2026-06-01T00:00:00.000Z",
        accounts: [account],
      }),
    );

    render(<InstitutionAccountAdminPanel />);
    fireEvent.click(screen.getByText("서버 목록 조회"));

    await waitFor(() => expect(screen.getByText("서버 계정 1건을 불러왔습니다.")).toBeInTheDocument());
    expect(screen.getByText(/공인 피해자 지원기관/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/institution/accounts",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ action: "LIST" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-jium-institution-account-admin": "1",
        }),
      }),
    );
  });

  it("explains when the server account route is not materialized", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response("<!doctype html>not found", { status: 404 })));

    render(<InstitutionAccountAdminPanel />);
    fireEvent.click(screen.getByText("서버 목록 조회"));

    await waitFor(() => expect(screen.getByText(/서버 계정 Route가 없습니다/)).toBeInTheDocument());
  });

  it("provisions and revokes accounts through the server route", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => jsonResponse({ ok: true, account }))
      .mockImplementationOnce(() =>
        jsonResponse({
          ok: true,
          account: {
            ...account,
            status: "REVOKED",
            updatedAt: "2026-06-01T01:00:00.000Z",
            revokedAt: "2026-06-01T01:00:00.000Z",
            revokedReasonCode: "offboarding",
          },
        }),
      );

    render(<InstitutionAccountAdminPanel />);

    fireEvent.change(screen.getByLabelText("기관 ID"), { target: { value: "org-support-center-ui" } });
    fireEvent.change(screen.getByLabelText("기관명"), { target: { value: "공인 피해자 지원기관" } });
    fireEvent.change(screen.getByLabelText("담당자 가명 ID"), { target: { value: "operator:caseworker-ui" } });
    fireEvent.click(screen.getByText("계정 발급"));

    await waitFor(() => expect(screen.getByText("operator:caseworker-ui 계정을 발급했습니다.")).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      action: "PROVISION",
      account: {
        organizationId: "org-support-center-ui",
        subjectId: "operator:caseworker-ui",
        role: "VICTIM_SUPPORT_CASEWORKER",
      },
    });

    fireEvent.click(screen.getByText("계정 해지"));

    await waitFor(() => expect(screen.getByText("operator:caseworker-ui 계정을 해지했습니다.")).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      action: "REVOKE",
      revocation: {
        accountId: "iacct-0000ABCD",
        reasonCode: "offboarding",
      },
    });
    expect(screen.getByText("해지")).toBeInTheDocument();
  });
});
