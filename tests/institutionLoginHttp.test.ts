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
import type { InstitutionAuditEvent } from "@/lib/institutionAuditLog";
import {
  handleInstitutionCredentialLoginRequest,
  handleInstitutionLogoutRequest,
  handleInstitutionSessionRequest,
  INSTITUTION_LOGIN_CSRF_HEADER,
  INSTITUTION_LOGIN_CSRF_VALUE,
  INSTITUTION_LOGIN_MAX_BODY_BYTES,
} from "@/lib/institutionLoginHttp";
import {
  INSTITUTION_SESSION_COOKIE_NAME,
  readInstitutionSessionTokenFromCookie,
} from "@/lib/institutionSessionCookie";
import type { InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";

const now = Date.parse("2026-05-31T02:00:00.000Z");
const origin = "https://agency.example";
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
      credentialId: "cred-http-login-001",
      subjectId: "operator:caseworker-001",
      issuerName: "Authorized Support Center",
      issuedAt: "2026-05-31T00:00:00.000Z",
      expiresAt: "2026-05-31T03:00:00.000Z",
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

function loginRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://jium.example/api/institution/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      [INSTITUTION_LOGIN_CSRF_HEADER]: INSTITUTION_LOGIN_CSRF_VALUE,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("institution login HTTP handler core", () => {
  it("sets an HttpOnly cookie without exposing the server token in the JSON body", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const credential = await signCredential(privateKey);
    const auditEvents: InstitutionAuditEvent[] = [];
    const response = await handleInstitutionCredentialLoginRequest(
      loginRequest({ credential }),
      {
        trustedKeys: [trustedKey],
        tokenKey,
        secureCookies: true,
        allowedOrigins: [origin],
        auditSink: (event) => {
          auditEvents.push(event);
        },
        now,
      },
    );

    const setCookie = response.headers.get("Set-Cookie") || "";
    const token = readInstitutionSessionTokenFromCookie(setCookie, true);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${INSTITUTION_SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(token).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(token);
    expect(JSON.stringify(auditEvents)).not.toContain(token);
    expect(auditEvents[0]?.eventType).toBe("INSTITUTION_LOGIN_SUCCESS");
    expect(auditEvents[0]?.originClassification).toBe("ALLOWED");
    expect(body.session.organizationName).toBe("Authorized Support Center");
  });

  it("verifies a session from the issued cookie", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const credential = await signCredential(privateKey);
    const login = await handleInstitutionCredentialLoginRequest(
      loginRequest({ credential }),
      { trustedKeys: [trustedKey], tokenKey, secureCookies: true, allowedOrigins: [origin], now },
    );
    const token = readInstitutionSessionTokenFromCookie(login.headers.get("Set-Cookie"), true);
    const auditEvents: InstitutionAuditEvent[] = [];

    const response = await handleInstitutionSessionRequest(
      new Request("https://jium.example/api/institution/session", {
        headers: {
          Cookie: `${INSTITUTION_SESSION_COOKIE_NAME}=${token}`,
          Origin: origin,
        },
      }),
      {
        tokenKeys: [tokenKey],
        secureCookies: true,
        allowedOrigins: [origin],
        auditSink: (event) => {
          auditEvents.push(event);
        },
        now: now + 1,
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session.subjectId).toBe("operator:caseworker-001");
    expect(auditEvents[0]?.eventType).toBe("INSTITUTION_SESSION_VERIFIED");
  });

  it("rejects unsafe browser requests before credential verification", async () => {
    const auditEvents: InstitutionAuditEvent[] = [];
    const getResponse = await handleInstitutionCredentialLoginRequest(
      new Request("https://jium.example/api/institution/login", { method: "GET" }),
      { trustedKeys: [], tokenKey, secureCookies: true },
    );
    const missingCsrf = await handleInstitutionCredentialLoginRequest(
      loginRequest({ credential: {} }, { [INSTITUTION_LOGIN_CSRF_HEADER]: "" }),
      { trustedKeys: [], tokenKey, secureCookies: true },
    );
    const wrongOrigin = await handleInstitutionCredentialLoginRequest(
      loginRequest({ credential: {} }, { Origin: "https://evil.example" }),
      {
        trustedKeys: [],
        tokenKey,
        secureCookies: true,
        allowedOrigins: [origin],
        auditSink: (event) => {
          auditEvents.push(event);
        },
      },
    );

    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get("Allow")).toBe("POST");
    expect(missingCsrf.status).toBe(403);
    expect(wrongOrigin.status).toBe(403);
    expect(wrongOrigin.headers.get("Set-Cookie")).toBeNull();
    expect(auditEvents[0]?.eventType).toBe("INSTITUTION_LOGIN_DENIED");
    expect(auditEvents[0]?.reasonCode).toBe("ORIGIN_NOT_ALLOWED");
    expect(auditEvents[0]?.originClassification).toBe("REJECTED");
  });

  it("rejects non-JSON and oversized login bodies", async () => {
    const nonJson = await handleInstitutionCredentialLoginRequest(
      loginRequest("not-json", { "Content-Type": "text/plain" }),
      { trustedKeys: [], tokenKey, secureCookies: true },
    );
    const spoofedJson = await handleInstitutionCredentialLoginRequest(
      loginRequest("{}", { "Content-Type": "text/application/json" }),
      { trustedKeys: [], tokenKey, secureCookies: true },
    );
    const oversized = await handleInstitutionCredentialLoginRequest(
      loginRequest(JSON.stringify({ padding: "x".repeat(INSTITUTION_LOGIN_MAX_BODY_BYTES + 1) })),
      { trustedKeys: [], tokenKey, secureCookies: true },
    );

    expect(nonJson.status).toBe(415);
    expect(spoofedJson.status).toBe(415);
    expect(oversized.status).toBe(413);
  });

  it("clears the institution cookie through the logout handler", async () => {
    const auditEvents: InstitutionAuditEvent[] = [];
    const response = await handleInstitutionLogoutRequest(
      new Request("https://jium.example/api/institution/logout", {
        method: "POST",
        headers: {
          Origin: origin,
          [INSTITUTION_LOGIN_CSRF_HEADER]: INSTITUTION_LOGIN_CSRF_VALUE,
        },
      }),
      {
        secureCookies: true,
        allowedOrigins: [origin],
        auditSink: (event) => {
          auditEvents.push(event);
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain(`${INSTITUTION_SESSION_COOKIE_NAME}=`);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(auditEvents[0]?.eventType).toBe("INSTITUTION_LOGOUT");
  });
});
