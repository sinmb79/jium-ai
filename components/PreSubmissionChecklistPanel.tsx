"use client";

import { ClipboardCheck, Download, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { appendCaseAudit } from "@/lib/caseStorage";
import { downloadTextFile } from "@/lib/export";
import {
  buildPreSubmissionChecklistReport,
  formatPreSubmissionChecklistMarkdown,
  preSubmissionOwnerLabel,
  preSubmissionStatusLabel,
  type PreSubmissionCheckStatus,
  type PreSubmissionOverallStatus,
} from "@/lib/preSubmissionChecklist";
import type { SavedCase } from "@/lib/types";

function statusBadgeClass(status: PreSubmissionCheckStatus | PreSubmissionOverallStatus) {
  if (status === "READY_TO_SUBMIT" || status === "PASS") {
    return "badge badge-green";
  }
  if (status === "BLOCKED") {
    return "badge badge-high";
  }
  return "badge badge-medium";
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").slice(0, 64) || "case";
}

export function PreSubmissionChecklistPanel({ savedCase }: { savedCase: SavedCase }) {
  const report = useMemo(() => buildPreSubmissionChecklistReport(savedCase), [savedCase]);
  const markdown = useMemo(() => formatPreSubmissionChecklistMarkdown(report), [report]);

  return (
    <section className="trace-section" aria-labelledby="pre-submission-checklist-title">
      <h3 id="pre-submission-checklist-title">
        <ClipboardCheck size={17} aria-hidden="true" /> 제출 전 최종 검수
      </h3>
      <p className="muted small">
        수사·심의기관에 제출하기 직전, 보류해야 할 항목과 상담 검토 항목을 분리합니다. 이 검수표는 자동 제출이 아니라 피해자와 지원자가 공식 경로에서 최종 확인하도록 돕는 안전장치입니다.
      </p>

      <div className="submission-summary-grid">
        <div className="submission-summary-item">상태 {preSubmissionStatusLabel(report.overallStatus)}</div>
        <div className="submission-summary-item">점수 {report.score}점</div>
        <div className="submission-summary-item">제출 보류 {report.blockers.length}건</div>
        <div className="submission-summary-item">검토 필요 {report.reviewItems.length}건</div>
      </div>

      <div className="badge-row">
        <span className={statusBadgeClass(report.overallStatus)}>{preSubmissionStatusLabel(report.overallStatus)}</span>
        {report.targets.slice(0, 2).map((target) => (
          <span className="badge badge-low" key={target.agencyName}>
            {target.agencyName} {target.readinessScore}점
          </span>
        ))}
      </div>

      {report.blockers.length ? (
        <div className="notice notice-critical">
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <strong>제출 전 보강이 필요합니다.</strong>
            <p className="small muted">{report.blockers[0]?.detail}</p>
          </div>
        </div>
      ) : (
        <div className="notice notice-safe">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>핵심 제출 조건은 통과했습니다.</strong>
            <p className="small muted">검토 필요 항목은 공식기관 또는 상담자에게 미상·확인 필요로 분리해 설명하세요.</p>
          </div>
        </div>
      )}

      <div className="two-col">
        <div>
          <strong>제출 보류</strong>
          <ul className="action-list compact-list">
            {report.blockers.length ? (
              report.blockers.slice(0, 5).map((item) => (
                <li key={item.id}>
                  {item.label}: {item.detail}
                </li>
              ))
            ) : (
              <li>보류 항목 없음</li>
            )}
          </ul>
        </div>
        <div>
          <strong>검토 필요</strong>
          <ul className="action-list compact-list">
            {report.reviewItems.length ? (
              report.reviewItems.slice(0, 5).map((item) => (
                <li key={item.id}>
                  {item.label}: {preSubmissionOwnerLabel(item.owner)}
                </li>
              ))
            ) : (
              <li>검토 항목 없음</li>
            )}
          </ul>
        </div>
      </div>

      <ul className="action-list compact-list">
        {report.nextActions.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="button-row">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            appendCaseAudit(savedCase.id, "PRE_SUBMISSION_CHECKLIST_EXPORTED", "수사·심의기관 제출 전 최종 검수표 저장");
            downloadTextFile(`jium-ai-pre-submission-checklist-${safeName(savedCase.id)}.md`, markdown);
          }}
        >
          <Download size={16} aria-hidden="true" />
          검수표 저장
        </button>
      </div>
    </section>
  );
}
