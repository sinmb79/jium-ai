import { describe, expect, it } from "vitest";
import {
  emptyInstitutionAccountRegistry,
  institutionAccountId,
  provisionInstitutionAccount,
  revokeInstitutionAccount,
  validateInstitutionAccountRegistry,
} from "@/lib/institutionAccountRegistry";

const now = Date.parse("2026-06-01T01:00:00.000Z");

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
      },
      now,
    );
    const revoked = revokeInstitutionAccount(
      issued.registry,
      {
        accountId: issued.account.accountId,
        revokedBySubjectId: "operator:admin-001",
        reasonCode: "offboarding",
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
        },
        now,
      ),
    ).toThrow("notes must not contain raw");
  });
});
