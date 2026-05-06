"use client";

import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CASE_TYPE_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { CaseStatus, SavedCase } from "@/lib/types";
import { clearCases, deleteCase, loadCases, updateCaseStatus } from "@/lib/caseStorage";
import { downloadTextFile, savedCaseToMarkdown } from "@/lib/export";
import { RiskBadge } from "@/components/RiskBadge";
import { appPath } from "@/lib/navigation";

const statuses = Object.keys(STATUS_LABELS) as CaseStatus[];

export function CaseBoard() {
  const [cases, setCases] = useState<SavedCase[]>([]);

  useEffect(() => {
    setCases(loadCases());
  }, []);

  function removeCase(id: string) {
    const ok = window.confirm("이 브라우저에 저장된 사건 기록을 삭제합니다. 내보내기 전이라면 복구할 수 없습니다.");
    if (ok) {
      setCases(deleteCase(id));
    }
  }

  function removeAllCases() {
    const ok = window.confirm("이 브라우저에 저장된 모든 사건 기록을 삭제합니다. 내보내기 전이라면 복구할 수 없습니다.");
    if (ok) {
      clearCases();
      setCases([]);
    }
  }

  if (!cases.length) {
    return (
      <div className="panel panel-tight">
        <span className="eyebrow">로컬 사건 보드</span>
        <h2>아직 저장한 사건이 없습니다.</h2>
        <p className="muted">진단 결과에서 "로컬 보드에 저장"을 누르면 이 브라우저 안에만 저장됩니다.</p>
        <a className="btn btn-primary" href={appPath("/")}>
          진단 시작하기
        </a>
      </div>
    );
  }

  return (
    <div className="card-stack">
      <div className="panel panel-tight">
        <span className="eyebrow">로컬 우선</span>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.8rem)", maxWidth: "14ch" }}>사건 보드</h1>
        <p className="lead">이 목록은 서버가 아니라 현재 브라우저 저장소에 있습니다. 저장본은 원문 URL을 숨기고, 만료된 기록은 로드 시 자동 정리됩니다.</p>
        <button className="btn btn-danger" type="button" onClick={removeAllCases}>
          <Trash2 size={16} aria-hidden="true" />
          전체 삭제
        </button>
      </div>
      <div className="board-grid">
        {cases.map((item) => (
          <article className="case-card" key={item.id}>
            <div className="badge-row">
              <RiskBadge risk={item.classification.riskLevel} />
              <span className="badge badge-green">{CASE_TYPE_LABELS[item.classification.caseType]}</span>
            </div>
            <div>
              <h3>{item.input.title}</h3>
              <p className="muted small">{item.classification.reason}</p>
              <p className="muted small">보관 기한: {new Date(item.expiresAt).toLocaleDateString("ko-KR")}</p>
            </div>
            <label className="field">
              <span className="hint">진행 상태</span>
              <select
                className="status-select"
                value={item.status}
                onChange={(event) => setCases(updateCaseStatus(item.id, event.target.value as CaseStatus))}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <ul className="action-list">
              {item.classification.followUpDays.map((day) => (
                <li key={day}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {day}일 후 재확인
                </li>
              ))}
            </ul>
            <p className="small muted">신고·고소 준비자료, 피해 확산 방지 매트릭스, {item.responsePack.legalSupport.title} 포함</p>
            <div className="button-row">
              <button className="btn btn-secondary" type="button" onClick={() => downloadTextFile(`jium-ai-${item.id}.md`, savedCaseToMarkdown(item))}>
                <Download size={16} aria-hidden="true" />
                내보내기
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => removeCase(item.id)}>
                <Trash2 size={16} aria-hidden="true" />
                삭제
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
