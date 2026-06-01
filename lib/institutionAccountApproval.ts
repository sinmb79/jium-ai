export type InstitutionAccountApprovalScope = "PROVISION" | "PROGRAM_ADMIN_PROVISION" | "REVOKE";

export type InstitutionAccountApprovalInput = {
  approvalRef: string;
  approvedBySubjectId: string;
  approvedAt: string;
  expiresAt?: string;
  notes?: string[];
};

export type InstitutionAccountApprovalRecord = InstitutionAccountApprovalInput & {
  scope: InstitutionAccountApprovalScope;
};

const UNSAFE_APPROVAL_MARKERS = ["http://", "https://", "discord.gg/", "t.me/", "telegram.me/", ".onion", "@", "010-"];
const PHONE_PATTERN = /\b(?:\+82[-.\s]?)?0(?:1[016789]|2|[3-6]\d)[-.\s]?\d{3,4}[-.\s]?\d{4}\b/;
const SAFE_APPROVAL_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,80}$/;
const SAFE_APPROVER_SUBJECT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,120}$/;
const MAX_APPROVAL_FUTURE_SKEW_MS = 5 * 60 * 1000;

function clean(value?: string) {
  return value?.trim() || "";
}

function serialize(value: unknown) {
  return JSON.stringify(value ?? "").toLowerCase();
}

function unsafeMarkers(value: unknown) {
  const text = serialize(value);
  const markers = UNSAFE_APPROVAL_MARKERS.filter((marker) => text.includes(marker));
  if (PHONE_PATTERN.test(text)) {
    markers.push("phone-like-number");
  }
  return Array.from(new Set(markers));
}

function parseDate(value?: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compactList(values: readonly string[] = []) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function validateInstitutionAccountApproval(
  approval: InstitutionAccountApprovalRecord | null | undefined,
  options: {
    expectedScope: InstitutionAccountApprovalScope;
    operatorSubjectId?: string;
    now?: number;
  },
) {
  const errors: string[] = [];
  const now = options.now ?? Date.now();
  if (!approval) {
    return ["institution account approval is required"];
  }
  const approvalRef = clean(approval.approvalRef);
  const approvedBySubjectId = clean(approval.approvedBySubjectId);
  if (!approvalRef) {
    errors.push("approvalRef is required");
  } else if (!SAFE_APPROVAL_REF_PATTERN.test(approvalRef)) {
    errors.push("approvalRef must be a simple approval code");
  }
  if (!approvedBySubjectId) {
    errors.push("approvedBySubjectId is required");
  } else if (!SAFE_APPROVER_SUBJECT_PATTERN.test(approvedBySubjectId)) {
    errors.push("approvedBySubjectId must be a pseudonymous operator ID");
  }
  if (approval.scope !== options.expectedScope) {
    errors.push(`approval scope must be ${options.expectedScope}`);
  }
  const approvedAt = parseDate(approval.approvedAt);
  if (!Number.isFinite(approvedAt)) {
    errors.push("approvedAt must be an ISO date");
  } else if (approvedAt > now + MAX_APPROVAL_FUTURE_SKEW_MS) {
    errors.push("approvedAt must not be in the future");
  }
  if (approval.expiresAt) {
    const expiresAt = parseDate(approval.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      errors.push("approval expiresAt must be an ISO date when present");
    } else if (expiresAt <= now) {
      errors.push("approval has expired");
    }
  }
  if (options.operatorSubjectId && approvedBySubjectId && clean(options.operatorSubjectId).toLowerCase() === approvedBySubjectId.toLowerCase()) {
    errors.push("approval must be reviewed by a different operator");
  }
  const markers = unsafeMarkers({
    approvalRef,
    approvedBySubjectId,
    notes: approval.notes,
  });
  if (markers.length) {
    errors.push(`approval record must not contain raw identifiers: ${markers.join(", ")}`);
  }
  return errors;
}

export function normalizeInstitutionAccountApproval(
  approval: InstitutionAccountApprovalInput | null | undefined,
  options: {
    expectedScope: InstitutionAccountApprovalScope;
    operatorSubjectId?: string;
    now?: number;
  },
): InstitutionAccountApprovalRecord {
  if (!approval) {
    throw new Error("Institution account approval is required");
  }
  const record: InstitutionAccountApprovalRecord = {
    approvalRef: clean(approval.approvalRef),
    approvedBySubjectId: clean(approval.approvedBySubjectId),
    approvedAt: clean(approval.approvedAt),
    expiresAt: clean(approval.expiresAt) || undefined,
    notes: compactList(approval.notes),
    scope: options.expectedScope,
  };
  const errors = validateInstitutionAccountApproval(record, options);
  if (errors.length) {
    throw new Error(`Institution account approval is not valid: ${errors.join("; ")}`);
  }
  return record;
}
