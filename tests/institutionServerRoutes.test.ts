import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
  createInstitutionServerRouteHandlers,
  loadInstitutionServerRouteConfig,
  type InstitutionServerRouteEnv,
} from "@/lib/institutionServerRoutes";
import {
  INSTITUTION_DEV_SESSION_COOKIE_NAME,
  INSTITUTION_SESSION_COOKIE_NAME,
  readInstitutionSessionTokenFromCookie,
} from "@/lib/institutionSessionCookie";
import { createInstitutionSessionToken } from "@/lib/institutionSessionToken";
import type { InstitutionAccountSession } from "@/lib/institutionAuth";

const now = Date.parse("2026-05-31T06:00:00.000Z");
const origin = "https://agency.example";
const strongSecret = "0123456789abcdef0123456789abcdef";
const tempDirs: string[] = [];

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jium-route-audit-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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
      credentialId: "cred-route-login-001",
      subjectId: "operator:caseworker-001",
      issuerName: "Authorized Support Center",
      issuedAt: "2026-05-31T00:00:00.000Z",
      expiresAt: "2026-05-31T07:00:00.000Z",
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

function routeEnv(dir: string, overrides: InstitutionServerRouteEnv = {}): InstitutionServerRouteEnv {
  return {
    NODE_ENV: "production",
    INSTITUTION_SESSION_KEY_ID: "route-session-key-2026-05",
    INSTITUTION_SESSION_SECRET: strongSecret,
    INSTITUTION_ALLOWED_ORIGINS: origin,
    INSTITUTION_AUDIT_LEDGER_DIR: dir,
    INSTITUTION_ACCOUNT_REGISTRY_DIR: path.join(dir, "accounts"),
    ...overrides,
  };
}

function loginRequest(credential: SignedAuthorizedOperatorCredential) {
  return new Request("https://jium.example/api/institution/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Jium-Institution-Login": "1",
    },
    body: JSON.stringify({ credential }),
  });
}

describe("institution server route adapter", () => {
  it("loads a production route config, handles login/session/logout, and writes an audit ledger", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const credential = await signCredential(privateKey);
    const dir = await tempDir();
    const config = loadInstitutionServerRouteConfig({
      env: routeEnv(dir),
      trustedKeys: [trustedKey],
      now: () => now,
    });
    const routes = createInstitutionServerRouteHandlers(config);

    const login = await routes.login(loginRequest(credential));
    const setCookie = login.headers.get("Set-Cookie") || "";
    const token = readInstitutionSessionTokenFromCookie(setCookie, true);
    const session = await routes.session(
      new Request("https://jium.example/api/institution/session", {
        headers: {
          Origin: origin,
          Cookie: `${INSTITUTION_SESSION_COOKIE_NAME}=${token}`,
        },
      }),
    );
    const logout = await routes.logout(
      new Request("https://jium.example/api/institution/logout", {
        method: "POST",
        headers: {
          Origin: origin,
          "X-Jium-Institution-Login": "1",
        },
      }),
    );
    const ledgerText = await readFile(config.auditStore!.filePath, "utf8");

    expect(login.status).toBe(200);
    expect(setCookie).toContain(`${INSTITUTION_SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("Secure");
    expect(session.status).toBe(200);
    expect(logout.status).toBe(200);
    expect(await config.auditStore!.verify()).toMatchObject({ valid: true, recordCount: 3 });
    expect(ledgerText).not.toContain(token);
    expect(ledgerText).not.toContain(origin);
  });

  it("serves account provisioning through the materialized server route handler set", async () => {
    const { trustedKey } = await generateTrustedKey();
    const dir = await tempDir();
    const config = loadInstitutionServerRouteConfig({
      env: routeEnv(dir),
      trustedKeys: [trustedKey],
      now: () => now,
    });
    const routes = createInstitutionServerRouteHandlers(config);
    const adminSession: InstitutionAccountSession = {
      sessionId: "srv-admin-route-001",
      organizationId: "org-program-admin",
      organizationName: "Jium Program Admin",
      subjectId: "operator:admin-route-001",
      role: "PROGRAM_ADMIN",
      assuranceLevel: "SERVER_SESSION_MFA",
      issuedAt: "2026-05-31T05:00:00.000Z",
      authenticatedAt: "2026-05-31T05:05:00.000Z",
      expiresAt: "2026-05-31T07:00:00.000Z",
      mfaVerifiedAt: "2026-05-31T05:06:00.000Z",
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "INSTITUTION_ACCOUNT_ADMIN"],
      evidenceAccessScope: "OFFICIAL_REQUEST_ONLY",
      limitations: ["account registry administration only", "no raw victim indicators"],
    };
    const token = await createInstitutionSessionToken(adminSession, config.tokenKey, { tokenId: adminSession.sessionId, now });
    const response = await routes.accounts(
      new Request("https://jium.example/api/institution/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: `${INSTITUTION_SESSION_COOKIE_NAME}=${token}`,
          "X-Jium-Institution-Account-Admin": "1",
        },
        body: JSON.stringify({
          action: "PROVISION",
          account: {
            organizationId: "org-support-center-001",
            organizationName: "Authorized Support Center",
            subjectId: "operator:caseworker-route-001",
            role: "VICTIM_SUPPORT_CASEWORKER",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.account.subjectId).toBe("operator:caseworker-route-001");
    expect((await config.accountStore!.read()).accounts).toHaveLength(1);
    expect(await config.auditStore!.verify()).toMatchObject({ valid: true, recordCount: 1 });
  });

  it("rejects unsafe route environment configuration", async () => {
    const dir = await tempDir();
    const { trustedKey } = await generateTrustedKey();

    expect(() =>
      loadInstitutionServerRouteConfig({
        env: routeEnv(dir, { NEXT_PUBLIC_INSTITUTION_SESSION_SECRET: strongSecret }),
        trustedKeys: [trustedKey],
      }),
    ).toThrow("NEXT_PUBLIC_INSTITUTION_SESSION_SECRET");
    expect(() =>
      loadInstitutionServerRouteConfig({
        env: routeEnv(dir, { INSTITUTION_SESSION_SECRET: "too-short" }),
        trustedKeys: [trustedKey],
      }),
    ).toThrow("32 bytes");
    expect(() =>
      loadInstitutionServerRouteConfig({
        env: routeEnv(dir, { INSTITUTION_ALLOWED_ORIGINS: "" }),
        trustedKeys: [trustedKey],
      }),
    ).toThrow("INSTITUTION_ALLOWED_ORIGINS");
    expect(() =>
      loadInstitutionServerRouteConfig({
        env: routeEnv(dir, { INSTITUTION_SECURE_COOKIES: "false" }),
        trustedKeys: [trustedKey],
      }),
    ).toThrow("not allowed in production");
    expect(() =>
      loadInstitutionServerRouteConfig({
        env: routeEnv(dir, { INSTITUTION_AUDIT_LEDGER_DIR: "" }),
        trustedKeys: [trustedKey],
      }),
    ).toThrow("INSTITUTION_AUDIT_LEDGER_DIR");
    expect(() =>
      loadInstitutionServerRouteConfig({
        env: routeEnv(dir, { INSTITUTION_ACCOUNT_REGISTRY_DIR: "" }),
        trustedKeys: [trustedKey],
      }),
    ).toThrow("INSTITUTION_ACCOUNT_REGISTRY_DIR");
    expect(() =>
      loadInstitutionServerRouteConfig({
        env: routeEnv(dir),
        trustedKeys: [],
      }),
    ).toThrow("trusted institution public key");
  });

  it("supports explicit local development cookies without weakening production", async () => {
    const dir = await tempDir();
    const { trustedKey } = await generateTrustedKey();
    const config = loadInstitutionServerRouteConfig({
      env: routeEnv(dir, { NODE_ENV: "development", INSTITUTION_SECURE_COOKIES: "false" }),
      trustedKeys: [trustedKey],
      now: () => now,
    });

    expect(config.secureCookies).toBe(false);
    expect(INSTITUTION_DEV_SESSION_COOKIE_NAME).toBe("jium_institution_session_dev");
  });
});
