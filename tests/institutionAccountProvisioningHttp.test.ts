import { describe, expect, it } from "vitest";
import {
  emptyInstitutionAccountRegistry,
  type InstitutionAccountRegistry,
} from "@/lib/institutionAccountRegistry";
import type { InstitutionAuditEvent } from "@/lib/institutionAuditLog";
import { handleInstitutionAccountAdminRequest, INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER, INSTITUTION_ACCOUNT_ADMIN_CSRF_VALUE } from "@/lib/institutionAccountProvisioningHttp";
import type { InstitutionAccountSession } from "@/lib/institutionAuth";
import { createInstitutionSessionToken, type InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";
import { INSTITUTION_SESSION_COOKIE_NAME } from "@/lib/institutionSessionCookie";

const now = Date.parse("2026-06-01T01:00:00.000Z");
const origin = "https://agency.example";
const tokenKey: InstitutionSessionTokenKey = {
  keyId: "server-session-key-2026-06",
  secret: "0123456789abcdef0123456789abcdef",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
};

function adminSession(overrides: Partial<InstitutionAccountSession> = {}): InstitutionAccountSession {
  return {
    sessionId: "srv-admin-session-001",
    organizationId: "org-program-admin",
    organizationName: "Jium Program Admin",
    subjectId: "operator:admin-001",
    role: "PROGRAM_ADMIN",
    assuranceLevel: "SERVER_SESSION_MFA",
    issuedAt: "2026-06-01T00:00:00.000Z",
    authenticatedAt: "2026-06-01T00:05:00.000Z",
    expiresAt: "2026-06-01T03:00:00.000Z",
    mfaVerifiedAt: "2026-06-01T00:06:00.000Z",
    capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "INSTITUTION_ACCOUNT_ADMIN", "INSTITUTION_AUDIT_LEDGER_REVIEW"],
    evidenceAccessScope: "OFFICIAL_REQUEST_ONLY",
    limitations: ["account registry administration only", "no raw victim indicators"],
    ...overrides,
  };
}

async function cookieFor(session: InstitutionAccountSession) {
  const token = await createInstitutionSessionToken(JSON.parse(JSON.stringify(session)) as InstitutionAccountSession, tokenKey, { tokenId: session.sessionId, now });
  return `${INSTITUTION_SESSION_COOKIE_NAME}=${token}`;
}

function memoryStore(registry: InstitutionAccountRegistry = emptyInstitutionAccountRegistry(now)) {
  let current = registry;
  return {
    read: async () => current,
    write: async (next: InstitutionAccountRegistry) => {
      current = next;
    },
    current: () => current,
  };
}

function accountRequest(body: unknown, cookie?: string, headers: HeadersInit = {}) {
  return new Request("https://jium.example/api/institution/accounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      [INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER]: INSTITUTION_ACCOUNT_ADMIN_CSRF_VALUE,
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("institution account provisioning HTTP handler", () => {
  it("provisions, lists, and revokes institution accounts through a PROGRAM_ADMIN MFA session", async () => {
    const store = memoryStore();
    const auditEvents: InstitutionAuditEvent[] = [];
    const cookie = await cookieFor(adminSession());
    const config = {
      tokenKeys: [tokenKey],
      secureCookies: true,
      allowedOrigins: [origin],
      accountStore: store,
      auditSink: (event: InstitutionAuditEvent) => {
        auditEvents.push(event);
      },
      now,
    };

    const provision = await handleInstitutionAccountAdminRequest(
      accountRequest(
        {
          action: "PROVISION",
          account: {
            organizationId: "org-support-center-001",
            organizationName: "Authorized Support Center",
            subjectId: "operator:caseworker-001",
            role: "VICTIM_SUPPORT_CASEWORKER",
          },
        },
        cookie,
      ),
      config,
    );
    const provisionBody = await provision.json();
    const list = await handleInstitutionAccountAdminRequest(accountRequest({ action: "LIST" }, cookie), config);
    const listBody = await list.json();
    const revoke = await handleInstitutionAccountAdminRequest(
      accountRequest({ action: "REVOKE", revocation: { accountId: provisionBody.account.accountId, reasonCode: "offboarding" } }, cookie),
      config,
    );
    const revokeBody = await revoke.json();

    expect(provision.status).toBe(200);
    expect(provisionBody.account.subjectId).toBe("operator:caseworker-001");
    expect(list.status).toBe(200);
    expect(listBody.accounts).toHaveLength(1);
    expect(revoke.status).toBe(200);
    expect(revokeBody.account.status).toBe("REVOKED");
    expect(store.current().accounts[0]?.revokedBySubjectId).toBe("operator:admin-001");
    expect(auditEvents.map((event) => event.eventType)).toEqual([
      "INSTITUTION_ACCOUNT_PROVISIONED",
      "INSTITUTION_ACCOUNT_LISTED",
      "INSTITUTION_ACCOUNT_REVOKED",
    ]);
    expect(JSON.stringify(auditEvents)).not.toContain(cookie);
    expect(JSON.stringify(auditEvents)).not.toContain(origin);
  });

  it("rejects requests without the account-admin session capability", async () => {
    const store = memoryStore();
    const auditEvents: InstitutionAuditEvent[] = [];
    const nonAdmin = adminSession({
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY"],
      role: "VICTIM_SUPPORT_CASEWORKER",
      assuranceLevel: "SERVER_SESSION",
      mfaVerifiedAt: undefined,
      evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    });
    const response = await handleInstitutionAccountAdminRequest(
      accountRequest({ action: "LIST" }, await cookieFor(nonAdmin)),
      {
        tokenKeys: [tokenKey],
        secureCookies: true,
        allowedOrigins: [origin],
        accountStore: store,
        auditSink: (event) => {
          auditEvents.push(event);
        },
        now,
      },
    );

    expect(response.status).toBe(403);
    expect((await response.json()).errorCode).toBe("INSTITUTION_ACCOUNT_ADMIN_NOT_ALLOWED");
    expect(auditEvents[0]?.eventType).toBe("INSTITUTION_ACCOUNT_ADMIN_DENIED");
  });

  it("applies method, csrf, origin, content-type, and body-size guards", async () => {
    const store = memoryStore();
    const cookie = await cookieFor(adminSession());
    const config = {
      tokenKeys: [tokenKey],
      secureCookies: true,
      allowedOrigins: [origin],
      accountStore: store,
      now,
    };
    const getResponse = await handleInstitutionAccountAdminRequest(new Request("https://jium.example/api/institution/accounts", { method: "GET" }), config);
    const missingCsrf = await handleInstitutionAccountAdminRequest(
      accountRequest({ action: "LIST" }, cookie, { [INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER]: "" }),
      config,
    );
    const wrongOrigin = await handleInstitutionAccountAdminRequest(accountRequest({ action: "LIST" }, cookie, { Origin: "https://evil.example" }), config);
    const wrongType = await handleInstitutionAccountAdminRequest(accountRequest("{}", cookie, { "Content-Type": "text/plain" }), config);
    const oversized = await handleInstitutionAccountAdminRequest(
      accountRequest({ action: "LIST", padding: "x".repeat(25 * 1024) }, cookie),
      config,
    );

    expect(getResponse.status).toBe(405);
    expect(missingCsrf.status).toBe(403);
    expect(wrongOrigin.status).toBe(403);
    expect(wrongType.status).toBe(415);
    expect(oversized.status).toBe(413);
  });

  it("rejects unsafe account payloads without persisting them", async () => {
    const store = memoryStore();
    const response = await handleInstitutionAccountAdminRequest(
      accountRequest(
        {
          action: "PROVISION",
          account: {
            organizationId: "org-support-center-001",
            organizationName: "Authorized Support Center",
            subjectId: "caseworker@example.invalid",
            role: "VICTIM_SUPPORT_CASEWORKER",
          },
        },
        await cookieFor(adminSession()),
      ),
      {
        tokenKeys: [tokenKey],
        secureCookies: true,
        allowedOrigins: [origin],
        accountStore: store,
        now,
      },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe("ACCOUNT_REGISTRY_OPERATION_FAILED");
    expect(store.current().accounts).toHaveLength(0);
  });
});
