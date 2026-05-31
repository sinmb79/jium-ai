import type {
  InstitutionCapability,
  InstitutionEvidenceAccessScope,
  InstitutionRole,
} from "@/lib/institutionAuth";

export type InstitutionAuditEventType =
  | "INSTITUTION_LOGIN_SUCCESS"
  | "INSTITUTION_LOGIN_DENIED"
  | "INSTITUTION_SESSION_VERIFIED"
  | "INSTITUTION_SESSION_REJECTED"
  | "INSTITUTION_LOGOUT"
  | "INSTITUTION_LOGOUT_DENIED"
  | "INSTITUTION_AUDIT_LEDGER_VIEWED"
  | "INSTITUTION_AUDIT_LEDGER_VIEW_DENIED";

export type InstitutionAuditOutcome = "SUCCESS" | "DENIED";
export type InstitutionOriginClassification = "ALLOWED" | "REJECTED" | "MISSING" | "NOT_CONFIGURED";

export type InstitutionAuditEvent = {
  id: string;
  occurredAt: string;
  eventType: InstitutionAuditEventType;
  outcome: InstitutionAuditOutcome;
  reasonCode?: string;
  requestId: string;
  originClassification: InstitutionOriginClassification;
  organizationName?: string;
  subjectId?: string;
  role?: InstitutionRole;
  capabilityIds?: InstitutionCapability[];
  evidenceAccessScope?: InstitutionEvidenceAccessScope;
  sessionExpiresAt?: string;
  dataMinimization: string[];
};

export type InstitutionAuditInput = Omit<InstitutionAuditEvent, "id" | "occurredAt" | "dataMinimization"> & {
  occurredAt?: string;
};

export type InstitutionAuditSink = (event: InstitutionAuditEvent) => void | Promise<void>;

export const INSTITUTION_AUDIT_DATA_MINIMIZATION_RULES = [
  "No raw credential envelope",
  "No server session token",
  "No original URL, invite link, handle, onion address, email, or phone number",
  "Only pseudonymous subject, organization label, role, capability, outcome, and reason code",
];

const UNSAFE_AUDIT_MARKERS = [
  "http://",
  "https://",
  "discord.gg/",
  "t.me/",
  "telegram.me/",
  ".onion",
  "@",
];
const PHONE_PATTERN = /\b(?:\+82[-.\s]?)?0(?:1[016789]|2|[3-6]\d)[-.\s]?\d{3,4}[-.\s]?\d{4}\b/;
const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,80}$/;

function randomSuffix() {
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
}

function serialize(value: unknown) {
  return JSON.stringify(value ?? "").toLowerCase();
}

export function institutionAuditContainsUnsafeMarker(value: unknown) {
  const text = serialize(value);
  const markers = UNSAFE_AUDIT_MARKERS.filter((marker) => text.includes(marker));
  if (PHONE_PATTERN.test(text)) {
    markers.push("phone-like-number");
  }
  return markers;
}

export function safeInstitutionRequestId(value: string | null | undefined, now = Date.now()) {
  const trimmed = value?.trim();
  if (trimmed && SAFE_REQUEST_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return `req-${now}-${randomSuffix().slice(0, 12)}`;
}

export function classifyInstitutionRequestOrigin(
  origin: string | null | undefined,
  allowedOrigins: readonly string[] = [],
): InstitutionOriginClassification {
  if (!allowedOrigins.length) {
    return "NOT_CONFIGURED";
  }
  if (!origin) {
    return "MISSING";
  }
  return allowedOrigins.includes(origin) ? "ALLOWED" : "REJECTED";
}

export function assertInstitutionAuditEventSafe(event: InstitutionAuditEvent) {
  const markers = institutionAuditContainsUnsafeMarker(event);
  if (markers.length) {
    throw new Error(`institution audit event contains unsafe raw indicators: ${Array.from(new Set(markers)).join(", ")}`);
  }
}

export function createInstitutionAuditEvent(input: InstitutionAuditInput, now = Date.now()): InstitutionAuditEvent {
  const occurredAt = input.occurredAt || new Date(now).toISOString();
  const event: InstitutionAuditEvent = {
    ...input,
    id: `institution-audit-${Date.parse(occurredAt) || now}-${randomSuffix().slice(0, 12)}`,
    occurredAt,
    requestId: safeInstitutionRequestId(input.requestId, now),
    capabilityIds: input.capabilityIds ? Array.from(new Set(input.capabilityIds)).slice(0, 20) : undefined,
    dataMinimization: [...INSTITUTION_AUDIT_DATA_MINIMIZATION_RULES],
  };
  assertInstitutionAuditEventSafe(event);
  return event;
}

export async function emitInstitutionAuditEvent(
  sink: InstitutionAuditSink | undefined,
  event: InstitutionAuditEvent,
) {
  if (!sink) {
    return;
  }
  await sink(event);
}
