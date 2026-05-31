"use client";

import { Download, FileCheck2, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildInstitutionAuditLedgerReport,
  formatInstitutionAuditLedgerReport,
  type InstitutionAuditLedgerReport,
} from "@/lib/institutionAuditLedgerReport";
import { downloadTextFile } from "@/lib/export";

function topEntries(values: Record<string, number>) {
  return Object.entries(values)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6);
}

function statusLabel(report: InstitutionAuditLedgerReport | null) {
  if (!report) {
    return "원장 미검증";
  }
  return report.verification.valid ? "체인 정상" : "확인 필요";
}

export function InstitutionAuditLedgerPanel() {
  const [ledgerText, setLedgerText] = useState("");
  const [report, setReport] = useState<InstitutionAuditLedgerReport | null>(null);
  const [message, setMessage] = useState("");

  const markdown = useMemo(() => (report ? formatInstitutionAuditLedgerReport(report) : ""), [report]);

  async function verifyLedger() {
    try {
      const nextReport = await buildInstitutionAuditLedgerReport(ledgerText);
      setReport(nextReport);
      setMessage(nextReport.verification.valid ? "감사 원장 해시 체인이 정상입니다." : "감사 원장 확인이 필요합니다.");
    } catch (error) {
      setReport(null);
      setMessage(error instanceof Error ? error.message : "감사 원장을 검증하지 못했습니다.");
    }
  }

  async function loadFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const text = await file.text();
    setLedgerText(text);
    setReport(null);
    setMessage(`${file.name} 파일을 불러왔습니다. 검증을 실행하세요.`);
  }

  return (
    <div className="panel panel-tight audit-ledger-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <FileCheck2 size={15} aria-hidden="true" /> 기관 감사 원장 검증
        </span>
        <span className={report?.verification.valid ? "badge badge-green" : "badge badge-medium"}>{statusLabel(report)}</span>
      </div>
      <p className="small muted">서버/데스크톱에서 내보낸 `institution-auth-audit-ledger.jsonl`을 붙여 넣거나 파일로 불러와 해시 체인을 검증합니다.</p>

      <label className="field">
        <span className="label-row">
          감사 원장 JSONL <span className="hint">원문 credential·세션 토큰 포함 금지</span>
        </span>
        <textarea
          className="textarea textarea-compact"
          value={ledgerText}
          onChange={(event) => {
            setLedgerText(event.target.value);
            setReport(null);
          }}
          placeholder='{"version":"jium-institution-audit-ledger-v1","sequence":1,"recordedAt":"..."}'
        />
      </label>

      <div className="button-row">
        <label className="btn btn-secondary">
          <FileCheck2 size={16} aria-hidden="true" />
          원장 파일 선택
          <input
            className="sr-only"
            type="file"
            accept=".jsonl,.json,application/json,text/plain"
            onChange={(event) => void loadFile(event.currentTarget.files?.[0])}
          />
        </label>
        <button className="btn btn-secondary" type="button" disabled={!ledgerText.trim()} onClick={() => void verifyLedger()}>
          <ShieldAlert size={16} aria-hidden="true" />
          원장 검증
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={!markdown}
          onClick={() => downloadTextFile("institution-audit-ledger-report.md", markdown)}
        >
          <Download size={16} aria-hidden="true" />
          리포트 저장
        </button>
      </div>

      {report ? (
        <div className="audit-ledger-review">
          <div className="submission-summary-grid">
            <div className="submission-summary-item">기록 {report.verification.recordCount}건</div>
            <div className="submission-summary-item">상태 {report.verification.valid ? "정상" : "확인 필요"}</div>
            <div className="submission-summary-item">첫 기록 {report.firstRecordedAt || "없음"}</div>
            <div className="submission-summary-item">마지막 기록 {report.lastRecordedAt || "없음"}</div>
          </div>
          {report.verification.errors.length ? (
            <ul className="action-list compact-list">
              {report.verification.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          <div className="authorized-feed-summary">
            <div>
              <strong>이벤트 유형</strong>
              <ul className="action-list compact-list">
                {topEntries(report.byEventType).map(([eventType, count]) => (
                  <li key={eventType}>
                    {eventType}: {count}건
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>결과</strong>
              <ul className="action-list compact-list">
                {topEntries(report.byOutcome).map(([outcome, count]) => (
                  <li key={outcome}>
                    {outcome}: {count}건
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <details className="audit-details">
            <summary>최근 감사 기록 {report.recentRecords.length}건</summary>
            <ul className="action-list compact-list">
              {report.recentRecords.map((record) => (
                <li key={record.recordDigest}>
                  #{record.sequence} · {record.event.eventType} · {record.event.outcome} · {record.event.organizationName || "기관명 미기록"} · {record.recordedAt}
                </li>
              ))}
            </ul>
          </details>
          <ul className="action-list compact-list">
            {report.safetyNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? <p className="small muted">{message}</p> : null}
    </div>
  );
}
