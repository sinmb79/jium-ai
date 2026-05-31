"use client";

import { Download, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatInstitutionAccountAdminReport,
  parseInstitutionAccountSessionsText,
  reviewInstitutionAccountSessions,
  type InstitutionAccountAdminReport,
} from "@/lib/institutionAccountAdmin";
import { downloadTextFile } from "@/lib/export";

const sampleSession = {
  sessions: [
    {
      sessionId: "srv-session-001",
      organizationId: "org-support-center-001",
      organizationName: "Authorized Support Center",
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    VALID: "운영 가능",
    INVALID: "검토 필요",
    EXPIRED: "만료",
    EXPIRING_SOON: "곧 만료",
  };
  return labels[status] || status;
}

export function InstitutionAccountAdminPanel() {
  const [sessionText, setSessionText] = useState("");
  const [report, setReport] = useState<InstitutionAccountAdminReport | null>(null);
  const [message, setMessage] = useState("");
  const markdown = useMemo(() => (report ? formatInstitutionAccountAdminReport(report) : ""), [report]);

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

  return (
    <div className="panel panel-tight institution-account-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <UsersRound size={15} aria-hidden="true" /> 기관 계정 관리자
        </span>
        <span className={report?.invalidCount || report?.expiredCount ? "badge badge-medium" : "badge badge-green"}>
          {report ? `${report.validCount}/${report.total} 운영 가능` : "세션 검토"}
        </span>
      </div>
      <p className="small muted">
        기관 세션 JSON을 붙여 넣어 role, capability, MFA, 만료, 식별자 노출 위험을 검토합니다. 계정 발급 도구가 아니라 운영 전 검토·감사용 보조 패널입니다.
      </p>

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
          계정 세션 검토
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
  );
}
