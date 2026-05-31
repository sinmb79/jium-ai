import {
  AUTHORIZED_FEED_CAPABILITIES,
  AUTHORIZED_FEED_SESSION_MS,
  isAuthorizedFeedCapability,
  type AuthorizedFeedCapability,
  type AuthorizedFeedOperatorSession,
} from "@/lib/authorizedFeedAccess";
import type { AuthorizedFeedValidationResult } from "@/lib/authorizedIntelligenceFeed";

export type InstitutionRole =
  | "VICTIM_SUPPORT_CASEWORKER"
  | "LAW_ENFORCEMENT_LIAISON"
  | "PLATFORM_TRUST_SAFETY"
  | "PROGRAM_ADMIN";

export type InstitutionAssuranceLevel = "LOCAL_SIGNED_CREDENTIAL" | "SERVER_SESSION" | "SERVER_SESSION_MFA";

export type InstitutionCapability =
  | AuthorizedFeedCapability
  | "REDACTED_CASE_REVIEW"
  | "OFFICIAL_PACKET_EXPORT"
  | "HANDOFF_STATUS_UPDATE"
  | "TRUSTED_KEY_REVIEW";

export type InstitutionEvidenceAccessScope = "REDACTED_ONLY" | "ASSIGNED_CASE_REDACTED" | "OFFICIAL_REQUEST_ONLY";

export type InstitutionAccountSession = {
  sessionId: string;
  organizationId: string;
  organizationName: string;
  subjectId: string;
  role: InstitutionRole;
  assuranceLevel: InstitutionAssuranceLevel;
  issuedAt: string;
  authenticatedAt: string;
  expiresAt: string;
  mfaVerifiedAt?: string;
  capabilityIds: InstitutionCapability[];
  evidenceAccessScope: InstitutionEvidenceAccessScope;
  limitations: string[];
};

export const INSTITUTION_ROLES: InstitutionRole[] = [
  "VICTIM_SUPPORT_CASEWORKER",
  "LAW_ENFORCEMENT_LIAISON",
  "PLATFORM_TRUST_SAFETY",
  "PROGRAM_ADMIN",
];

export const INSTITUTION_ASSURANCE_LEVELS: InstitutionAssuranceLevel[] = [
  "LOCAL_SIGNED_CREDENTIAL",
  "SERVER_SESSION",
  "SERVER_SESSION_MFA",
];

export const INSTITUTION_CAPABILITIES: InstitutionCapability[] = [
  ...AUTHORIZED_FEED_CAPABILITIES,
  "REDACTED_CASE_REVIEW",
  "OFFICIAL_PACKET_EXPORT",
  "HANDOFF_STATUS_UPDATE",
  "TRUSTED_KEY_REVIEW",
];

export const INSTITUTION_ROLE_CAPABILITY_MATRIX: Record<InstitutionRole, InstitutionCapability[]> = {
  VICTIM_SUPPORT_CASEWORKER: [
    "AUTHORIZED_FEED_SUMMARY",
    "REDACTED_CASE_REVIEW",
    "OFFICIAL_PACKET_EXPORT",
    "HANDOFF_STATUS_UPDATE",
  ],
  LAW_ENFORCEMENT_LIAISON: [
    "AUTHORIZED_FEED_SUMMARY",
    "REDACTED_CASE_REVIEW",
    "OFFICIAL_PACKET_EXPORT",
    "HANDOFF_STATUS_UPDATE",
  ],
  PLATFORM_TRUST_SAFETY: [
    "AUTHORIZED_FEED_IMPORT",
    "AUTHORIZED_FEED_SUMMARY",
    "AUTHORIZED_FEED_PURGE",
    "REDACTED_CASE_REVIEW",
    "HANDOFF_STATUS_UPDATE",
  ],
  PROGRAM_ADMIN: [
    "AUTHORIZED_FEED_IMPORT",
    "AUTHORIZED_FEED_SUMMARY",
    "AUTHORIZED_FEED_PURGE",
    "REDACTED_CASE_REVIEW",
    "OFFICIAL_PACKET_EXPORT",
    "HANDOFF_STATUS_UPDATE",
    "TRUSTED_KEY_REVIEW",
  ],
};

const MFA_REQUIRED_CAPABILITIES: InstitutionCapability[] = ["TRUSTED_KEY_REVIEW"];
const UNSAFE_ACCOUNT_MARKERS = ["http://", "https://", "discord.gg/", "t.me/", "telegram.me/", ".onion", "@", "010-"];

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compactList<T extends string>(values: readonly T[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))) as T[];
}

function containsUnsafeAccountMarker(value: unknown) {
  const serialized = JSON.stringify(value ?? "").toLowerCase();
  return UNSAFE_ACCOUNT_MARKERS.filter((marker) => serialized.includes(marker));
}

export function isInstitutionRole(value: unknown): value is InstitutionRole {
  return typeof value === "string" && INSTITUTION_ROLES.includes(value as InstitutionRole);
}

export function isInstitutionAssuranceLevel(value: unknown): value is InstitutionAssuranceLevel {
  return typeof value === "string" && INSTITUTION_ASSURANCE_LEVELS.includes(value as InstitutionAssuranceLevel);
}

export function isInstitutionCapability(value: unknown): value is InstitutionCapability {
  return typeof value === "string" && INSTITUTION_CAPABILITIES.includes(value as InstitutionCapability);
}

export function capabilitiesAllowedForInstitutionRole(role: InstitutionRole) {
  return INSTITUTION_ROLE_CAPABILITY_MATRIX[role];
}

export function validateInstitutionAccountSession(
  session: InstitutionAccountSession | null | undefined,
  now = Date.now(),
): AuthorizedFeedValidationResult {
  const errors: string[] = [];
  if (!session) {
    return { valid: false, errors: ["institution account session is required"] };
  }

  if (!session.sessionId?.trim()) {
    errors.push("sessionId is required");
  }
  if (!session.organizationId?.trim()) {
    errors.push("organizationId is required");
  }
  if (!session.organizationName?.trim()) {
    errors.push("organizationName is required");
  }
  if (!session.subjectId?.trim()) {
    errors.push("subjectId is required");
  }
  if (containsUnsafeAccountMarker({ organizationId: session.organizationId, subjectId: session.subjectId }).length) {
    errors.push("institution account identifiers must be pseudonymous and must not contain raw URLs, handles, invites, onion addresses, email addresses, or phone numbers");
  }

  if (!isInstitutionRole(session.role)) {
    errors.push("role is not supported");
  }
  if (!isInstitutionAssuranceLevel(session.assuranceLevel)) {
    errors.push("assuranceLevel is not supported");
  }

  const issuedAt = parseDate(session.issuedAt);
  const authenticatedAt = parseDate(session.authenticatedAt);
  const expiresAt = parseDate(session.expiresAt);
  const mfaVerifiedAt = session.mfaVerifiedAt ? parseDate(session.mfaVerifiedAt) : Number.NaN;

  if (!Number.isFinite(issuedAt)) {
    errors.push("issuedAt must be an ISO date");
  }
  if (!Number.isFinite(authenticatedAt)) {
    errors.push("authenticatedAt must be an ISO date");
  }
  if (!Number.isFinite(expiresAt)) {
    errors.push("expiresAt must be an ISO date");
  }
  if (Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && expiresAt <= issuedAt) {
    errors.push("expiresAt must be later than issuedAt");
  }
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    errors.push("institution account session has expired");
  }
  if (Number.isFinite(issuedAt) && Number.isFinite(authenticatedAt) && authenticatedAt < issuedAt) {
    errors.push("authenticatedAt must be later than issuedAt");
  }

  if (!Array.isArray(session.capabilityIds) || !session.capabilityIds.length) {
    errors.push("capabilityIds must include at least one institution capability");
  } else {
    const allowed = isInstitutionRole(session.role) ? capabilitiesAllowedForInstitutionRole(session.role) : [];
    compactList(session.capabilityIds).forEach((capability) => {
      if (!isInstitutionCapability(capability)) {
        errors.push(`unsupported institution capability: ${String(capability)}`);
      } else if (!allowed.includes(capability)) {
        errors.push(`${session.role} cannot use ${capability}`);
      }
      if (MFA_REQUIRED_CAPABILITIES.includes(capability)) {
        if (session.assuranceLevel !== "SERVER_SESSION_MFA") {
          errors.push(`${capability} requires SERVER_SESSION_MFA`);
        }
        if (!Number.isFinite(mfaVerifiedAt) || mfaVerifiedAt < authenticatedAt) {
          errors.push(`${capability} requires mfaVerifiedAt later than authenticatedAt`);
        }
      }
    });
  }

  if (!Array.isArray(session.limitations) || !compactList(session.limitations).length) {
    errors.push("limitations must include at least one operating boundary");
  }
  if (containsUnsafeAccountMarker(session.limitations).length) {
    errors.push("limitations must not contain raw operational indicators");
  }

  return { valid: errors.length === 0, errors };
}

export function canUseInstitutionCapability(
  session: InstitutionAccountSession | null | undefined,
  capability: InstitutionCapability,
  now = Date.now(),
) {
  return validateInstitutionAccountSession(session, now).valid && Boolean(session?.capabilityIds.includes(capability));
}

export function requireInstitutionCapability(
  session: InstitutionAccountSession | null | undefined,
  capability: InstitutionCapability,
  now = Date.now(),
) {
  const validation = validateInstitutionAccountSession(session, now);
  if (!validation.valid) {
    throw new Error(`Institution account session is not valid: ${validation.errors.join("; ")}`);
  }
  if (!session!.capabilityIds.includes(capability)) {
    throw new Error(`Institution account session does not include ${capability}`);
  }
  return session!;
}

export function institutionSessionToAuthorizedFeedOperatorSession(
  session: InstitutionAccountSession,
  now = Date.now(),
): AuthorizedFeedOperatorSession {
  const validation = validateInstitutionAccountSession(session, now);
  if (!validation.valid) {
    throw new Error(`Institution account session is not valid: ${validation.errors.join("; ")}`);
  }
  const feedCapabilities = compactList(session.capabilityIds).filter(isAuthorizedFeedCapability);
  if (!feedCapabilities.length) {
    throw new Error("Institution account session does not include authorized feed capabilities");
  }

  const expiresAt = Math.min(Date.parse(session.expiresAt), now + AUTHORIZED_FEED_SESSION_MS);
  return {
    role: "AUTHORIZED_OPERATOR",
    openedAt: now,
    lastActivityAt: now,
    expiresAt,
    capabilityIds: feedCapabilities as AuthorizedFeedCapability[],
    limitations: compactList([
      ...session.limitations,
      "서버 기반 기관 계정 세션 확인 완료",
      "피해자 UI에는 제한 피드 집계 요약만 표시",
      "원문 URL·초대링크·계정 핸들 저장 금지",
    ]),
    identity: {
      credentialId: session.sessionId.trim(),
      subjectId: session.subjectId.trim(),
      issuerName: session.organizationName.trim(),
      keyId: "server-session",
      credentialExpiresAt: new Date(Date.parse(session.expiresAt)).toISOString(),
      authenticatedAt: new Date(Date.parse(session.authenticatedAt)).toISOString(),
    },
  };
}
