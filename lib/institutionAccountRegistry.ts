import {
  INSTITUTION_ROLE_CAPABILITY_MATRIX,
  isInstitutionCapability,
  isInstitutionRole,
  type InstitutionCapability,
  type InstitutionEvidenceAccessScope,
  type InstitutionRole,
} from "@/lib/institutionAuth";
import {
  normalizeInstitutionAccountApproval,
  validateInstitutionAccountApproval,
  type InstitutionAccountApprovalInput,
  type InstitutionAccountApprovalRecord,
  type InstitutionAccountApprovalScope,
} from "@/lib/institutionAccountApproval";

export const INSTITUTION_ACCOUNT_REGISTRY_VERSION = "jium-institution-account-registry-v1";

export type InstitutionAccountStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export type InstitutionAccountRecord = {
  accountId: string;
  organizationId: string;
  organizationName: string;
  subjectId: string;
  role: InstitutionRole;
  capabilityIds: InstitutionCapability[];
  evidenceAccessScope: InstitutionEvidenceAccessScope;
  status: InstitutionAccountStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  issuedBySubjectId?: string;
  approval?: InstitutionAccountApprovalRecord;
  revokedAt?: string;
  revokedBySubjectId?: string;
  revokedReasonCode?: string;
  revocationApproval?: InstitutionAccountApprovalRecord;
  notes?: string[];
};

export type InstitutionAccountRegistry = {
  version: typeof INSTITUTION_ACCOUNT_REGISTRY_VERSION;
  updatedAt: string;
  accounts: InstitutionAccountRecord[];
};

export type InstitutionAccountProvisionInput = {
  organizationId: string;
  organizationName: string;
  subjectId: string;
  role: InstitutionRole;
  capabilityIds?: InstitutionCapability[];
  evidenceAccessScope?: InstitutionEvidenceAccessScope;
  expiresAt?: string;
  issuedBySubjectId?: string;
  approval: InstitutionAccountApprovalInput;
  notes?: string[];
};

export type InstitutionAccountRevocationInput = {
  accountId: string;
  revokedBySubjectId?: string;
  reasonCode?: string;
  approval: InstitutionAccountApprovalInput;
};

export type PublicInstitutionAccountView = Pick<
  InstitutionAccountRecord,
  | "accountId"
  | "organizationId"
  | "organizationName"
  | "subjectId"
  | "role"
  | "capabilityIds"
  | "evidenceAccessScope"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "expiresAt"
  | "approval"
  | "revokedAt"
  | "revokedReasonCode"
  | "revocationApproval"
>;

const UNSAFE_ACCOUNT_MARKERS = ["http://", "https://", "discord.gg/", "t.me/", "telegram.me/", ".onion", "@", "010-"];
const PHONE_PATTERN = /\b(?:\+82[-.\s]?)?0(?:1[016789]|2|[3-6]\d)[-.\s]?\d{3,4}[-.\s]?\d{4}\b/;
const SAFE_REASON_CODE_PATTERN = /^[a-zA-Z0-9._:-]{1,80}$/;

function clean(value?: string) {
  return value?.trim() || "";
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function compactList<T extends string>(values: readonly T[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))) as T[];
}

function serialize(value: unknown) {
  return JSON.stringify(value ?? "").toLowerCase();
}

function unsafeMarkers(value: unknown) {
  const text = serialize(value);
  const markers = UNSAFE_ACCOUNT_MARKERS.filter((marker) => text.includes(marker));
  if (PHONE_PATTERN.test(text)) {
    markers.push("phone-like-number");
  }
  return Array.from(new Set(markers));
}

function parseDate(value?: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function defaultCapabilities(role: InstitutionRole) {
  return INSTITUTION_ROLE_CAPABILITY_MATRIX[role].filter((capability) => !["TRUSTED_KEY_REVIEW", "INSTITUTION_AUDIT_LEDGER_REVIEW", "INSTITUTION_ACCOUNT_ADMIN"].includes(capability));
}

function defaultEvidenceScope(role: InstitutionRole): InstitutionEvidenceAccessScope {
  return role === "LAW_ENFORCEMENT_LIAISON" ? "OFFICIAL_REQUEST_ONLY" : "ASSIGNED_CASE_REDACTED";
}

function provisionApprovalScope(role: InstitutionRole): InstitutionAccountApprovalScope {
  return role === "PROGRAM_ADMIN" ? "PROGRAM_ADMIN_PROVISION" : "PROVISION";
}

export function emptyInstitutionAccountRegistry(now = Date.now()): InstitutionAccountRegistry {
  return {
    version: INSTITUTION_ACCOUNT_REGISTRY_VERSION,
    updatedAt: new Date(now).toISOString(),
    accounts: [],
  };
}

export function institutionAccountId(organizationId: string, subjectId: string) {
  return `iacct-${stableHash(`${clean(organizationId).toLowerCase()}|${clean(subjectId).toLowerCase()}`).toUpperCase()}`;
}

export function validateInstitutionAccountRecord(record: InstitutionAccountRecord | null | undefined, now = Date.now()) {
  const errors: string[] = [];
  if (!record) {
    return ["institution account record is required"];
  }
  if (!clean(record.accountId)) {
    errors.push("accountId is required");
  }
  if (!clean(record.organizationId)) {
    errors.push("organizationId is required");
  }
  if (!clean(record.organizationName)) {
    errors.push("organizationName is required");
  }
  if (!clean(record.subjectId)) {
    errors.push("subjectId is required");
  }
  const rawMarkers = unsafeMarkers({
    accountId: record.accountId,
    organizationId: record.organizationId,
    subjectId: record.subjectId,
    issuedBySubjectId: record.issuedBySubjectId,
    revokedBySubjectId: record.revokedBySubjectId,
  });
  if (rawMarkers.length) {
    errors.push(`institution account identifiers must be pseudonymous and safe: ${rawMarkers.join(", ")}`);
  }
  if (!isInstitutionRole(record.role)) {
    errors.push("role is not supported");
  }
  if (!["ACTIVE", "SUSPENDED", "REVOKED"].includes(record.status)) {
    errors.push("status is not supported");
  }
  if (!Array.isArray(record.capabilityIds) || !record.capabilityIds.length) {
    errors.push("capabilityIds must include at least one capability");
  } else {
    const allowed = isInstitutionRole(record.role) ? INSTITUTION_ROLE_CAPABILITY_MATRIX[record.role] : [];
    compactList(record.capabilityIds).forEach((capability) => {
      if (!isInstitutionCapability(capability)) {
        errors.push(`unsupported institution capability: ${String(capability)}`);
      } else if (!allowed.includes(capability)) {
        errors.push(`${record.role} cannot be provisioned with ${capability}`);
      }
    });
  }
  if (!["REDACTED_ONLY", "ASSIGNED_CASE_REDACTED", "OFFICIAL_REQUEST_ONLY"].includes(record.evidenceAccessScope)) {
    errors.push("evidenceAccessScope is not supported");
  }
  if (!Number.isFinite(parseDate(record.createdAt))) {
    errors.push("createdAt must be an ISO date");
  }
  if (!Number.isFinite(parseDate(record.updatedAt))) {
    errors.push("updatedAt must be an ISO date");
  }
  if (record.expiresAt && !Number.isFinite(parseDate(record.expiresAt))) {
    errors.push("expiresAt must be an ISO date when present");
  }
  if (record.revokedAt && !Number.isFinite(parseDate(record.revokedAt))) {
    errors.push("revokedAt must be an ISO date when present");
  }
  if (record.revokedReasonCode && !SAFE_REASON_CODE_PATTERN.test(record.revokedReasonCode)) {
    errors.push("revokedReasonCode must be a simple reason code");
  }
  if (record.notes?.length && unsafeMarkers(record.notes).length) {
    errors.push("notes must not contain raw URLs, handles, invites, onion addresses, emails, or phone numbers");
  }
  if (record.approval) {
    validateInstitutionAccountApproval(record.approval, {
      expectedScope: isInstitutionRole(record.role) ? provisionApprovalScope(record.role) : "PROVISION",
      operatorSubjectId: record.issuedBySubjectId,
      now,
    }).forEach((error) => errors.push(`approval: ${error}`));
  }
  if (record.revocationApproval) {
    validateInstitutionAccountApproval(record.revocationApproval, {
      expectedScope: "REVOKE",
      operatorSubjectId: record.revokedBySubjectId,
      now,
    }).forEach((error) => errors.push(`revocationApproval: ${error}`));
  }
  return errors;
}

export function validateInstitutionAccountRegistry(registry: InstitutionAccountRegistry, now = Date.now()) {
  const errors: string[] = [];
  if (registry.version !== INSTITUTION_ACCOUNT_REGISTRY_VERSION) {
    errors.push("unsupported institution account registry version");
  }
  if (!Number.isFinite(parseDate(registry.updatedAt))) {
    errors.push("updatedAt must be an ISO date");
  }
  if (!Array.isArray(registry.accounts)) {
    errors.push("accounts must be an array");
    return errors;
  }
  const accountIds = new Set<string>();
  const subjects = new Set<string>();
  registry.accounts.forEach((account, index) => {
    validateInstitutionAccountRecord(account, now).forEach((error) => errors.push(`account ${index + 1}: ${error}`));
    const accountId = clean(account.accountId).toLowerCase();
    const subjectKey = `${clean(account.organizationId).toLowerCase()}|${clean(account.subjectId).toLowerCase()}`;
    if (accountId) {
      if (accountIds.has(accountId)) {
        errors.push(`account ${index + 1}: duplicate accountId`);
      }
      accountIds.add(accountId);
    }
    if (subjectKey !== "|") {
      if (subjects.has(subjectKey)) {
        errors.push(`account ${index + 1}: duplicate organizationId+subjectId`);
      }
      subjects.add(subjectKey);
    }
  });
  return errors;
}

export function provisionInstitutionAccount(
  registry: InstitutionAccountRegistry,
  input: InstitutionAccountProvisionInput,
  now = Date.now(),
) {
  const issuedAt = new Date(now).toISOString();
  if (!isInstitutionRole(input.role)) {
    throw new Error("institution account role is not supported");
  }
  const capabilityIds = compactList(input.capabilityIds?.length ? input.capabilityIds : defaultCapabilities(input.role));
  const approval = normalizeInstitutionAccountApproval(input.approval, {
    expectedScope: provisionApprovalScope(input.role),
    operatorSubjectId: input.issuedBySubjectId,
    now,
  });
  const record: InstitutionAccountRecord = {
    accountId: institutionAccountId(input.organizationId, input.subjectId),
    organizationId: clean(input.organizationId),
    organizationName: clean(input.organizationName),
    subjectId: clean(input.subjectId),
    role: input.role,
    capabilityIds,
    evidenceAccessScope: input.evidenceAccessScope || defaultEvidenceScope(input.role),
    status: "ACTIVE",
    createdAt: issuedAt,
    updatedAt: issuedAt,
    expiresAt: clean(input.expiresAt) || undefined,
    issuedBySubjectId: clean(input.issuedBySubjectId) || undefined,
    approval,
    notes: compactList(input.notes || []),
  };
  const errors = validateInstitutionAccountRecord(record, now);
  if (errors.length) {
    throw new Error(`Institution account cannot be provisioned: ${errors.join("; ")}`);
  }
  const duplicate = registry.accounts.find(
    (account) =>
      account.accountId.toLowerCase() === record.accountId.toLowerCase() ||
      (account.organizationId.toLowerCase() === record.organizationId.toLowerCase() && account.subjectId.toLowerCase() === record.subjectId.toLowerCase()),
  );
  if (duplicate && duplicate.status !== "REVOKED") {
    throw new Error("Institution account already exists for this organization and subject");
  }
  const accounts = duplicate
    ? registry.accounts.map((account) => (account.accountId === duplicate.accountId ? { ...record, createdAt: duplicate.createdAt } : account))
    : [...registry.accounts, record];
  const nextRegistry: InstitutionAccountRegistry = {
    ...registry,
    version: INSTITUTION_ACCOUNT_REGISTRY_VERSION,
    updatedAt: issuedAt,
    accounts: accounts.sort((left, right) => left.organizationId.localeCompare(right.organizationId) || left.subjectId.localeCompare(right.subjectId)),
  };
  return {
    registry: nextRegistry,
    account: duplicate ? { ...record, createdAt: duplicate.createdAt } : record,
  };
}

export function revokeInstitutionAccount(
  registry: InstitutionAccountRegistry,
  input: InstitutionAccountRevocationInput,
  now = Date.now(),
) {
  const accountId = clean(input.accountId);
  const index = registry.accounts.findIndex((account) => account.accountId === accountId);
  if (index < 0) {
    throw new Error("Institution account was not found");
  }
  const revokedAt = new Date(now).toISOString();
  const reasonCode = clean(input.reasonCode) || "manual-revocation";
  if (!SAFE_REASON_CODE_PATTERN.test(reasonCode)) {
    throw new Error("revocation reasonCode must be a simple reason code");
  }
  const revocationApproval = normalizeInstitutionAccountApproval(input.approval, {
    expectedScope: "REVOKE",
    operatorSubjectId: input.revokedBySubjectId,
    now,
  });
  const revoked: InstitutionAccountRecord = {
    ...registry.accounts[index]!,
    status: "REVOKED",
    updatedAt: revokedAt,
    revokedAt,
    revokedBySubjectId: clean(input.revokedBySubjectId) || undefined,
    revokedReasonCode: reasonCode,
    revocationApproval,
  };
  const errors = validateInstitutionAccountRecord(revoked, now);
  if (errors.length) {
    throw new Error(`Institution account cannot be revoked: ${errors.join("; ")}`);
  }
  const accounts = registry.accounts.map((account, accountIndex) => (accountIndex === index ? revoked : account));
  const nextRegistry: InstitutionAccountRegistry = {
    ...registry,
    version: INSTITUTION_ACCOUNT_REGISTRY_VERSION,
    updatedAt: revokedAt,
    accounts,
  };
  return {
    registry: nextRegistry,
    account: revoked,
  };
}

export function publicInstitutionAccountView(account: InstitutionAccountRecord): PublicInstitutionAccountView {
  return {
    accountId: account.accountId,
    organizationId: account.organizationId,
    organizationName: account.organizationName,
    subjectId: account.subjectId,
    role: account.role,
    capabilityIds: account.capabilityIds,
    evidenceAccessScope: account.evidenceAccessScope,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    expiresAt: account.expiresAt,
    approval: account.approval,
    revokedAt: account.revokedAt,
    revokedReasonCode: account.revokedReasonCode,
    revocationApproval: account.revocationApproval,
  };
}
