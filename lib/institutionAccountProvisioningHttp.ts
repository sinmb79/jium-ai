import {
  provisionInstitutionAccount,
  publicInstitutionAccountView,
  revokeInstitutionAccount,
  type InstitutionAccountRegistry,
} from "@/lib/institutionAccountRegistry";
import {
  INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER,
  INSTITUTION_ACCOUNT_ADMIN_CSRF_VALUE,
  type InstitutionAccountAdminRequestBody,
} from "@/lib/institutionAccountProvisioningClient";
import {
  classifyInstitutionRequestOrigin,
  createInstitutionAuditEvent,
  emitInstitutionAuditEvent,
  safeInstitutionRequestId,
  type InstitutionAuditEventType,
  type InstitutionAuditOutcome,
  type InstitutionAuditSink,
} from "@/lib/institutionAuditLog";
import {
  requireInstitutionCapability,
  type InstitutionAccountSession,
} from "@/lib/institutionAuth";
import { verifyInstitutionSessionFromCookieToken } from "@/lib/institutionLogin";
import { readInstitutionSessionTokenFromCookie } from "@/lib/institutionSessionCookie";
import type { InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";

export const INSTITUTION_ACCOUNT_ADMIN_MAX_BODY_BYTES = 24 * 1024;
export { INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER, INSTITUTION_ACCOUNT_ADMIN_CSRF_VALUE };

export type InstitutionAccountRegistryStoreAdapter = {
  read: () => Promise<InstitutionAccountRegistry>;
  write: (registry: InstitutionAccountRegistry) => Promise<void>;
};

export type InstitutionAccountProvisioningHttpConfig = {
  tokenKeys: readonly InstitutionSessionTokenKey[];
  secureCookies: boolean;
  allowedOrigins?: readonly string[];
  accountStore: InstitutionAccountRegistryStoreAdapter;
  auditSink?: InstitutionAuditSink;
  requestId?: string;
  now?: number;
  maxBodyBytes?: number;
};

type GuardFailure = {
  response: Response;
  errorCode: string;
};

function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function guardFailure(status: number, errorCode: string, headers: HeadersInit = {}): GuardFailure {
  return {
    response: jsonResponse(status, { ok: false, errorCode }, headers),
    errorCode,
  };
}

function methodGuard(request: Request) {
  if (request.method !== "POST") {
    return guardFailure(405, "METHOD_NOT_ALLOWED", { Allow: "POST" });
  }
  return null;
}

function csrfGuard(request: Request) {
  if (request.headers.get(INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER) !== INSTITUTION_ACCOUNT_ADMIN_CSRF_VALUE) {
    return guardFailure(403, "CSRF_HEADER_REQUIRED");
  }
  return null;
}

function originGuard(request: Request, allowedOrigins: readonly string[] = []) {
  if (!allowedOrigins.length) {
    return null;
  }
  const origin = request.headers.get("Origin");
  if (!origin) {
    return guardFailure(403, "ORIGIN_REQUIRED");
  }
  if (!allowedOrigins.includes(origin)) {
    return guardFailure(403, "ORIGIN_NOT_ALLOWED");
  }
  return null;
}

function contentTypeGuard(request: Request) {
  const contentType = request.headers.get("Content-Type") || "";
  const mediaType = contentType.toLowerCase().split(";")[0]?.trim();
  if (mediaType !== "application/json") {
    return guardFailure(415, "UNSUPPORTED_MEDIA_TYPE");
  }
  return null;
}

function safeSessionView(session?: InstitutionAccountSession) {
  if (!session) {
    return undefined;
  }
  return {
    organizationName: session.organizationName,
    subjectId: session.subjectId,
    role: session.role,
    capabilityIds: session.capabilityIds,
    evidenceAccessScope: session.evidenceAccessScope,
    expiresAt: session.expiresAt,
  };
}

async function auditAccountAdminEvent(
  request: Request,
  config: Pick<InstitutionAccountProvisioningHttpConfig, "allowedOrigins" | "auditSink" | "requestId" | "now">,
  eventType: InstitutionAuditEventType,
  outcome: InstitutionAuditOutcome,
  details: { reasonCode?: string; session?: InstitutionAccountSession } = {},
) {
  const now = config.now ?? Date.now();
  const session = safeSessionView(details.session);
  await emitInstitutionAuditEvent(
    config.auditSink,
    createInstitutionAuditEvent(
      {
        eventType,
        outcome,
        reasonCode: details.reasonCode,
        requestId: config.requestId || safeInstitutionRequestId(request.headers.get("X-Request-Id"), now),
        originClassification: classifyInstitutionRequestOrigin(request.headers.get("Origin"), config.allowedOrigins),
        organizationName: session?.organizationName,
        subjectId: session?.subjectId,
        role: session?.role,
        capabilityIds: session?.capabilityIds,
        evidenceAccessScope: session?.evidenceAccessScope,
        sessionExpiresAt: session?.expiresAt,
      },
      now,
    ),
  );
}

async function readJsonBody(request: Request, maxBodyBytes: number): Promise<InstitutionAccountAdminRequestBody> {
  const declaredLength = Number(request.headers.get("Content-Length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new Error("REQUEST_BODY_TOO_LARGE");
  }
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > maxBodyBytes) {
    throw new Error("REQUEST_BODY_TOO_LARGE");
  }
  try {
    const parsed = JSON.parse(bodyText);
    return parsed && typeof parsed === "object" ? (parsed as InstitutionAccountAdminRequestBody) : ({ action: "LIST" } as InstitutionAccountAdminRequestBody);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function requireAccountAdminSession(request: Request, config: InstitutionAccountProvisioningHttpConfig) {
  const token = readInstitutionSessionTokenFromCookie(request.headers.get("Cookie"), config.secureCookies);
  if (!token) {
    throw new Error("INSTITUTION_SESSION_REQUIRED");
  }
  const session = await verifyInstitutionSessionFromCookieToken(token, config.tokenKeys, config.now);
  requireInstitutionCapability(session, "INSTITUTION_ACCOUNT_ADMIN", config.now);
  return session;
}

function actionEventType(action: InstitutionAccountAdminRequestBody["action"]): InstitutionAuditEventType {
  if (action === "PROVISION") {
    return "INSTITUTION_ACCOUNT_PROVISIONED";
  }
  if (action === "REVOKE") {
    return "INSTITUTION_ACCOUNT_REVOKED";
  }
  return "INSTITUTION_ACCOUNT_LISTED";
}

export async function handleInstitutionAccountAdminRequest(
  request: Request,
  config: InstitutionAccountProvisioningHttpConfig,
) {
  const guard =
    methodGuard(request) ||
    csrfGuard(request) ||
    originGuard(request, config.allowedOrigins) ||
    contentTypeGuard(request);
  if (guard) {
    await auditAccountAdminEvent(request, config, "INSTITUTION_ACCOUNT_ADMIN_DENIED", "DENIED", {
      reasonCode: guard.errorCode,
    });
    return guard.response;
  }

  let session: InstitutionAccountSession;
  try {
    session = await requireAccountAdminSession(request, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "INSTITUTION_ACCOUNT_ADMIN_NOT_ALLOWED";
    const errorCode = message.includes("INSTITUTION_SESSION_REQUIRED") ? "INSTITUTION_SESSION_REQUIRED" : "INSTITUTION_ACCOUNT_ADMIN_NOT_ALLOWED";
    await auditAccountAdminEvent(request, config, "INSTITUTION_ACCOUNT_ADMIN_DENIED", "DENIED", { reasonCode: errorCode });
    return jsonResponse(errorCode === "INSTITUTION_SESSION_REQUIRED" ? 401 : 403, { ok: false, errorCode });
  }

  let body: InstitutionAccountAdminRequestBody;
  try {
    body = await readJsonBody(request, config.maxBodyBytes || INSTITUTION_ACCOUNT_ADMIN_MAX_BODY_BYTES);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "INVALID_JSON";
    await auditAccountAdminEvent(request, config, "INSTITUTION_ACCOUNT_ADMIN_DENIED", "DENIED", { reasonCode: errorCode, session });
    return jsonResponse(errorCode === "REQUEST_BODY_TOO_LARGE" ? 413 : 400, { ok: false, errorCode });
  }

  try {
    const registry = await config.accountStore.read();
    if (body.action === "LIST") {
      await auditAccountAdminEvent(request, config, "INSTITUTION_ACCOUNT_LISTED", "SUCCESS", { session });
      return jsonResponse(200, {
        ok: true,
        registryVersion: registry.version,
        updatedAt: registry.updatedAt,
        accounts: registry.accounts.map(publicInstitutionAccountView),
      });
    }
    if (body.action === "PROVISION" && body.account) {
      const { registry: nextRegistry, account } = provisionInstitutionAccount(
        registry,
        {
          ...body.account,
          issuedBySubjectId: session.subjectId,
        },
        config.now,
      );
      await config.accountStore.write(nextRegistry);
      await auditAccountAdminEvent(request, config, actionEventType(body.action), "SUCCESS", { session });
      return jsonResponse(200, { ok: true, account: publicInstitutionAccountView(account) });
    }
    if (body.action === "REVOKE" && body.revocation) {
      const { registry: nextRegistry, account } = revokeInstitutionAccount(
        registry,
        {
          ...body.revocation,
          revokedBySubjectId: session.subjectId,
        },
        config.now,
      );
      await config.accountStore.write(nextRegistry);
      await auditAccountAdminEvent(request, config, actionEventType(body.action), "SUCCESS", { session });
      return jsonResponse(200, { ok: true, account: publicInstitutionAccountView(account) });
    }
    await auditAccountAdminEvent(request, config, "INSTITUTION_ACCOUNT_ADMIN_DENIED", "DENIED", {
      reasonCode: "UNSUPPORTED_ACCOUNT_ADMIN_ACTION",
      session,
    });
    return jsonResponse(400, { ok: false, errorCode: "UNSUPPORTED_ACCOUNT_ADMIN_ACTION" });
  } catch (error) {
    await auditAccountAdminEvent(request, config, "INSTITUTION_ACCOUNT_ADMIN_DENIED", "DENIED", {
      reasonCode: "ACCOUNT_REGISTRY_OPERATION_FAILED",
      session,
    });
    return jsonResponse(400, {
      ok: false,
      errorCode: "ACCOUNT_REGISTRY_OPERATION_FAILED",
      message: error instanceof Error ? error.message : "account registry operation failed",
    });
  }
}
