import { TRUSTED_AUTHORIZED_FEED_KEYS } from "@/lib/authorizedFeedTrustedKeys";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import type { InstitutionAuditSink } from "@/lib/institutionAuditLog";
import { handleInstitutionAccountAdminRequest } from "@/lib/institutionAccountProvisioningHttp";
import {
  handleInstitutionCredentialLoginRequest,
  handleInstitutionLogoutRequest,
  handleInstitutionSessionRequest,
} from "@/lib/institutionLoginHttp";
import { handleInstitutionAuditLedgerSummaryRequest } from "@/lib/institutionAuditLedgerHttp";
import {
  validateInstitutionSessionTokenKey,
  type InstitutionSessionTokenKey,
} from "@/lib/institutionSessionToken";
import {
  createInstitutionAuditLedgerFileStore,
  type InstitutionAuditLedgerFileStore,
} from "@/lib/serverInstitutionAuditLedgerStore";
import {
  createInstitutionAccountRegistryFileStore,
  type InstitutionAccountRegistryStore,
} from "@/lib/serverInstitutionAccountStore";

export type InstitutionServerRouteEnv = Record<string, string | undefined>;

export type InstitutionServerRouteConfig = {
  trustedKeys: readonly TrustedAuthorizedFeedKey[];
  tokenKey: InstitutionSessionTokenKey;
  tokenKeys: readonly InstitutionSessionTokenKey[];
  allowedOrigins: readonly string[];
  secureCookies: boolean;
  auditSink?: InstitutionAuditSink;
  auditStore?: InstitutionAuditLedgerFileStore;
  accountStore?: InstitutionAccountRegistryStore;
  now?: () => number;
};

export type InstitutionServerRouteConfigOptions = {
  env?: InstitutionServerRouteEnv;
  trustedKeys?: readonly TrustedAuthorizedFeedKey[];
  auditSink?: InstitutionAuditSink;
  now?: () => number;
  requireTrustedKeys?: boolean;
  requireAuditStore?: boolean;
  requireAccountStore?: boolean;
};

export type InstitutionServerRouteHandlers = {
  login: (request: Request) => Promise<Response>;
  session: (request: Request) => Promise<Response>;
  logout: (request: Request) => Promise<Response>;
  auditLedger: (request: Request) => Promise<Response>;
  accounts: (request: Request) => Promise<Response>;
};

function clean(value: string | undefined) {
  return value?.trim() || "";
}

function csv(value: string | undefined) {
  return clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isProduction(env: InstitutionServerRouteEnv) {
  return clean(env.NODE_ENV) === "production";
}

function secureCookiesFromEnv(env: InstitutionServerRouteEnv) {
  const value = clean(env.INSTITUTION_SECURE_COOKIES).toLowerCase();
  if (!value) {
    return isProduction(env);
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    if (isProduction(env)) {
      throw new Error("INSTITUTION_SECURE_COOKIES=false is not allowed in production");
    }
    return false;
  }
  throw new Error("INSTITUTION_SECURE_COOKIES must be true or false when set");
}

function assertNoPublicInstitutionSecret(env: InstitutionServerRouteEnv) {
  if (clean(env.NEXT_PUBLIC_INSTITUTION_SESSION_SECRET)) {
    throw new Error("NEXT_PUBLIC_INSTITUTION_SESSION_SECRET must never be set");
  }
}

function tokenKeyFromEnv(env: InstitutionServerRouteEnv, now: number): InstitutionSessionTokenKey {
  const tokenKey: InstitutionSessionTokenKey = {
    keyId: clean(env.INSTITUTION_SESSION_KEY_ID) || "institution-session-env-key",
    secret: clean(env.INSTITUTION_SESSION_SECRET),
    validFrom: clean(env.INSTITUTION_SESSION_SECRET_VALID_FROM) || undefined,
    validUntil: clean(env.INSTITUTION_SESSION_SECRET_VALID_UNTIL) || undefined,
  };
  const errors = validateInstitutionSessionTokenKey(tokenKey, now);
  if (errors.length) {
    throw new Error(`Institution route session token key is not valid: ${errors.join("; ")}`);
  }
  return tokenKey;
}

export function loadInstitutionServerRouteConfig(
  options: InstitutionServerRouteConfigOptions = {},
): InstitutionServerRouteConfig {
  const env = options.env || process.env;
  const now = options.now?.() ?? Date.now();
  assertNoPublicInstitutionSecret(env);

  const allowedOrigins = csv(env.INSTITUTION_ALLOWED_ORIGINS);
  if (!allowedOrigins.length) {
    throw new Error("INSTITUTION_ALLOWED_ORIGINS must include at least one trusted origin");
  }
  const trustedKeys = options.trustedKeys || TRUSTED_AUTHORIZED_FEED_KEYS;
  if ((options.requireTrustedKeys ?? true) && !trustedKeys.length) {
    throw new Error("At least one trusted institution public key is required for server routes");
  }

  const auditStoreDir = clean(env.INSTITUTION_AUDIT_LEDGER_DIR);
  const auditStoreFile = clean(env.INSTITUTION_AUDIT_LEDGER_FILE) || undefined;
  const auditStore = auditStoreDir
    ? createInstitutionAuditLedgerFileStore(auditStoreDir, { fileName: auditStoreFile, now: options.now })
    : undefined;
  if ((options.requireAuditStore ?? true) && !auditStore && !options.auditSink) {
    throw new Error("INSTITUTION_AUDIT_LEDGER_DIR or an explicit auditSink is required for server routes");
  }

  const accountRegistryDir = clean(env.INSTITUTION_ACCOUNT_REGISTRY_DIR);
  const accountRegistryFile = clean(env.INSTITUTION_ACCOUNT_REGISTRY_FILE) || undefined;
  const accountStore = accountRegistryDir
    ? createInstitutionAccountRegistryFileStore(accountRegistryDir, { fileName: accountRegistryFile, now: options.now })
    : undefined;
  if ((options.requireAccountStore ?? true) && !accountStore) {
    throw new Error("INSTITUTION_ACCOUNT_REGISTRY_DIR is required for server account provisioning routes");
  }

  const tokenKey = tokenKeyFromEnv(env, now);
  return {
    trustedKeys,
    tokenKey,
    tokenKeys: [tokenKey],
    allowedOrigins,
    secureCookies: secureCookiesFromEnv(env),
    auditSink: options.auditSink || auditStore?.append,
    auditStore,
    accountStore,
    now: options.now,
  };
}

export function createInstitutionServerRouteHandlers(
  config: InstitutionServerRouteConfig,
): InstitutionServerRouteHandlers {
  return {
    login: (request) =>
      handleInstitutionCredentialLoginRequest(request, {
        trustedKeys: config.trustedKeys,
        tokenKey: config.tokenKey,
        secureCookies: config.secureCookies,
        allowedOrigins: config.allowedOrigins,
        auditSink: config.auditSink,
        now: config.now?.(),
      }),
    session: (request) =>
      handleInstitutionSessionRequest(request, {
        tokenKeys: config.tokenKeys,
        secureCookies: config.secureCookies,
        allowedOrigins: config.allowedOrigins,
        auditSink: config.auditSink,
        now: config.now?.(),
      }),
    logout: (request) =>
      handleInstitutionLogoutRequest(request, {
        secureCookies: config.secureCookies,
        allowedOrigins: config.allowedOrigins,
        auditSink: config.auditSink,
        now: config.now?.(),
      }),
    auditLedger: (request) =>
      handleInstitutionAuditLedgerSummaryRequest(request, {
        tokenKeys: config.tokenKeys,
        secureCookies: config.secureCookies,
        allowedOrigins: config.allowedOrigins,
        readAuditRecords: async () => {
          if (!config.auditStore) {
            throw new Error("Institution audit ledger store is not configured");
          }
          return config.auditStore.read();
        },
        auditSink: config.auditSink,
        now: config.now?.(),
      }),
    accounts: (request) => {
      if (!config.accountStore) {
        return Promise.resolve(new Response(JSON.stringify({ ok: false, errorCode: "ACCOUNT_REGISTRY_STORE_UNAVAILABLE" }), {
          status: 503,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }));
      }
      return handleInstitutionAccountAdminRequest(request, {
        tokenKeys: config.tokenKeys,
        secureCookies: config.secureCookies,
        allowedOrigins: config.allowedOrigins,
        accountStore: config.accountStore,
        auditSink: config.auditSink,
        now: config.now?.(),
      });
    },
  };
}
