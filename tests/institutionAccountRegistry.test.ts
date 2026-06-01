import { describe, expect, it } from "vitest";
import {
  emptyInstitutionAccountRegistry,
  institutionAccountId,
  provisionInstitutionAccount,
  revokeInstitutionAccount,
  validateInstitutionAccountRegistry,
} from "@/lib/institutionAccountRegistry";

const now = Date.parse("2026-06-01T01:00:00.000Z");

function approval(overrides: Record<string, unknown> = {}) {
  return {
    approvalRef: "APPROVAL-2026-001",
    approvedBySubjectId: "operator:supervisor-001",
    approvedAt: "2026-06-01T00:30:00.000Z",
    expiresAt: "2026-06-02T00:30:00.000Z",
    ...overrides,
  };
}

describe("institution account registry", () => {
  it("provisions pseudonymous institution accounts with role-bounded capabilities", () => {
    const { registry, account } = provisionInstitutionAccount(
      emptyInstitutionAccountRegistry(now),
      {
        organizationId: "org-support-center-001",
        organizationName: "Authorized Support Center",
        subjectId: "operator:caseworker-001",
        role: "VICTIM_SUPPORT_CASEWORKER",
        issuedBySubjectId: "operator:admin-001",
        approval: approval(),
      },
      now,
    );

    expect(account.accountId).toBe(institutionAccountId("org-support-center-001", "operator:caseworker-001"));
    expect(account.capabilityIds).toEqual(expect.arrayContaining(["AUTHORIZED_FEED_SUMMARY", "REDACTED_CASE_REVIEW", "OFFICIAL_PACKET_EXPORT"]));
    expect(account.capabilityIds).not.toContain("INSTITUTION_ACCOUNT_ADMIN");
    expect(validateInstitutionAccountRegistry(registry, now)).toEqual([]);
  });

  it("rejects duplicate active accounts and unsupported role escalation", () => {
    const first = provisionInstitutionAccount(
      emptyInstitutionAccountRegistry(now),
      {
        organizationId: "org-support-center-001",
        organizationName: "Authorized Support Center",
        subjectId: "operator:caseworker-001",
        role: "VICTIM_SUPPORT_CASEWORKER",
        issuedBySubjectId: "operator:admin-001",
        approval: approval({ approvalRef: "APPROVAL-2026-DUP" }),
      },
      now,
    );

    expect(() =>
      provisionInstitutionAccount(
        first.registry,
        {
          organizationId: "org-support-center-001",
          organizationName: "Authorized Support Center",
          subjectId: "operator:caseworker-001",
          role: "VICTIM_SUPPORT_CASEWORKER",
          approval: approval(),
        },
        now,
      ),
    ).toThrow("already exists");

    expect(() =>
      provisionInstitutionAccount(
        emptyInstitutionAccountRegistry(now),
        {
          organizationId: "org-support-center-001",
          organizationName: "Authorized Support Center",
          subjectId: "operator:caseworker-002",
          role: "VICTIM_SUPPORT_CASEWORKER",
          capabilityIds: ["INSTITUTION_ACCOUNT_ADMIN"],
          approval: approval(),
        },
        now,
      ),
    ).toThrow("cannot be provisioned");
  });

  it("revokes accounts without deleting the registry history", () => {
    const issued = provisionInstitutionAccount(
      emptyInstitutionAccountRegistry(now),
      {
        organizationId: "org-police-liaison-001",
        organizationName: "Police Liaison",
        subjectId: "operator:liaison-001",
        role: "LAW_ENFORCEMENT_LIAISON",
        issuedBySubjectId: "operator:admin-001",
        approval: approval({ approvalRef: "APPROVAL-2026-002" }),
      },
      now,
    );
    const revoked = revokeInstitutionAccount(
      issued.registry,
      {
        accountId: issued.account.accountId,
        revokedBySubjectId: "operator:admin-001",
        reasonCode: "offboarding",
        approval: approval({
          approvalRef: "REVOKE-2026-001",
          approvedBySubjectId: "operator:supervisor-002",
        }),
      },
      now + 1,
    );

    expect(revoked.account.status).toBe("REVOKED");
    expect(revoked.registry.accounts).toHaveLength(1);
    expect(revoked.registry.accounts[0]?.revokedReasonCode).toBe("offboarding");
    expect(validateInstitutionAccountRegistry(revoked.registry, now + 1)).toEqual([]);
  });

  it("rejects raw identifiers and unsafe notes", () => {
    expect(() =>
      provisionInstitutionAccount(
        emptyInstitutionAccountRegistry(now),
        {
          organizationId: "org-support-center-001",
          organizationName: "Authorized Support Center",
          subjectId: "caseworker@example.invalid",
          role: "VICTIM_SUPPORT_CASEWORKER",
          approval: approval(),
        },
        now,
      ),
    ).toThrow("pseudonymous");

    expect(() =>
      provisionInstitutionAccount(
        emptyInstitutionAccountRegistry(now),
        {
          organizationId: "org-support-center-001",
          organizationName: "Authorized Support Center",
          subjectId: "operator:caseworker-003",
          role: "VICTIM_SUPPORT_CASEWORKER",
          notes: ["see https://example.invalid/raw"],
          approval: approval(),
        },
        now,
      ),
    ).toThrow("notes must not contain raw");
  });

  it("requires approval records and rejects self-approved operations", () => {
    expect(() =>
      provisionInstitutionAccount(
        emptyInstitutionAccountRegistry(now),
        {
          organizationId: "org-support-center-001",
          organizationName: "Authorized Support Center",
          subjectId: "operator:caseworker-004",
          role: "VICTIM_SUPPORT_CASEWORKER",
          issuedBySubjectId: "operator:admin-001",
        } as never,
        now,
      ),
    ).toThrow("approval is required");

    expect(() =>
      provisionInstitutionAccount(
        emptyInstitutionAccountRegistry(now),
        {
          organizationId: "org-support-center-001",
          organizationName: "Authorized Support Center",
          subjectId: "operator:caseworker-005",
          role: "VICTIM_SUPPORT_CASEWORKER",
          issuedBySubjectId: "operator:admin-001",
          approval: approval({ approvedBySubjectId: "operator:admin-001" }),
        },
        now,
      ),
    ).toThrow("different operator");

    expect(() =>
      provisionInstitutionAccount(
        emptyInstitutionAccountRegistry(now),
        {
          organizationId: "org-support-center-001",
          organizationName: "Authorized Support Center",
          subjectId: "operator:caseworker-006",
          role: "VICTIM_SUPPORT_CASEWORKER",
          issuedBySubjectId: "operator:admin-001",
          approval: approval({
            approvedAt: "2026-06-01T01:10:01.000Z",
            approvedBySubjectId: "supervisor one",
          }),
        },
        now,
      ),
    ).toThrow("approvedBySubjectId must be a pseudonymous operator ID");
  });

  it("stores revocation approval records without exposing raw identifiers", () => {
    const issued = provisionInstitutionAccount(
      emptyInstitutionAccountRegistry(now),
      {
        organizationId: "org-support-center-001",
        organizationName: "Authorized Support Center",
        subjectId: "operator:caseworker-006",
        role: "VICTIM_SUPPORT_CASEWORKER",
        issuedBySubjectId: "operator:admin-001",
        approval: approval({ approvalRef: "APPROVAL-2026-006" }),
      },
      now,
    );

    expect(() =>
      revokeInstitutionAccount(
        issued.registry,
        {
          accountId: issued.account.accountId,
          revokedBySubjectId: "operator:admin-001",
          reasonCode: "offboarding",
          approval: approval({
            approvalRef: "https://example.invalid/raw",
            approvedBySubjectId: "operator:supervisor-003",
          }),
        },
        now + 1,
      ),
    ).toThrow("approvalRef must be a simple approval code");

    const revoked = revokeInstitutionAccount(
      issued.registry,
      {
        accountId: issued.account.accountId,
        revokedBySubjectId: "operator:admin-001",
        reasonCode: "offboarding",
        approval: approval({
          approvalRef: "REVOKE-2026-006",
          approvedBySubjectId: "operator:supervisor-003",
        }),
      },
      now + 1,
    );

    expect(revoked.account.revocationApproval?.approvalRef).toBe("REVOKE-2026-006");
    expect(validateInstitutionAccountRegistry(revoked.registry, now + 1)).toEqual([]);
  });

  it("stores elevated program-admin provisioning approvals with a separate scope", () => {
    const issued = provisionInstitutionAccount(
      emptyInstitutionAccountRegistry(now),
      {
        organizationId: "org-program-admin-001",
        organizationName: "Jium Program Office",
        subjectId: "operator:program-admin-001",
        role: "PROGRAM_ADMIN",
        capabilityIds: ["INSTITUTION_ACCOUNT_ADMIN"],
        issuedBySubjectId: "operator:admin-001",
        approval: approval({
          approvalRef: "ADMIN-APPROVAL-2026-001",
          approvedBySubjectId: "operator:board-reviewer-001",
        }),
      },
      now,
    );

    expect(issued.account.approval?.scope).toBe("PROGRAM_ADMIN_PROVISION");
    expect(issued.account.capabilityIds).toContain("INSTITUTION_ACCOUNT_ADMIN");
    expect(validateInstitutionAccountRegistry(issued.registry, now)).toEqual([]);
  });
});
