import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToBase64Url, canonicalizeJson } from "@/lib/authorizedFeedSignature";
import {
  createInstitutionSessionToken,
  verifyInstitutionSessionToken,
  type InstitutionSessionTokenKey,
} from "@/lib/institutionSessionToken";
import type { InstitutionAccountSession } from "@/lib/institutionAuth";

const now = Date.parse("2026-05-31T01:00:00.000Z");
const strongKey: InstitutionSessionTokenKey = {
  keyId: "server-session-key-2026-05",
  secret: "0123456789abcdef0123456789abcdef",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
};

function session(overrides: Partial<InstitutionAccountSession> = {}): InstitutionAccountSession {
  return {
    sessionId: "srv-session-token-001",
    organizationId: "org-support-center-001",
    organizationName: "Authorized Support Center",
    subjectId: "operator:caseworker-001",
    role: "PLATFORM_TRUST_SAFETY",
    assuranceLevel: "SERVER_SESSION_MFA",
    issuedAt: "2026-05-31T00:00:00.000Z",
    authenticatedAt: "2026-05-31T00:05:00.000Z",
    expiresAt: "2026-05-31T03:00:00.000Z",
    mfaVerifiedAt: "2026-05-31T00:06:00.000Z",
    capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY", "HANDOFF_STATUS_UPDATE"],
    evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    limitations: ["비식별 제한 피드 처리", "배정 사건의 비식별 제출자료 검토"],
    ...overrides,
  };
}

function tamperPayload(token: string, nextSession: InstitutionAccountSession) {
  const parts = token.split(".");
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1]!)));
  payload.session = nextSession;
  return `${parts[0]}.${bytesToBase64Url(new TextEncoder().encode(canonicalizeJson(payload)))}.${parts[2]}`;
}

describe("institution session token", () => {
  it("issues and verifies a server institution session token", async () => {
    const token = await createInstitutionSessionToken(session(), strongKey, { tokenId: "ist-test-001", now });
    const verification = await verifyInstitutionSessionToken(token, [strongKey], now + 1);

    expect(verification.valid).toBe(true);
    expect(verification.session?.sessionId).toBe("srv-session-token-001");
    expect(verification.header?.keyId).toBe(strongKey.keyId);
    expect(token).not.toContain(strongKey.secret as string);
  });

  it("rejects tampered payloads", async () => {
    const token = await createInstitutionSessionToken(session(), strongKey, { tokenId: "ist-test-002", now });
    const tampered = tamperPayload(token, session({ capabilityIds: ["TRUSTED_KEY_REVIEW"], role: "PROGRAM_ADMIN" }));
    const verification = await verifyInstitutionSessionToken(tampered, [strongKey], now + 1);

    expect(verification.valid).toBe(false);
    expect(verification.errors.join("\n")).toContain("signature verification failed");
  });

  it("rejects weak, unknown, or inactive signing keys", async () => {
    await expect(
      createInstitutionSessionToken(session(), { keyId: "weak", secret: "too-short" }, { now }),
    ).rejects.toThrow("at least 32 bytes");

    const token = await createInstitutionSessionToken(session(), strongKey, { tokenId: "ist-test-003", now });
    const unknown = await verifyInstitutionSessionToken(token, [], now + 1);
    const inactive = await verifyInstitutionSessionToken(token, [{ ...strongKey, validUntil: "2026-01-01T00:00:00.000Z" }], now + 1);

    expect(unknown.valid).toBe(false);
    expect(unknown.errors.join("\n")).toContain("unknown or inactive");
    expect(inactive.valid).toBe(false);
    expect(inactive.errors.join("\n")).toContain("unknown or inactive");
  });

  it("rejects expired or local signed credential sessions", async () => {
    await expect(
      createInstitutionSessionToken(session({ expiresAt: "2026-05-01T00:00:00.000Z" }), strongKey, { now }),
    ).rejects.toThrow("expired");
    await expect(
      createInstitutionSessionToken(session({ assuranceLevel: "LOCAL_SIGNED_CREDENTIAL" }), strongKey, { now }),
    ).rejects.toThrow("LOCAL_SIGNED_CREDENTIAL");
  });
});
