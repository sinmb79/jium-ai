"use client";

import { Brain, Clipboard, Download, ExternalLink, FileCheck2, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { appendCaseAudit } from "@/lib/caseStorage";
import { downloadTextFile } from "@/lib/export";
import { buildAnonymizedLearningRecord, saveLearningRecord } from "@/lib/learningStore";
import { buildSafeSearchActions } from "@/lib/searchConnectors";
import { buildSubmissionConnectorActions } from "@/lib/submissionConnectors";
import { buildSubmissionPacket, submissionPacketWithEvidenceToMarkdown } from "@/lib/submissionPacket";
import type { SavedCase } from "@/lib/types";

export function SubmissionPacketPanel({ savedCase }: { savedCase: SavedCase }) {
  const [copied, setCopied] = useState(false);
  const [learned, setLearned] = useState(false);
  const packet = useMemo(
    () => buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack),
    [savedCase.classification, savedCase.input, savedCase.responsePack],
  );
  const markdown = useMemo(() => submissionPacketWithEvidenceToMarkdown(savedCase.input, packet), [packet, savedCase.input]);
  const searchActions = useMemo(() => buildSafeSearchActions(packet.discoveryPlan).slice(0, 6), [packet.discoveryPlan]);
  const connectorActions = useMemo(() => buildSubmissionConnectorActions(packet).slice(0, 4), [packet]);
  const officialOnlyCount = packet.discoveryPlan.matchChannels.filter((channel) => channel.authority === "OFFICIAL_ONLY" || channel.authority === "SPECIALIST_ONLY").length;

  return (
    <div className="panel panel-tight submission-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <FileCheck2 size={15} aria-hidden="true" /> 기관 제출 패킷
        </span>
        <div className="badge-row">
          <span className="badge badge-low">증거 {packet.evidenceSummaries.length}건</span>
          <span className="badge badge-medium">인계 {officialOnlyCount}건</span>
        </div>
      </div>

      <div className="submission-summary-grid">
        {packet.caseSummary.slice(0, 4).map((item) => (
          <div className="submission-summary-item" key={item}>
            {item}
          </div>
        ))}
      </div>

      <section className="trace-section" aria-labelledby="submission-research-title">
        <h3 id="submission-research-title">리서치·매칭 계획</h3>
        <p className="muted small">{packet.discoveryPlan.summary}</p>
        <ul className="action-list compact-list">
          {packet.discoveryPlan.matchChannels.slice(0, 5).map((channel) => (
            <li key={channel.id}>
              {channel.label} · {channel.authority} · {channel.severity}
            </li>
          ))}
        </ul>
      </section>

      <section className="trace-section" aria-labelledby="submission-gaps-title">
        <h3 id="submission-gaps-title">보강 필요 항목</h3>
        <ul className="action-list compact-list">
          {packet.evidenceGaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>

      {searchActions.length ? (
        <section className="trace-section" aria-labelledby="safe-search-title">
          <h3 id="safe-search-title">
            <Search size={17} aria-hidden="true" /> 안전 공개검색
          </h3>
          <div className="connector-list">
            {searchActions.map((action) => (
              <a className="connector-link" key={action.id} href={action.url} target="_blank" rel="noreferrer">
                <span>{action.label}</span>
                <small>{action.query}</small>
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="small muted">검색 결과는 사용자가 직접 확인합니다. 제목, 스니펫, URL만 기록하고 피해물 원본은 열람·다운로드하지 않습니다.</p>
        </section>
      ) : null}

      {connectorActions.length ? (
        <section className="trace-section" aria-labelledby="official-connector-title">
          <h3 id="official-connector-title">
            <ExternalLink size={17} aria-hidden="true" /> 공식 제출 커넥터
          </h3>
          <div className="connector-list">
            {connectorActions.map((action) => (
              <a className="connector-link" key={action.id} href={action.url} target="_blank" rel="noreferrer">
                <span>{action.targetName}</span>
                <small>{action.mode}</small>
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="small muted">자동 제출이 아니라 공식 화면을 여는 커넥터입니다. 제출 전 패킷 내용을 사용자가 확인해야 합니다.</p>
        </section>
      ) : null}

      <div className="notice notice-safe">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>수사권한 분리</strong>
          IP, 가입자 정보, 결제·암호화폐 흐름, 폐쇄형 채널 내부 확인은 수사기관 또는 법원 절차가 필요한 항목으로 패킷에 분리 표시됩니다.
        </div>
      </div>

      <div className="button-row">
        <button
          className="btn btn-primary"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(markdown);
            appendCaseAudit(savedCase.id, "SUBMISSION_PACKET_COPIED", "기관 제출 패킷을 클립보드로 복사");
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Clipboard size={17} aria-hidden="true" />
          {copied ? "복사됨" : "제출 패킷 복사"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            appendCaseAudit(savedCase.id, "SUBMISSION_PACKET_DOWNLOADED", "기관 제출 패킷을 Markdown으로 내려받음");
            downloadTextFile(`jium-ai-submission-${savedCase.id}.md`, markdown);
          }}
        >
          <Download size={17} aria-hidden="true" />
          제출 패킷 내려받기
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            saveLearningRecord(buildAnonymizedLearningRecord(savedCase));
            appendCaseAudit(savedCase.id, "LEARNING_RECORD_SAVED", "비식별 패턴 학습 기록 저장");
            setLearned(true);
          }}
        >
          <Brain size={17} aria-hidden="true" />
          {learned ? "학습 저장됨" : "비식별 패턴 학습"}
        </button>
      </div>
    </div>
  );
}
