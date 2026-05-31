import {
  isSignedAuthorizedOperatorCredential,
  type SignedAuthorizedOperatorCredential,
} from "@/lib/authorizedOperatorCredential";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
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
  now?: number;
  maxBodyBytes?: number;
};

export type InstitutionSessionHttpConfig = {
  tokenKeys: readonly InstitutionSessionTokenKey[];
  secureCookies: boolean;
  allowedOrigins?: readonly string[];
  now?: number;
};

type LoginBody = {
  credential?: unknown;
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
    return jsonResponse(405, { ok: false, errorCode: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });
  }
  return null;
}

function csrfGuard(request: Request) {
  if (request.headers.get(INSTITUTION_LOGIN_CSRF_HEADER) !== INSTITUTION_LOGIN_CSRF_VALUE) {
    return jsonResponse(403, { ok: false, errorCode: "CSRF_HEADER_REQUIRED" });
  }
  return null;
}

function originGuard(request: Request, allowedOrigins: readonly string[] = []) {
  if (!allowedOrigins.length) {
    return null;
  }
  const origin = request.headers.get("Origin");
  if (!origin) {
    return jsonResponse(403, { ok: false, errorCode: "ORIGIN_REQUIRED" });
  }
  if (!allowedOrigins.includes(origin)) {
    return jsonResponse(403, { ok: false, errorCode: "ORIGIN_NOT_ALLOWED" });
  }
  return null;
}

function contentTypeGuard(request: Request) {
  const contentType = request.headers.get("Content-Type") || "";
  const mediaType = contentType.toLowerCase().split(";")[0]?.trim();
  if (mediaType !== "application/json") {
    return jsonResponse(415, { ok: false, errorCode: "UNSUPPORTED_MEDIA_TYPE" });
  }
  return null;
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
    return guard;
  }

  let body: LoginBody;
  try {
    body = await readJsonBody(request, config.maxBodyBytes || INSTITUTION_LOGIN_MAX_BODY_BYTES);
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "INVALID_JSON";
    const status = errorCode === "REQUEST_BODY_TOO_LARGE" ? 413 : 400;
    return jsonResponse(status, { ok: false, errorCode });
  }

  if (!isSignedAuthorizedOperatorCredential(body.credential)) {
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

    return jsonResponse(
      200,
      {
        ok: true,
        session: safeSessionView(result.session),
      },
      { "Set-Cookie": result.setCookieHeader },
    );
  } catch {
    return jsonResponse(401, { ok: false, errorCode: "INVALID_INSTITUTION_CREDENTIAL" });
  }
}

export async function handleInstitutionSessionRequest(
  request: Request,
  config: InstitutionSessionHttpConfig,
) {
  const guard = originGuard(request, config.allowedOrigins);
  if (guard) {
    return guard;
  }

  const token = readInstitutionSessionTokenFromCookie(request.headers.get("Cookie"), config.secureCookies);
  if (!token) {
    return jsonResponse(401, { ok: false, errorCode: "INSTITUTION_SESSION_REQUIRED" });
  }

  try {
    const session = await verifyInstitutionSessionFromCookieToken(token, config.tokenKeys, config.now);
    return jsonResponse(200, { ok: true, session: safeSessionView(session) });
  } catch {
    return jsonResponse(401, { ok: false, errorCode: "INVALID_INSTITUTION_SESSION" });
  }
}

export async function handleInstitutionLogoutRequest(
  request: Request,
  config: Pick<InstitutionSessionHttpConfig, "secureCookies" | "allowedOrigins">,
) {
  const guard = methodGuard(request) || csrfGuard(request) || originGuard(request, config.allowedOrigins);
  if (guard) {
    return guard;
  }
  return jsonResponse(200, { ok: true }, { "Set-Cookie": clearInstitutionSessionCookie(config.secureCookies) });
}
