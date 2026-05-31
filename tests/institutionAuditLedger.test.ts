import { describe, expect, it } from "vitest";
import {
  appendInstitutionAuditLedgerRecord,
  createInstitutionAuditLedgerSink,
  INSTITUTION_AUDIT_LEDGER_GENESIS_DIGEST,
  type InstitutionAuditLedgerRecord,
  verifyInstitutionAuditLedger,
} from "@/lib/institutionAuditLedger";
import { createInstitutionAuditEvent } from "@/lib/institutionAuditLog";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  bytesToBase64Url,
  type TrustedAuthorizedFeedKey,
} from "@/lib/authorizedFeedSignature";
import {
  SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION,
  authorizedOperatorCredentialSigningPayload,
  type SignedAuthorizedOperatorCredential,
  type SignedAuthorizedOperatorCredentialPayload,
} from "@/lib/authorizedOperatorCredential";
import {
  handleInstitutionCredentialLoginRequest,
  INSTITUTION_LOGIN_CSRF_HEADER,
  INSTITUTION_LOGIN_CSRF_VALUE,
} from "@/lib/institutionLoginHttp";
import { readInstitutionSessionTokenFromCookie } from "@/lib/institutionSessionCookie";
import type { InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";

const now = Date.parse("2026-05-31T04:00:00.000Z");
const origin = "https://agency.example";
const tokenKey: InstitutionSessionTokenKey = {
  keyId: "server-session-key-2026-05",
  secret: "0123456789abcdef0123456789abcdef",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
};

function auditEvent(sequence: number) {
  return createInstitutionAuditEvent(
    {
      eventType: sequence === 1 ? "INSTITUTION_LOGIN_SUCCESS" : "INSTITUTION_SESSION_VERIFIED",
      outcome: "SUCCESS",
      requestId: `req-ledger-${sequence}`,
      originClassification: "ALLOWED",
      organizationName: "Authorized Support Center",
      subjectId: "operator:caseworker-001",
      role: "PLATFORM_TRUST_SAFETY",
      capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY"],
      evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
      sessionExpiresAt: "2026-05-31T05:00:00.000Z",
    },
    now + sequence,
  );
}

async function generateTrustedKey(): Promise<{ privateKey: CryptoKey; trustedKey: TrustedAuthorizedFeedKey }> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  return {
    privateKey: pair.privateKey,
    trustedKey: {
      keyId: "partner-login-key-2026-05",
      issuerName: "Authorized Support Center",
      algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      publicKeyJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2027-01-01T00:00:00.000Z",
    },
  };
}

async function signCredential(privateKey: CryptoKey): Promise<SignedAuthorizedOperatorCredential> {
  const envelope: SignedAuthorizedOperatorCredentialPayload = {
    version: SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION,
    keyId: "partner-login-key-2026-05",
    signedAt: "2026-05-31T00:00:01.000Z",
    credential: {
      credentialId: "cred-ledger-login-001",
      subjectId: "operator:caseworker-001",
      issuerName: "Authorized Support Center",
      issuedAt: "2026-05-31T00:00:00.000Z",
      expiresAt: "2026-05-31T05:00:00.000Z",
      capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY"],
      limitations: ["redacted restricted-field processing", "official-agency linkage only"],
    },
  };
  const signature = await crypto.subtle.sign(
    { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
    privateKey,
    new TextEncoder().encode(authorizedOperatorCredentialSigningPayload(envelope)),
  );
  return { ...envelope, signature: bytesToBase64Url(signature) };
}

describe("institution audit ledger", () => {
  it("chains privacy-minimized audit events with SHA-256 digests", async () => {
    const first = await appendInstitutionAuditLedgerRecord([], auditEvent(1), now);
    const second = await appendInstitutionAuditLedgerRecord([first], auditEvent(2), now + 1);
    const verification = await verifyInstitutionAuditLedger([first, second]);

    expect(first.sequence).toBe(1);
    expect(first.previousRecordDigest).toBe(INSTITUTION_AUDIT_LEDGER_GENESIS_DIGEST);
    expect(second.previousRecordDigest).toBe(first.recordDigest);
    expect(first.eventDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(second.recordDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(verification.valid).toBe(true);
    expect(verification.recordCount).toBe(2);
    expect(JSON.stringify([first, second])).not.toContain("header.payload.signature");
  });

  it("detects tampering and broken chain links", async () => {
    const first = await appendInstitutionAuditLedgerRecord([], auditEvent(1), now);
    const second = await appendInstitutionAuditLedgerRecord([first], auditEvent(2), now + 1);
    const tampered: InstitutionAuditLedgerRecord = {
      ...second,
      previousRecordDigest: "sha256-0000000000000000000000000000000000000000000000000000000000000000",
      event: {
        ...second.event,
        outcome: "DENIED",
      },
    };
    const verification = await verifyInstitutionAuditLedger([first, tampered]);

    expect(verification.valid).toBe(false);
    expect(verification.errors.join("\n")).toContain("does not link");
    expect(verification.errors.join("\n")).toContain("event digest mismatch");
    expect(verification.errors.join("\n")).toContain("record digest mismatch");
  });

  it("creates an audit ledger sink that can be attached to institution login handlers", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const credential = await signCredential(privateKey);
    const records: InstitutionAuditLedgerRecord[] = [];
    const response = await handleInstitutionCredentialLoginRequest(
      new Request("https://jium.example/api/institution/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          [INSTITUTION_LOGIN_CSRF_HEADER]: INSTITUTION_LOGIN_CSRF_VALUE,
        },
        body: JSON.stringify({ credential }),
      }),
      {
        trustedKeys: [trustedKey],
        tokenKey,
        secureCookies: true,
        allowedOrigins: [origin],
        auditSink: createInstitutionAuditLedgerSink(records, { now: () => now }),
        now,
      },
    );
    const token = readInstitutionSessionTokenFromCookie(response.headers.get("Set-Cookie"), true);
    const verification = await verifyInstitutionAuditLedger(records);

    expect(response.status).toBe(200);
    expect(records).toHaveLength(1);
    expect(records[0]?.event.eventType).toBe("INSTITUTION_LOGIN_SUCCESS");
    expect(verification.valid).toBe(true);
    expect(JSON.stringify(records)).not.toContain(token);
    expect(JSON.stringify(records)).not.toContain(origin);
  });
});
