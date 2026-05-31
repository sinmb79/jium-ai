import { canonicalizeJson } from "@/lib/authorizedFeedSignature";
import {
  assertInstitutionAuditEventSafe,
  type InstitutionAuditEvent,
  type InstitutionAuditSink,
} from "@/lib/institutionAuditLog";

export const INSTITUTION_AUDIT_LEDGER_VERSION = "jium-institution-audit-ledger-v1";
export const INSTITUTION_AUDIT_LEDGER_GENESIS_DIGEST = "GENESIS";

export type InstitutionAuditLedgerRecord = {
  version: typeof INSTITUTION_AUDIT_LEDGER_VERSION;
  sequence: number;
  recordedAt: string;
  previousRecordDigest: string;
  eventDigest: string;
  recordDigest: string;
  event: InstitutionAuditEvent;
};

export type InstitutionAuditLedgerVerification = {
  valid: boolean;
  errors: string[];
  recordCount: number;
  lastRecordDigest?: string;
};

type InstitutionAuditLedgerRecordInput = Omit<InstitutionAuditLedgerRecord, "eventDigest" | "recordDigest">;

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requireSubtleCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto SubtleCrypto is required for institution audit ledger hashing");
  }
  return globalThis.crypto.subtle;
}

function normalizeAuditJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeAuditJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => typeof entry !== "undefined")
        .map(([key, entry]) => [key, normalizeAuditJson(entry)]),
    );
  }
  return value;
}

async function sha256Canonical(value: unknown) {
  const canonical = canonicalizeJson(normalizeAuditJson(value));
  const digest = await requireSubtleCrypto().digest("SHA-256", new TextEncoder().encode(canonical));
  return `sha256-${bytesToHex(digest)}`;
}

function recordSigningInput(record: InstitutionAuditLedgerRecordInput, eventDigest: string) {
  return {
    event: record.event,
    eventDigest,
    previousRecordDigest: record.previousRecordDigest,
    recordedAt: record.recordedAt,
    sequence: record.sequence,
    version: record.version,
  };
}

export async function createInstitutionAuditLedgerRecord(
  event: InstitutionAuditEvent,
  previousRecord?: InstitutionAuditLedgerRecord,
  now = Date.now(),
): Promise<InstitutionAuditLedgerRecord> {
  assertInstitutionAuditEventSafe(event);
  const baseRecord: InstitutionAuditLedgerRecordInput = {
    version: INSTITUTION_AUDIT_LEDGER_VERSION,
    sequence: previousRecord ? previousRecord.sequence + 1 : 1,
    recordedAt: new Date(now).toISOString(),
    previousRecordDigest: previousRecord?.recordDigest || INSTITUTION_AUDIT_LEDGER_GENESIS_DIGEST,
    event,
  };
  const eventDigest = await sha256Canonical(event);
  const recordDigest = await sha256Canonical(recordSigningInput(baseRecord, eventDigest));
  return {
    ...baseRecord,
    eventDigest,
    recordDigest,
  };
}

export async function appendInstitutionAuditLedgerRecord(
  records: readonly InstitutionAuditLedgerRecord[],
  event: InstitutionAuditEvent,
  now = Date.now(),
) {
  return createInstitutionAuditLedgerRecord(event, records[records.length - 1], now);
}

export function createInstitutionAuditLedgerSink(
  records: InstitutionAuditLedgerRecord[],
  options: { now?: () => number } = {},
): InstitutionAuditSink {
  return async (event) => {
    records.push(await appendInstitutionAuditLedgerRecord(records, event, options.now?.() ?? Date.now()));
  };
}

export async function verifyInstitutionAuditLedger(
  records: readonly InstitutionAuditLedgerRecord[],
): Promise<InstitutionAuditLedgerVerification> {
  const errors: string[] = [];
  let previousDigest = INSTITUTION_AUDIT_LEDGER_GENESIS_DIGEST;
  let lastRecordDigest: string | undefined;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const expectedSequence = index + 1;

    if (record.version !== INSTITUTION_AUDIT_LEDGER_VERSION) {
      errors.push(`record ${expectedSequence} has unsupported audit ledger version`);
    }
    if (record.sequence !== expectedSequence) {
      errors.push(`record ${expectedSequence} has invalid sequence`);
    }
    if (record.previousRecordDigest !== previousDigest) {
      errors.push(`record ${expectedSequence} does not link to the previous record digest`);
    }

    try {
      assertInstitutionAuditEventSafe(record.event);
      const expectedEventDigest = await sha256Canonical(record.event);
      if (record.eventDigest !== expectedEventDigest) {
        errors.push(`record ${expectedSequence} event digest mismatch`);
      }
      const expectedRecordDigest = await sha256Canonical(
        recordSigningInput(
          {
            version: record.version,
            sequence: record.sequence,
            recordedAt: record.recordedAt,
            previousRecordDigest: record.previousRecordDigest,
            event: record.event,
          },
          expectedEventDigest,
        ),
      );
      if (record.recordDigest !== expectedRecordDigest) {
        errors.push(`record ${expectedSequence} record digest mismatch`);
      }
      previousDigest = record.recordDigest;
      lastRecordDigest = record.recordDigest;
    } catch (error) {
      errors.push(error instanceof Error ? `record ${expectedSequence}: ${error.message}` : `record ${expectedSequence} failed verification`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    recordCount: records.length,
    lastRecordDigest,
  };
}
