import { describe, expect, it } from "vitest";
import { openAuthorizedFeedOperatorSession } from "@/lib/authorizedFeedAccess";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  bytesToBase64Url,
  type TrustedAuthorizedFeedKey,
} from "@/lib/authorizedFeedSignature";
import {
  SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION,
  authorizedOperatorCredentialSigningPayload,
  openAuthorizedFeedOperatorSessionFromCredential,
  verifyAuthorizedOperatorCredential,
  type AuthorizedOperatorCredential,
  type SignedAuthorizedOperatorCredential,
  type SignedAuthorizedOperatorCredentialPayload,
} from "@/lib/authorizedOperatorCredential";

const keyId = "authorized-operator-key-2026-05";
const now = Date.parse("2026-05-31T01:00:00.000Z");

function credential(overrides: Partial<AuthorizedOperatorCredential> = {}): AuthorizedOperatorCredential {
  return {
    credentialId: "cred-support-center-001",
    subjectId: "operator:caseworker-001",
    issuerName: "Authorized Support Center",
    issuedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-06-01T00:00:00.000Z",
    capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY", "AUTHORIZED_FEED_PURGE"],
    limitations: ["비식별 승인 피드 수입", "피해자 화면에는 집계만 표시", "공식기관 인계 목적"],
    ...overrides,
  };
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
      keyId,
      issuerName: "Authorized Support Center",
      algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      publicKeyJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2027-01-01T00:00:00.000Z",
    },
  };
}

async function signCredential(
  privateKey: CryptoKey,
  nextCredential: AuthorizedOperatorCredential = credential(),
): Promise<SignedAuthorizedOperatorCredential> {
  const envelope: SignedAuthorizedOperatorCredentialPayload = {
    version: SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION,
    keyId,
    signedAt: "2026-05-31T00:00:01.000Z",
    credential: nextCredential,
  };
  const signature = await crypto.subtle.sign(
    { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
    privateKey,
    new TextEncoder().encode(authorizedOperatorCredentialSigningPayload(envelope)),
  );

  return {
    ...envelope,
    signature: bytesToBase64Url(signature),
  };
}

describe("authorized operator credential", () => {
  it("verifies a signed credential and opens a bounded operator session", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signCredential(privateKey);

    const verification = await verifyAuthorizedOperatorCredential(signed, [trustedKey], now);
    const session = await openAuthorizedFeedOperatorSessionFromCredential(signed, [trustedKey], now);

    expect(verification).toEqual({ valid: true, errors: [] });
    expect(session.role).toBe("AUTHORIZED_OPERATOR");
    expect(session.identity?.subjectId).toBe("operator:caseworker-001");
    expect(session.identity?.issuerName).toBe("Authorized Support Center");
    expect(session.capabilityIds).toContain("AUTHORIZED_FEED_IMPORT");
    expect(session.expiresAt).toBeLessThanOrEqual(Date.parse(signed.credential.expiresAt));
    expect(session.limitations.join("\n")).toContain("서명 credential");
  });

  it("keeps the legacy local passphrase session available but without identity proof", () => {
    const session = openAuthorizedFeedOperatorSession("authorized feed passphrase", now);

    expect(session.identity).toBeUndefined();
    expect(session.limitations.join("\n")).toContain("조직 인증을 대신하지 않음");
  });

  it("rejects tampered credentials after signing", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signCredential(privateKey);
    const tampered: SignedAuthorizedOperatorCredential = {
      ...signed,
      credential: {
        ...signed.credential,
        capabilityIds: ["AUTHORIZED_FEED_IMPORT"],
      },
    };

    const verification = await verifyAuthorizedOperatorCredential(tampered, [trustedKey], now);

    expect(verification.valid).toBe(false);
    expect(verification.errors.join("\n")).toContain("operator credential signature verification failed");
  });

  it("rejects expired, raw, or unsupported credentials", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const expired = await signCredential(
      privateKey,
      credential({ expiresAt: "2026-05-01T00:00:00.000Z" }),
    );
    const rawSubject = await signCredential(privateKey, credential({ subjectId: "caseworker@example.invalid" }));
    const unsupported = await signCredential(
      privateKey,
      credential({ capabilityIds: ["AUTHORIZED_FEED_IMPORT", "DELETE_EVIDENCE" as never] }),
    );

    await expect(openAuthorizedFeedOperatorSessionFromCredential(expired, [trustedKey], now)).rejects.toThrow("expired");
    await expect(openAuthorizedFeedOperatorSessionFromCredential(rawSubject, [trustedKey], now)).rejects.toThrow("pseudonymous");
    await expect(openAuthorizedFeedOperatorSessionFromCredential(unsupported, [trustedKey], now)).rejects.toThrow("unsupported authorized feed capability");
  });
});
