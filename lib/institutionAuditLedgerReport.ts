import {
  verifyInstitutionAuditLedger,
  type InstitutionAuditLedgerRecord,
  type InstitutionAuditLedgerVerification,
} from "@/lib/institutionAuditLedger";
import type { InstitutionAuditEventType, InstitutionAuditOutcome } from "@/lib/institutionAuditLog";

export type InstitutionAuditLedgerParseResult = {
  records: InstitutionAuditLedgerRecord[];
  errors: string[];
};

export type InstitutionAuditLedgerReport = {
  verification: InstitutionAuditLedgerVerification;
  parseErrors: string[];
  firstRecordedAt?: string;
  lastRecordedAt?: string;
  byEventType: Record<InstitutionAuditEventType, number>;
  byOutcome: Record<InstitutionAuditOutcome, number>;
  byOriginClassification: Record<string, number>;
  byOrganization: Record<string, number>;
  recentRecords: InstitutionAuditLedgerRecord[];
  safetyNotes: string[];
};

const MAX_RECENT_RECORDS = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function count<T extends string>(bucket: Record<T, number>, key: T) {
  bucket[key] = (bucket[key] || 0) + 1;
}

function sortRecords(records: InstitutionAuditLedgerRecord[]) {
  return [...records].sort((left, right) => left.sequence - right.sequence);
}

function asRecord(value: unknown, index: number, errors: string[]) {
  if (!isPlainObject(value)) {
    errors.push(`entry ${index + 1} is not a JSON object`);
    return null;
  }
  return value as InstitutionAuditLedgerRecord;
}

export function parseInstitutionAuditLedgerText(text: string): InstitutionAuditLedgerParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { records: [], errors: ["audit ledger text is empty"] };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      const errors: string[] = [];
      const records = parsed
        .map((entry, index) => asRecord(entry, index, errors))
        .filter((entry): entry is InstitutionAuditLedgerRecord => Boolean(entry));
      return { records, errors };
    }
  } catch {
    // Fall back to JSONL parsing below.
  }

  const errors: string[] = [];
  const records = trimmed
    .split(/\r?\n/)
    .map((line, index) => {
      try {
        return asRecord(JSON.parse(line), index, errors);
      } catch {
        errors.push(`line ${index + 1} is not valid JSON`);
        return null;
      }
    })
    .filter((entry): entry is InstitutionAuditLedgerRecord => Boolean(entry));

  return { records, errors };
}

export async function buildInstitutionAuditLedgerReport(text: string): Promise<InstitutionAuditLedgerReport> {
  const parsed = parseInstitutionAuditLedgerText(text);
  const records = sortRecords(parsed.records);
  const verification = parsed.errors.length
    ? { valid: false, errors: parsed.errors, recordCount: records.length }
    : await verifyInstitutionAuditLedger(records);
  const byEventType = {} as Record<InstitutionAuditEventType, number>;
  const byOutcome = {} as Record<InstitutionAuditOutcome, number>;
  const byOriginClassification: Record<string, number> = {};
  const byOrganization: Record<string, number> = {};

  records.forEach((record) => {
    count(byEventType, record.event.eventType);
    count(byOutcome, record.event.outcome);
    byOriginClassification[record.event.originClassification] = (byOriginClassification[record.event.originClassification] || 0) + 1;
    const organization = record.event.organizationName || "기관명 미기록";
    byOrganization[organization] = (byOrganization[organization] || 0) + 1;
  });

  return {
    verification,
    parseErrors: parsed.errors,
    firstRecordedAt: records[0]?.recordedAt,
    lastRecordedAt: records[records.length - 1]?.recordedAt,
    byEventType,
    byOutcome,
    byOriginClassification,
    byOrganization,
    recentRecords: records.slice(-MAX_RECENT_RECORDS).reverse(),
    safetyNotes: [
      "이 리포트는 credential 원문, 세션 토큰, 원문 URL, 초대링크, 계정 핸들, onion 주소, 이메일, 전화번호를 표시하지 않습니다.",
      "검증 실패 원장은 운영 증거로 덮어쓰지 말고 원본 파일을 보존한 뒤 관리자와 별도 조사해야 합니다.",
      "성공한 검증도 신원 특정이나 수사권한을 대신하지 않습니다. 기관 계정 감사 범위 확인용으로만 사용합니다.",
    ],
  };
}

export function formatInstitutionAuditLedgerReport(report: InstitutionAuditLedgerReport) {
  const lines = [
    "# 기관 인증 감사 원장 검증 리포트",
    "",
    `- 검증 상태: ${report.verification.valid ? "정상" : "확인 필요"}`,
    `- 기록 수: ${report.verification.recordCount}`,
    `- 첫 기록: ${report.firstRecordedAt || "없음"}`,
    `- 마지막 기록: ${report.lastRecordedAt || "없음"}`,
    `- 마지막 recordDigest: ${report.verification.lastRecordDigest || "없음"}`,
    "",
    "## 오류",
    report.verification.errors.length ? report.verification.errors.map((error) => `- ${error}`).join("\n") : "- 없음",
    "",
    "## 안전 메모",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}
