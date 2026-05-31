import {
  openAuthorizedFeedOperatorSessionFromCredential,
  verifyAuthorizedOperatorCredential,
  type SignedAuthorizedOperatorCredential,
} from "@/lib/authorizedOperatorCredential";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import {
  createInstitutionSessionToken,
  verifyInstitutionSessionToken,
  type InstitutionSessionTokenKey,
} from "@/lib/institutionSessionToken";
import {
  serializeInstitutionSessionClearCookie,
  serializeInstitutionSessionCookie,
  type InstitutionSessionCookieOptions,
} from "@/lib/institutionSessionCookie";
import {
  validateInstitutionAccountSession,
  type InstitutionAccountSession,
  type InstitutionEvidenceAccessScope,
  type InstitutionRole,
} from "@/lib/institutionAuth";

export type InstitutionCredentialLoginOptions = {
  role?: InstitutionRole;
  organizationId?: string;
  evidenceAccessScope?: InstitutionEvidenceAccessScope;
  cookie?: InstitutionSessionCookieOptions;
  now?: number;
};

export type InstitutionCredentialLoginResult = {
  session: InstitutionAccountSession;
  token: string;
  setCookieHeader: string;
};

function defaultOrganizationId(issuerName: string) {
  return `org:${issuerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "authorized-partner"}`;
}

function tokenMaxAgeSeconds(session: InstitutionAccountSession, now: number) {
  const remaining = Math.floor((Date.parse(session.expiresAt) - now) / 1000);
  return Math.max(1, Math.min(remaining, 10 * 60));
}

export async function issueInstitutionSessionFromSignedCredential(
  credentialEnvelope: SignedAuthorizedOperatorCredential,
  trustedKeys: readonly TrustedAuthorizedFeedKey[],
  tokenKey: InstitutionSessionTokenKey,
  options: InstitutionCredentialLoginOptions = {},
): Promise<InstitutionCredentialLoginResult> {
  const now = options.now ?? Date.now();
  const credentialVerification = await verifyAuthorizedOperatorCredential(credentialEnvelope, trustedKeys, now);
  if (!credentialVerification.valid) {
    throw new Error(`Institution credential login failed: ${credentialVerification.errors.join("; ")}`);
  }

  const operatorSession = await openAuthorizedFeedOperatorSessionFromCredential(credentialEnvelope, trustedKeys, now);
  const session: InstitutionAccountSession = {
    sessionId: `srv-${operatorSession.identity!.credentialId}`,
    organizationId: options.organizationId || defaultOrganizationId(operatorSession.identity!.issuerName),
    organizationName: operatorSession.identity!.issuerName,
    subjectId: operatorSession.identity!.subjectId,
    role: options.role || "PLATFORM_TRUST_SAFETY",
    assuranceLevel: "SERVER_SESSION",
    issuedAt: new Date(now).toISOString(),
    authenticatedAt: new Date(now).toISOString(),
    expiresAt: operatorSession.identity!.credentialExpiresAt,
    capabilityIds: operatorSession.capabilityIds,
    evidenceAccessScope: options.evidenceAccessScope || "ASSIGNED_CASE_REDACTED",
    limitations: operatorSession.limitations,
  };
  const validation = validateInstitutionAccountSession(session, now);
  if (!validation.valid) {
    throw new Error(`Institution account session is not valid: ${validation.errors.join("; ")}`);
  }

  const token = await createInstitutionSessionToken(session, tokenKey, { tokenId: session.sessionId, now });
  const cookieOptions = options.cookie || { secure: true };
  return {
    session,
    token,
    setCookieHeader: serializeInstitutionSessionCookie(token, {
      ...cookieOptions,
      maxAgeSeconds: Math.min(cookieOptions.maxAgeSeconds ?? 10 * 60, tokenMaxAgeSeconds(session, now)),
    }),
  };
}

export async function verifyInstitutionSessionFromCookieToken(
  token: string,
  tokenKeys: readonly InstitutionSessionTokenKey[],
  now = Date.now(),
) {
  const verification = await verifyInstitutionSessionToken(token, tokenKeys, now);
  if (!verification.valid || !verification.session) {
    throw new Error(`Institution session cookie verification failed: ${verification.errors.join("; ")}`);
  }
  return verification.session;
}

export function clearInstitutionSessionCookie(secure: boolean) {
  return serializeInstitutionSessionClearCookie({ secure });
}
