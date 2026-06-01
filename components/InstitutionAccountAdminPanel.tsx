"use client";

import { Download, RefreshCw, ShieldCheck, UserPlus, UserX, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatInstitutionAccountAdminReport,
  parseInstitutionAccountSessionsText,
  reviewInstitutionAccountSessions,
  type InstitutionAccountAdminReport,
} from "@/lib/institutionAccountAdmin";
import {
  INSTITUTION_ROLE_CAPABILITY_MATRIX,
  INSTITUTION_ROLES,
  isInstitutionCapability,
  type InstitutionCapability,
  type InstitutionEvidenceAccessScope,
  type InstitutionRole,
} from "@/lib/institutionAuth";
import type { InstitutionAccountProvisionInput, PublicInstitutionAccountView } from "@/lib/institutionAccountRegistry";
import {
  institutionAccountAdminHeaders,
  type InstitutionAccountAdminRequestBody,
  type InstitutionAccountAdminResponse,
} from "@/lib/institutionAccountProvisioningClient";
import { downloadTextFile } from "@/lib/export";

const DEFAULT_ACCOUNT_API_PATH = "/api/institution/accounts";

const sampleSession = {
  sessions: [
    {
      sessionId: "srv-session-001",
      organizationId: "org-support-center-001",
      organizationName: "공인 피해자 지원기관",
      subjectId: "operator:caseworker-001",
      role: "VICTIM_SUPPORT_CASEWORKER",
      assuranceLevel: "SERVER_SESSION",
      issuedAt: "2026-06-01T00:00:00.000Z",
      authenticatedAt: "2026-06-01T00:05:00.000Z",
      expiresAt: "2026-06-01T02:00:00.000Z",
      capabilityIds: ["AUTHORIZED_FEED_SUMMARY", "REDACTED_CASE_REVIEW", "OFFICIAL_PACKET_EXPORT"],
      evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
      limitations: ["비식별 사건 검토", "공식 제출 패킷 준비"],
    },
  ],
};

const roleLabels: Record<InstitutionRole, string> = {
  VICTIM_SUPPORT_CASEWORKER: "피해자 지원 담당자",
  LAW_ENFORCEMENT_LIAISON: "수사기관 협력 담당자",
  PLATFORM_TRUST_SAFETY: "플랫폼 안전 담당자",
  PROGRAM_ADMIN: "프로그램 관리자",
};

const scopeLabels: Record<InstitutionEvidenceAccessScope, string> = {
  REDACTED_ONLY: "비식별 요약만",
  ASSIGNED_CASE_REDACTED: "배정 사건 비식별 자료",
  OFFICIAL_REQUEST_ONLY: "공식 요청 기반",
};

const errorLabels: Record<string, string> = {
  INSTITUTION_SESSION_REQUIRED: "기관 관리자 서버 세션이 필요합니다. 서버 로그인 후 다시 시도하세요.",
  INSTITUTION_ACCOUNT_ADMIN_NOT_ALLOWED: "계정 발급·해지 권한이 있는 PROGRAM_ADMIN MFA 세션이 아닙니다.",
  CSRF_HEADER_REQUIRED: "계정 관리자 보호 헤더가 필요합니다.",
  ORIGIN_REQUIRED: "허용 Origin 검증이 필요합니다.",
  ORIGIN_NOT_ALLOWED: "허용되지 않은 Origin 요청입니다.",
  UNSUPPORTED_MEDIA_TYPE: "JSON 요청만 허용됩니다.",
  REQUEST_BODY_TOO_LARGE: "요청 본문이 너무 큽니다.",
  INVALID_JSON: "JSON 형식이 올바르지 않습니다.",
  UNSUPPORTED_ACCOUNT_ADMIN_ACTION: "지원하지 않는 계정 관리 작업입니다.",
  ACCOUNT_REGISTRY_OPERATION_FAILED: "계정 registry 작업이 실패했습니다. 입력값과 서버 저장소를 확인하세요.",
  ACCOUNT_REGISTRY_STORE_UNAVAILABLE: "서버 계정 registry 저장소가 설정되지 않았습니다.",
  SERVER_ROUTE_UNAVAILABLE: "서버 계정 Route가 없습니다. 서버 배포 모드에서 route를 materialize한 뒤 사용하세요.",
};

type ProvisionForm = {
  organizationId: string;
  organizationName: string;
  subjectId: string;
  role: InstitutionRole;
  evidenceAccessScope: InstitutionEvidenceAccessScope;
  expiresAt: string;
  capabilityText: string;
  notesText: string;
};

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    VALID: "운영 가능",
    INVALID: "검토 필요",
    EXPIRED: "만료",
    EXPIRING_SOON: "곧 만료",
    ACTIVE: "활성",
    SUSPENDED: "중지",
    REVOKED: "해지",
  };
  return labels[status] || status;
}

function splitLines(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCapabilityText(value: string): InstitutionCapability[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = trimmed.startsWith("[") ? (JSON.parse(trimmed) as unknown) : splitLines(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error("권한 목록은 JSON 배열이거나 줄바꿈/쉼표 목록이어야 합니다.");
  }
  const capabilities = Array.from(new Set(parsed.map((item) => String(item).trim()).filter(Boolean)));
  const invalid = capabilities.filter((capability) => !isInstitutionCapability(capability));
  if (invalid.length) {
    throw new Error(`지원하지 않는 권한입니다: ${invalid.join(", ")}`);
  }
  return capabilities as InstitutionCapability[];
}

function accountErrorMessage(data: InstitutionAccountAdminResponse, status: number) {
  if (data.ok) {
    return "";
  }
  const label = errorLabels[data.errorCode] || data.errorCode || `HTTP ${status}`;
  return data.message ? `${label} ${data.message}` : label;
}

function upsertAccount(accounts: PublicInstitutionAccountView[], account: PublicInstitutionAccountView) {
  const next = accounts.filter((item) => item.accountId !== account.accountId);
  return [...next, account].sort((left, right) => left.organizationName.localeCompare(right.organizationName) || left.subjectId.localeCompare(right.subjectId));
}

export function InstitutionAccountAdminPanel() {
  const [sessionText, setSessionText] = useState("");
  const [report, setReport] = useState<InstitutionAccountAdminReport | null>(null);
  const [message, setMessage] = useState("");
  const [accountApiPath, setAccountApiPath] = useState(DEFAULT_ACCOUNT_API_PATH);
  const [serverAccounts, setServerAccounts] = useState<PublicInstitutionAccountView[]>([]);
  const [serverUpdatedAt, setServerUpdatedAt] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [serverBusy, setServerBusy] = useState(false);
  const [revokeAccountId, setRevokeAccountId] = useState("");
  const [revokeReasonCode, setRevokeReasonCode] = useState("offboarding");
  const [form, setForm] = useState<ProvisionForm>({
    organizationId: "",
    organizationName: "",
    subjectId: "",
    role: "VICTIM_SUPPORT_CASEWORKER",
    evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    expiresAt: "",
    capabilityText: "",
    notesText: "",
  });

  const markdown = useMemo(() => (report ? formatInstitutionAccountAdminReport(report) : ""), [report]);
  const roleDefaultCapabilities = INSTITUTION_ROLE_CAPABILITY_MATRIX[form.role].join(", ");

  function updateForm<Key extends keyof ProvisionForm>(key: Key, value: ProvisionForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reviewSessions() {
    try {
      const sessions = parseInstitutionAccountSessionsText(sessionText);
      const nextReport = reviewInstitutionAccountSessions(sessions);
      setReport(nextReport);
      setMessage(nextReport.invalidCount || nextReport.expiredCount ? "기관 계정 검토가 필요한 항목이 있습니다." : "기관 계정 검토가 끝났습니다.");
    } catch (error) {
      setReport(null);
      setMessage(error instanceof Error ? error.message : "기관 계정 목록을 검토하지 못했습니다.");
    }
  }

  async function sendAccountAdminRequest(body: InstitutionAccountAdminRequestBody) {
    const endpoint = accountApiPath.trim();
    if (!endpoint) {
      throw new Error("계정 서버 API 경로가 필요합니다.");
    }
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: institutionAccountAdminHeaders(),
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({
      ok: false,
      errorCode: response.status === 404 ? "SERVER_ROUTE_UNAVAILABLE" : "INVALID_JSON",
    }))) as InstitutionAccountAdminResponse;
    if (!response.ok || !data.ok) {
      throw new Error(accountErrorMessage(data, response.status));
    }
    return data;
  }

  async function listServerAccounts() {
    setServerBusy(true);
    try {
      const data = await sendAccountAdminRequest({ action: "LIST" });
      setServerAccounts(data.accounts || []);
      setServerUpdatedAt(data.updatedAt || "");
      setServerMessage(`서버 계정 ${data.accounts?.length || 0}건을 불러왔습니다.`);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "서버 계정 목록을 불러오지 못했습니다.");
    } finally {
      setServerBusy(false);
    }
  }

  async function provisionAccount() {
    setServerBusy(true);
    try {
      const account: InstitutionAccountProvisionInput = {
        organizationId: form.organizationId.trim(),
        organizationName: form.organizationName.trim(),
        subjectId: form.subjectId.trim(),
        role: form.role,
        evidenceAccessScope: form.evidenceAccessScope,
        expiresAt: form.expiresAt.trim() || undefined,
        capabilityIds: parseCapabilityText(form.capabilityText),
        notes: splitLines(form.notesText),
      };
      const data = await sendAccountAdminRequest({ action: "PROVISION", account });
      if (data.account) {
        setServerAccounts((current) => upsertAccount(current, data.account!));
        setRevokeAccountId(data.account.accountId);
      }
      setServerMessage(`${data.account?.subjectId || account.subjectId} 계정을 발급했습니다.`);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "기관 계정을 발급하지 못했습니다.");
    } finally {
      setServerBusy(false);
    }
  }

  async function revokeAccount() {
    setServerBusy(true);
    try {
      const data = await sendAccountAdminRequest({
        action: "REVOKE",
        revocation: {
          accountId: revokeAccountId.trim(),
          reasonCode: revokeReasonCode.trim() || "manual-revocation",
        },
      });
      if (data.account) {
        setServerAccounts((current) => upsertAccount(current, data.account!));
      }
      setServerMessage(`${data.account?.subjectId || revokeAccountId} 계정을 해지했습니다.`);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "기관 계정을 해지하지 못했습니다.");
    } finally {
      setServerBusy(false);
    }
  }

  const canProvision = Boolean(form.organizationId.trim() && form.organizationName.trim() && form.subjectId.trim());
  const canRevoke = Boolean(revokeAccountId.trim());

  return (
    <div className="panel panel-tight institution-account-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <UsersRound size={15} aria-hidden="true" /> 기관 계정 관리자
        </span>
        <span className={report?.invalidCount || report?.expiredCount ? "badge badge-medium" : "badge badge-green"}>
          {serverAccounts.length ? `${serverAccounts.length}개 서버 계정` : report ? `${report.validCount}/${report.total} 운영 가능` : "서버 연결 대기"}
        </span>
      </div>

      <div className="account-admin-server">
        <label className="field">
          <span className="label-row">
            계정 서버 API <span className="hint">서버 배포 모드에서 HttpOnly 세션 쿠키 사용</span>
          </span>
          <input className="input" value={accountApiPath} onChange={(event) => setAccountApiPath(event.target.value)} placeholder={DEFAULT_ACCOUNT_API_PATH} />
        </label>
        <div className="button-row">
          <button className="btn btn-secondary" type="button" disabled={serverBusy} onClick={() => void listServerAccounts()}>
            <RefreshCw size={16} aria-hidden="true" />
            서버 목록 조회
          </button>
          {serverUpdatedAt ? <span className="small muted">registry 갱신 {serverUpdatedAt}</span> : null}
        </div>

        <div className="two-col">
          <label className="field">
            <span className="label-row">기관 ID</span>
            <input className="input" value={form.organizationId} onChange={(event) => updateForm("organizationId", event.target.value)} placeholder="org-support-center-001" />
          </label>
          <label className="field">
            <span className="label-row">기관명</span>
            <input className="input" value={form.organizationName} onChange={(event) => updateForm("organizationName", event.target.value)} placeholder="공인 피해자 지원기관" />
          </label>
          <label className="field">
            <span className="label-row">담당자 가명 ID</span>
            <input className="input" value={form.subjectId} onChange={(event) => updateForm("subjectId", event.target.value)} placeholder="operator:caseworker-001" />
          </label>
          <label className="field">
            <span className="label-row">역할</span>
            <select className="select" value={form.role} onChange={(event) => updateForm("role", event.target.value as InstitutionRole)}>
              {INSTITUTION_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label-row">증거 접근 범위</span>
            <select className="select" value={form.evidenceAccessScope} onChange={(event) => updateForm("evidenceAccessScope", event.target.value as InstitutionEvidenceAccessScope)}>
              {Object.entries(scopeLabels).map(([scope, label]) => (
                <option key={scope} value={scope}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label-row">만료시각 ISO</span>
            <input className="input" value={form.expiresAt} onChange={(event) => updateForm("expiresAt", event.target.value)} placeholder="2027-06-01T00:00:00.000Z" />
          </label>
        </div>

        <label className="field">
          <span className="label-row">
            권한 목록 <span className="hint">비우면 기본값: {roleDefaultCapabilities}</span>
          </span>
          <textarea className="textarea textarea-compact" value={form.capabilityText} onChange={(event) => updateForm("capabilityText", event.target.value)} placeholder="AUTHORIZED_FEED_SUMMARY&#10;REDACTED_CASE_REVIEW" />
        </label>
        <label className="field">
          <span className="label-row">운영 메모</span>
          <textarea className="textarea textarea-compact" value={form.notesText} onChange={(event) => updateForm("notesText", event.target.value)} placeholder="승인번호나 개인정보 대신 내부 승인 코드만 기록" />
        </label>
        <div className="button-row">
          <button className="btn btn-primary" type="button" disabled={serverBusy || !canProvision} onClick={() => void provisionAccount()}>
            <UserPlus size={16} aria-hidden="true" />
            계정 발급
          </button>
        </div>

        <div className="two-col">
          <label className="field">
            <span className="label-row">해지 accountId</span>
            <input className="input" value={revokeAccountId} onChange={(event) => setRevokeAccountId(event.target.value)} placeholder="iacct-..." />
          </label>
          <label className="field">
            <span className="label-row">해지 사유 코드</span>
            <input className="input" value={revokeReasonCode} onChange={(event) => setRevokeReasonCode(event.target.value)} placeholder="offboarding" />
          </label>
        </div>
        <div className="button-row">
          <button className="btn btn-danger" type="button" disabled={serverBusy || !canRevoke} onClick={() => void revokeAccount()}>
            <UserX size={16} aria-hidden="true" />
            계정 해지
          </button>
        </div>

        {serverAccounts.length ? (
          <ul className="action-list compact-list account-admin-list">
            {serverAccounts.map((account) => (
              <li key={account.accountId}>
                <span>
                  <strong>{account.organizationName}</strong> · {account.subjectId} · {roleLabels[account.role]} · {scopeLabels[account.evidenceAccessScope]}
                  <small>
                    {account.accountId} · {account.capabilityIds.join(", ")} · 갱신 {account.updatedAt}
                    {account.revokedReasonCode ? ` · 해지사유 ${account.revokedReasonCode}` : ""}
                  </small>
                </span>
                <button className="badge badge-low account-id-button" type="button" onClick={() => setRevokeAccountId(account.accountId)}>
                  {statusLabel(account.status)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {serverMessage ? <p className="small muted">{serverMessage}</p> : null}
      </div>

      <div className="account-admin-review">
        <label className="field">
          <span className="label-row">
            기관 세션 JSON <span className="hint">배열 또는 {"{"}sessions: []{"}"} 형식</span>
          </span>
          <textarea
            className="textarea textarea-compact"
            value={sessionText}
            onChange={(event) => {
              setSessionText(event.target.value);
              setReport(null);
            }}
            placeholder={JSON.stringify(sampleSession)}
          />
        </label>

        <div className="button-row">
          <button className="btn btn-secondary" type="button" disabled={!sessionText.trim()} onClick={reviewSessions}>
            <ShieldCheck size={16} aria-hidden="true" />
            세션 검토
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={!markdown}
            onClick={() => downloadTextFile("institution-account-admin-report.md", markdown)}
          >
            <Download size={16} aria-hidden="true" />
            리포트 저장
          </button>
        </div>

        {report ? (
          <div className="audit-ledger-review">
            <div className="submission-summary-grid">
              <div className="submission-summary-item">총 {report.total}건</div>
              <div className="submission-summary-item">운영 가능 {report.validCount}건</div>
              <div className="submission-summary-item">검토 필요 {report.invalidCount}건</div>
              <div className="submission-summary-item">고위험 {report.highRiskAccountCount}건</div>
            </div>
            {report.warnings.length ? (
              <ul className="action-list compact-list">
                {report.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <ul className="action-list compact-list">
              {report.entries.map((entry) => (
                <li key={`${entry.sessionId}-${entry.subjectId}`}>
                  {entry.organizationName} · {entry.subjectId} · {entry.role} · {statusLabel(entry.status)}
                  {entry.highRiskCapabilities.length ? ` · 고위험 ${entry.highRiskCapabilities.join(", ")}` : ""}
                  {entry.errors.length ? ` · 오류 ${entry.errors.length}건` : ""}
                </li>
              ))}
            </ul>
            <ul className="action-list compact-list">
              {report.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {message ? <p className="small muted">{message}</p> : null}
      </div>
    </div>
  );
}
