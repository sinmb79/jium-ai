import {
  INSTITUTION_CAPABILITIES,
  INSTITUTION_ROLES,
  validateInstitutionAccountSession,
  type InstitutionAccountSession,
  type InstitutionCapability,
  type InstitutionRole,
} from "@/lib/institutionAuth";

export type InstitutionAccountReviewStatus = "VALID" | "INVALID" | "EXPIRED" | "EXPIRING_SOON";

export type InstitutionAccountReviewEntry = {
  sessionId: string;
  organizationName: string;
  subjectId: string;
  role: InstitutionRole | "UNKNOWN";
  assuranceLevel: string;
  status: InstitutionAccountReviewStatus;
  capabilityIds: string[];
  highRiskCapabilities: InstitutionCapability[];
  evidenceAccessScope: string;
  expiresAt?: string;
  minutesUntilExpiry?: number;
  errors: string[];
  warnings: string[];
};

export type InstitutionAccountAdminReport = {
  generatedAt: string;
  total: number;
  validCount: number;
  invalidCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  highRiskAccountCount: number;
  roleCounts: Record<string, number>;
  capabilityCounts: Record<string, number>;
  entries: InstitutionAccountReviewEntry[];
  warnings: string[];
  checklist: string[];
};

const HIGH_RISK_CAPABILITIES: InstitutionCapability[] = ["INSTITUTION_ACCOUNT_ADMIN", "TRUSTED_KEY_REVIEW", "INSTITUTION_AUDIT_LEDGER_REVIEW"];
const MINUTE_MS = 60 * 1000;

function parseDate(value?: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function countBy(values: readonly string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function compactCapabilities(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function statusForSession(
  validationErrors: readonly string[],
  expiresAt: number,
  now: number,
  expiringWithinMinutes: number,
): InstitutionAccountReviewStatus {
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    return "EXPIRED";
  }
  if (validationErrors.length) {
    return "INVALID";
  }
  if (Number.isFinite(expiresAt) && expiresAt - now <= expiringWithinMinutes * MINUTE_MS) {
    return "EXPIRING_SOON";
  }
  return "VALID";
}

export function parseInstitutionAccountSessionsText(text: string): InstitutionAccountSession[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as InstitutionAccountSession[];
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { sessions?: unknown }).sessions)) {
    return (parsed as { sessions: InstitutionAccountSession[] }).sessions;
  }
  throw new Error("institution account JSON must be an array or include a sessions array");
}

export function reviewInstitutionAccountSessions(
  sessions: readonly InstitutionAccountSession[],
  options: { now?: number; expiringWithinMinutes?: number } = {},
): InstitutionAccountAdminReport {
  const now = options.now ?? Date.now();
  const expiringWithinMinutes = options.expiringWithinMinutes ?? 60;
  const entries = sessions.map<InstitutionAccountReviewEntry>((session) => {
    const validation = validateInstitutionAccountSession(session, now);
    const expiresAt = parseDate(session.expiresAt);
    const capabilityIds = compactCapabilities(session.capabilityIds || []);
    const highRiskCapabilities = capabilityIds.filter((capability): capability is InstitutionCapability =>
      HIGH_RISK_CAPABILITIES.includes(capability as InstitutionCapability),
    );
    const warnings: string[] = [];
    const minutesUntilExpiry = Number.isFinite(expiresAt) ? Math.ceil((expiresAt - now) / MINUTE_MS) : undefined;
    const status = statusForSession(validation.errors, expiresAt, now, expiringWithinMinutes);

    if (status === "EXPIRING_SOON") {
      warnings.push(`${expiringWithinMinutes}분 이내 만료되는 기관 세션입니다.`);
    }
    if (highRiskCapabilities.length) {
      warnings.push("고위험 권한이 포함되어 있어 PROGRAM_ADMIN MFA와 승인 기록 확인이 필요합니다.");
    }
    if (session.evidenceAccessScope === "OFFICIAL_REQUEST_ONLY") {
      warnings.push("공식 요청 기반 증거 접근 범위입니다. 사건별 요청번호와 법적 근거를 별도 기록하세요.");
    }
    if (!INSTITUTION_ROLES.includes(session.role)) {
      warnings.push("알 수 없는 기관 역할입니다.");
    }

    return {
      sessionId: session.sessionId || "missing-session-id",
      organizationName: session.organizationName || "미확인 기관",
      subjectId: session.subjectId || "missing-subject",
      role: INSTITUTION_ROLES.includes(session.role) ? session.role : "UNKNOWN",
      assuranceLevel: session.assuranceLevel || "UNKNOWN",
      status,
      capabilityIds,
      highRiskCapabilities,
      evidenceAccessScope: session.evidenceAccessScope || "UNKNOWN",
      expiresAt: session.expiresAt,
      minutesUntilExpiry,
      errors: validation.errors,
      warnings,
    };
  });

  const validCount = entries.filter((entry) => entry.status === "VALID" || entry.status === "EXPIRING_SOON").length;
  const invalidCount = entries.filter((entry) => entry.status === "INVALID").length;
  const expiredCount = entries.filter((entry) => entry.status === "EXPIRED").length;
  const expiringSoonCount = entries.filter((entry) => entry.status === "EXPIRING_SOON").length;
  const highRiskAccountCount = entries.filter((entry) => entry.highRiskCapabilities.length).length;
  const warnings: string[] = [];

  if (invalidCount) {
    warnings.push(`검토가 필요한 기관 세션 ${invalidCount}건이 있습니다.`);
  }
  if (expiredCount) {
    warnings.push(`만료된 기관 세션 ${expiredCount}건은 즉시 폐기하거나 재발급해야 합니다.`);
  }
  if (highRiskAccountCount) {
    warnings.push(`고위험 권한 포함 세션 ${highRiskAccountCount}건은 별도 승인 기록과 MFA 확인이 필요합니다.`);
  }
  if (!validCount) {
    warnings.push("운영 가능한 기관 세션이 없습니다.");
  }

  return {
    generatedAt: new Date(now).toISOString(),
    total: entries.length,
    validCount,
    invalidCount,
    expiredCount,
    expiringSoonCount,
    highRiskAccountCount,
    roleCounts: countBy(entries.map((entry) => entry.role)),
    capabilityCounts: countBy(entries.flatMap((entry) => entry.capabilityIds.filter((capability) => INSTITUTION_CAPABILITIES.includes(capability as InstitutionCapability)))),
    entries: entries.sort((left, right) => left.organizationName.localeCompare(right.organizationName) || left.subjectId.localeCompare(right.subjectId)),
    warnings,
    checklist: [
      "기관 subjectId가 이메일, 전화번호, 초대링크, 원문 URL이 아닌 가명 ID인지 확인",
      "TRUSTED_KEY_REVIEW와 INSTITUTION_AUDIT_LEDGER_REVIEW는 PROGRAM_ADMIN MFA 승인 기록을 대조",
      "만료 또는 60분 이내 만료 세션은 재발급 또는 폐기 절차로 분리",
      "OFFICIAL_REQUEST_ONLY 접근은 사건별 요청번호와 법적 근거를 별도 제출 문서에 연결",
    ],
  };
}

export function formatInstitutionAccountAdminReport(report: InstitutionAccountAdminReport) {
  const lines = [
    "# 기관 계정 관리자 검토 리포트",
    "",
    `생성시각: ${report.generatedAt}`,
    `총 세션: ${report.total}`,
    `운영 가능: ${report.validCount}`,
    `검토 필요: ${report.invalidCount}`,
    `만료: ${report.expiredCount}`,
    `곧 만료: ${report.expiringSoonCount}`,
    `고위험 권한 포함: ${report.highRiskAccountCount}`,
    "",
    "## 경고",
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- 없음"]),
    "",
    "## 세션",
    ...report.entries.flatMap((entry) => [
      `- ${entry.organizationName} / ${entry.subjectId} / ${entry.role} / ${entry.status}`,
      `  - sessionId: ${entry.sessionId}`,
      `  - assurance: ${entry.assuranceLevel}`,
      `  - evidenceAccessScope: ${entry.evidenceAccessScope}`,
      `  - expiresAt: ${entry.expiresAt || "미기록"}`,
      `  - capabilities: ${entry.capabilityIds.join(", ") || "없음"}`,
      ...(entry.errors.length ? entry.errors.map((error) => `  - error: ${error}`) : []),
      ...(entry.warnings.length ? entry.warnings.map((warning) => `  - warning: ${warning}`) : []),
    ]),
    "",
    "## 운영 체크리스트",
    ...report.checklist.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
}
