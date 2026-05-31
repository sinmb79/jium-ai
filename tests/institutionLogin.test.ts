import { describe, expect, it } from "vitest";
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
  clearInstitutionSessionCookie,
  issueInstitutionSessionFromSignedCredential,
  verifyInstitutionSessionFromCookieToken,
} from "@/lib/institutionLogin";
import {
  INSTITUTION_SESSION_COOKIE_NAME,
  readInstitutionSessionTokenFromCookie,
} from "@/lib/institutionSessionCookie";
import type { InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";

const now = Date.parse("2026-05-31T01:00:00.000Z");
const tokenKey: InstitutionSessionTokenKey = {
  keyId: "server-session-key-2026-05",
  secret: "0123456789abcdef0123456789abcdef",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: "2027-01-01T00:00:00.000Z",
};

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
      credentialId: "cred-login-001",
      subjectId: "operator:caseworker-001",
      issuerName: "Authorized Support Center",
      issuedAt: "2026-05-31T00:00:00.000Z",
      expiresAt: "2026-05-31T03:00:00.000Z",
      capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY"],
      limitations: ["비식별 제한 피드 처리", "공식기관 인계 목적"],
    },
  };
  const signature = await crypto.subtle.sign(
    { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
    privateKey,
    new TextEncoder().encode(authorizedOperatorCredentialSigningPayload(envelope)),
  );
  return { ...envelope, signature: bytesToBase64Url(signature) };
}

describe("institution credential login core", () => {
  it("issues a signed server token and HttpOnly session cookie from a verified credential", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const credential = await signCredential(privateKey);
    const result = await issueInstitutionSessionFromSignedCredential(credential, [trustedKey], tokenKey, {
      now,
      cookie: { secure: true },
    });

    expect(result.session.organizationName).toBe("Authorized Support Center");
    expect(result.session.assuranceLevel).toBe("SERVER_SESSION");
    expect(result.setCookieHeader).toContain(`${INSTITUTION_SESSION_COOKIE_NAME}=`);
    expect(result.setCookieHeader).toContain("HttpOnly");
    expect(result.setCookieHeader).toContain("Secure");
    expect(result.setCookieHeader).not.toContain(tokenKey.secret as string);

    const tokenFromCookie = readInstitutionSessionTokenFromCookie(result.setCookieHeader, true);
    expect(tokenFromCookie).toBe(result.token);
    const verifiedSession = await verifyInstitutionSessionFromCookieToken(result.token, [tokenKey], now + 1);
    expect(verifiedSession.subjectId).toBe("operator:caseworker-001");
  });

  it("rejects credential role/capability escalation before issuing a cookie", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const credential = await signCredential(privateKey);

    await expect(
      issueInstitutionSessionFromSignedCredential(credential, [trustedKey], tokenKey, {
        now,
        role: "VICTIM_SUPPORT_CASEWORKER",
        cookie: { secure: true },
      }),
    ).rejects.toThrow("cannot use AUTHORIZED_FEED_IMPORT");
  });

  it("clears the production cookie with secure HttpOnly attributes", () => {
    const clear = clearInstitutionSessionCookie(true);

    expect(clear).toContain(`${INSTITUTION_SESSION_COOKIE_NAME}=`);
    expect(clear).toContain("HttpOnly");
    expect(clear).toContain("Secure");
    expect(clear).toContain("Max-Age=0");
  });
});
