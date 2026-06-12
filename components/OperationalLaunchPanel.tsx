"use client";

import { ClipboardList, Download, FileJson, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  DEFAULT_LAUNCH_SURFACE,
  UNSAFE_LAUNCH_CONSOLE_IMPORT_ERROR,
  formatLaunchSurfaceMarkdown,
  parseOperationalLaunchConsoleJson,
  type LaunchSurface,
} from "@/lib/operationalLaunchSurface";
import { downloadTextFile } from "@/lib/export";

function statusBadge(status: string) {
  if (status === "READY" || status === "READY_FOR_GO_LIVE_ARCHIVE") {
    return "badge badge-green";
  }
  if (status === "BLOCKED") {
    return "badge badge-high";
  }
  return "badge badge-medium";
}

export function OperationalLaunchPanel() {
  const [jsonText, setJsonText] = useState("");
  const [importError, setImportError] = useState("");
  const [importedSurface, setImportedSurface] = useState<LaunchSurface | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const surface: LaunchSurface = importedSurface || DEFAULT_LAUNCH_SURFACE;
  const visibleLanes = surface.operatorRunOrder;

  function clearTextarea() {
    setJsonText("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
    }
    window.setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }
    }, 0);
  }

  function handleImport() {
    const value = textareaRef.current?.value || jsonText;
    const result = parseOperationalLaunchConsoleJson(value);
    if (result.error === UNSAFE_LAUNCH_CONSOLE_IMPORT_ERROR) {
      setImportedSurface(null);
      setImportError(`${UNSAFE_LAUNCH_CONSOLE_IMPORT_ERROR} 입력값은 저장하지 않고 비웠습니다.`);
      clearTextarea();
      return;
    }
    if (result.error || !result.surface) {
      setImportedSurface(null);
      setImportError(result.error || "가져올 launch console JSON이 없습니다.");
      return;
    }
    setJsonText(value);
    setImportError("");
    setImportedSurface(result.surface);
  }

  function handleReset() {
    clearTextarea();
    setImportError("");
    setImportedSurface(null);
  }

  return (
    <section className="panel panel-tight operational-launch-panel" aria-labelledby="operational-launch-title">
      <div className="trace-header">
        <span className="eyebrow">
          <ClipboardList size={15} aria-hidden="true" /> 운영 런치 콘솔
        </span>
        <span className={statusBadge(surface.summary.status)}>{surface.summary.status}</span>
      </div>
      <h2 id="operational-launch-title">남은 운영 단계를 한 화면에서 확인</h2>
      <p className="small muted">
        `npm run ops:launch-console -- --json` 결과를 붙여넣으면 담당 역할, P0 작업, 첫 검증 명령을 안전하게 요약합니다.
      </p>

      <div className="submission-summary-grid">
        <div className="submission-summary-item">READY {surface.summary.readyPhaseCount}/{surface.summary.phaseCount}</div>
        <div className="submission-summary-item">열린 작업 {surface.summary.openActionCount}</div>
        <div className="submission-summary-item">P0 {surface.summary.p0OpenActionCount}</div>
        <div className="submission-summary-item">승인 명령 {surface.summary.externalApprovalCommandCount}</div>
      </div>

      <label className="field">
        <span className="label-row">
          launch console JSON <span className="hint">선택 입력</span>
        </span>
        <textarea
          ref={textareaRef}
          className="textarea textarea-compact"
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value);
            setImportError("");
          }}
          placeholder='{"schema":"jium-operational-launch-console-v1", ...}'
        />
      </label>
      {importError ? <div className="notice-inline">{importError}</div> : null}

      <div className="launch-lane-grid">
        {visibleLanes.map((lane) => (
          <article className="launch-lane-card" key={lane.phaseId}>
            <div className="agency-workflow-head">
              <strong>{lane.title || lane.phaseId}</strong>
              <span className={statusBadge(lane.status)}>{lane.status}</span>
            </div>
            <p className="small muted">{lane.ownerRole}</p>
            <div className="agency-workflow-meta">
              <span>open {lane.openActionCount}</span>
              <span>P0 {lane.p0OpenActionCount}</span>
            </div>
            <p className="small">{lane.firstAction || "단계 리포트를 확인하세요."}</p>
            {lane.firstVerificationCommand ? <code className="command-chip">{lane.firstVerificationCommand}</code> : null}
          </article>
        ))}
      </div>

      <div className="button-row">
        <button className="btn btn-secondary" type="button" onClick={handleImport}>
          <FileJson size={16} aria-hidden="true" />
          JSON 반영
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => downloadTextFile("jium-ai-operational-launch-console.md", formatLaunchSurfaceMarkdown(surface))}
        >
          <Download size={16} aria-hidden="true" />
          요약 저장
        </button>
        <button className="btn btn-secondary" type="button" onClick={handleReset} disabled={!jsonText && !importedSurface && !importError}>
          <RotateCcw size={16} aria-hidden="true" />
          기본 보기
        </button>
        <span className="badge badge-green">
          <ShieldCheck size={14} aria-hidden="true" /> raw value 차단
        </span>
      </div>

      <div className="notice notice-safe">
        <Upload size={18} aria-hidden="true" />
        <div>
          <strong>운영값은 여기에 저장하지 않습니다.</strong>
          실제 URL, 연락처, 토큰, 초대 링크, onion 주소, 전화번호, private path가 들어간 JSON은 표시하지 않고 차단합니다.
        </div>
      </div>
    </section>
  );
}
