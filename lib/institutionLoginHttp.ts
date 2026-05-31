import {
  isSignedAuthorizedOperatorCredential,
  type SignedAuthorizedOperatorCredential,
} from "@/lib/authorizedOperatorCredential";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import {
  classifyInstitutionRequestOrigin,
  createInstitutionAuditEvent,
  emitInstitutionAuditEvent,
  safeInstitutionRequestId,
  type InstitutionAuditEventType,
  type InstitutionAuditOutcome,
  type InstitutionAuditSink,
} from "@/lib/institutionAuditLog";
import type {
  InstitutionCapability,
  InstitutionEvidenceAccessScope,
  InstitutionRole,
} from "@/lib/institutionAuth";
import {
  clearInstitutionSessionCookie,
  issueInstitutionSessionFromSignedCredential,
  verifyInstitutionSessionFromCookieToken,
} from "@/lib/institutionLogin";
import {
  readInstitutionSessionTokenFromCookie,
  type InstitutionSessionCookieOptions,
} from "@/lib/institutionSessionCookie";
import type { InstitutionSessionTokenKey } from "@/lib/institutionSessionToken";

export const INSTITUTION_LOGIN_CSRF_HEADER = "x-jium-institution-login";
export const INSTITUTION_LOGIN_CSRF_VALUE = "1";
export const INSTITUTION_LOGIN_MAX_BODY_BYTES = 16 * 1024;

export type InstitutionLoginHttpConfig = {
  trustedKeys: readonly TrustedAuthorizedFeedKey[];
  tokenKey: InstitutionSessionTokenKey;
  secureCookies: boolean;
  allowedOrigins?: readonly string[];
  role?: InstitutionRole;
  organizationId?: string;
  evidenceAccessScope?: InstitutionEvidenceAccessScope;
  cookie?: Omit<InstitutionSessionCookieOptions, "secure">;
  auditSink?: InstitutionAuditSink;
  requestId?: string;
  now?: number;
  maxBodyBytes?: number;
};

export type InstitutionSessionHttpConfig = {
  tokenKeys: readonly InstitutionSessionTokenKey[];
  secureCookies: boolean;
  allowedOrigins?: readonly string[];
  auditSink?: InstitutionAuditSink;
  requestId?: string;
  now?: number;
};

type LoginBody = {
  credential?: unknown;
};

type GuardFailure = {
  response: Response;
  errorCode: string;
};

type SafeSessionView = {
  organizationName: string;
  subjectId: string;
  role: InstitutionRole;
  capabilityIds: InstitutionCapability[];
  evidenceAccessScope: InstitutionEvidenceAccessScope;
  expiresAt: string;
  limitations: string[];
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

function safeSessionView(session: {
  organizationName: string;
  subjectId: string;
  role: InstitutionRole;
  capabilityIds: InstitutionCapability[];
  evidenceAccessScope: InstitutionEvidenceAccessScope;
  expiresAt: string;
  limitations: string[];
}): SafeSessionView {
  return {
    organizationName: session.organizationName,
    subjectId: session.subjectId,
    role: session.role,
    capabilityIds: session.capabilityIds,
    evidenceAccessScope: session.evidenceAccessScope,
    expiresAt: session.expiresAt,
    limitations: session.limitations,
  };
}

function methodGuard(request: Request) {
  if (request.method !== "POST") {
    return guardFailure(405, "METHOD_NOT_ALLOWED", { Allow: "POST" });
  }
  return null;
}

function csrfGuard(request: Request) {
  if (request.headers.get(INSTITUTION_LOGIN_CSRF_HEADER) !== INSTITUTION_LOGIN_CSRF_VALUE) {
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

async function auditInstitutionHttpEvent(
  request: Request,
  config: { allowedOrigins?: readonly string[]; auditSink?: InstitutionAuditSink; requestId?: string; now?: number },
  eventType: InstitutionAuditEventType,
  outcome: InstitutionAuditOutcome,
  details: {
    reasonCode?: string;
    session?: SafeSessionView;
  } = {},
) {
  const now = config.now ?? Date.now();
  await emitInstitutionAuditEvent(
    config.auditSink,
    createInstitutionAuditEvent(
      {
        eventType,
        outcome,
        reasonCode: details.reasonCode,
        requestId: config.requestId || safeInstitutionRequestId(request.headers.get("X-Request-Id"), now),
        originClassification: classifyInstitutionRequestOrigin(request.headers.get("Origin"), config.allowedOrigins),
        organizationName: details.session?.organizationName,
        subjectId: details.session?.subjectId,
        role: details.session?.role,
        capabilityIds: details.session?.capabilityIds,
        evidenceAccessScope: details.session?.evidenceAccessScope,
        sessionExpiresAt: details.session?.expiresAt,
      },
      now,
    ),
  );
}

async function readJsonBody(request: Request, maxBodyBytes: number): Promise<LoginBody> {
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
    return parsed && typeof parsed === "object" ? (parsed as LoginBody) : {};
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export async function handleInstitutionCredentialLoginRequest(
  request: Request,
  config: InstitutionLoginHttpConfig,
) {
  const guard =
    methodGuard(request) ||
    csrfGuard(request) ||
    originGuard(request, config.allowedOrigins) ||
    contentTypeGuard(request);
  if (guard) {
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_LOGIN_DENIED", "DENIED", {
      reasonCode: guard.errorCode,
    });
    return guard.response;
  }

  let body: LoginBody;
  try {
    body = await readJsonBody(request, config.maxBodyBytes || INSTITUTION_LOGIN_MAX_BODY_BYTES);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "INVALID_JSON";
    const status = errorCode === "REQUEST_BODY_TOO_LARGE" ? 413 : 400;
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_LOGIN_DENIED", "DENIED", { reasonCode: errorCode });
    return jsonResponse(status, { ok: false, errorCode });
  }

  if (!isSignedAuthorizedOperatorCredential(body.credential)) {
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_LOGIN_DENIED", "DENIED", {
      reasonCode: "INVALID_CREDENTIAL_FORMAT",
    });
    return jsonResponse(400, { ok: false, errorCode: "INVALID_CREDENTIAL_FORMAT" });
  }

  try {
    const result = await issueInstitutionSessionFromSignedCredential(
      body.credential as SignedAuthorizedOperatorCredential,
      config.trustedKeys,
      config.tokenKey,
      {
        role: config.role,
        organizationId: config.organizationId,
        evidenceAccessScope: config.evidenceAccessScope,
        cookie: { secure: config.secureCookies, ...config.cookie },
        now: config.now,
      },
    );

    const session = safeSessionView(result.session);
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_LOGIN_SUCCESS", "SUCCESS", { session });

    return jsonResponse(
      200,
      {
        ok: true,
        session,
      },
      { "Set-Cookie": result.setCookieHeader },
    );
  } catch {
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_LOGIN_DENIED", "DENIED", {
      reasonCode: "INVALID_INSTITUTION_CREDENTIAL",
    });
    return jsonResponse(401, { ok: false, errorCode: "INVALID_INSTITUTION_CREDENTIAL" });
  }
}

export async function handleInstitutionSessionRequest(
  request: Request,
  config: InstitutionSessionHttpConfig,
) {
  const guard = originGuard(request, config.allowedOrigins);
  if (guard) {
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_SESSION_REJECTED", "DENIED", {
      reasonCode: guard.errorCode,
    });
    return guard.response;
  }

  const token = readInstitutionSessionTokenFromCookie(request.headers.get("Cookie"), config.secureCookies);
  if (!token) {
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_SESSION_REJECTED", "DENIED", {
      reasonCode: "INSTITUTION_SESSION_REQUIRED",
    });
    return jsonResponse(401, { ok: false, errorCode: "INSTITUTION_SESSION_REQUIRED" });
  }

  try {
    const session = await verifyInstitutionSessionFromCookieToken(token, config.tokenKeys, config.now);
    const sessionView = safeSessionView(session);
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_SESSION_VERIFIED", "SUCCESS", {
      session: sessionView,
    });
    return jsonResponse(200, { ok: true, session: sessionView });
  } catch {
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_SESSION_REJECTED", "DENIED", {
      reasonCode: "INVALID_INSTITUTION_SESSION",
    });
    return jsonResponse(401, { ok: false, errorCode: "INVALID_INSTITUTION_SESSION" });
  }
}

export async function handleInstitutionLogoutRequest(
  request: Request,
  config: Pick<InstitutionSessionHttpConfig, "secureCookies" | "allowedOrigins" | "auditSink" | "requestId" | "now">,
) {
  const guard = methodGuard(request) || csrfGuard(request) || originGuard(request, config.allowedOrigins);
  if (guard) {
    await auditInstitutionHttpEvent(request, config, "INSTITUTION_LOGOUT_DENIED", "DENIED", {
      reasonCode: guard.errorCode,
    });
    return guard.response;
  }
  await auditInstitutionHttpEvent(request, config, "INSTITUTION_LOGOUT", "SUCCESS");
  return jsonResponse(200, { ok: true }, { "Set-Cookie": clearInstitutionSessionCookie(config.secureCookies) });
}
