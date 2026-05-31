"use client";

import { Brain, Clipboard, Download, ExternalLink, FileCheck2, GitCompareArrows, Landmark, Save, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { appendCaseAudit } from "@/lib/caseStorage";
import { downloadBytesFile, downloadFile, downloadTextFile } from "@/lib/export";
import { buildAnonymizedLearningRecord, saveLearningRecord } from "@/lib/learningStore";
import { buildSafeSearchActions } from "@/lib/searchConnectors";
import { buildSubmissionConnectorActions } from "@/lib/submissionConnectors";
import { buildPrintableSubmissionHtml, buildSubmissionPackageZip } from "@/lib/submissionPackage";
import { buildSubmissionPacket, submissionPacketWithEvidenceToMarkdown } from "@/lib/submissionPacket";
import {
  buildSubmissionPacketSnapshot,
  compareSubmissionPacketSnapshots,
  latestSubmissionPacketSnapshot,
  saveSubmissionPacketSnapshot,
  submissionPacketDiffToMarkdown,
  type SubmissionPacketDiff,
} from "@/lib/submissionVersioning";
import type { SavedCase } from "@/lib/types";

export function SubmissionPacketPanel({ savedCase }: { savedCase: SavedCase }) {
  const [copied, setCopied] = useState(false);
  const [learned, setLearned] = useState(false);
  const [versionMessage, setVersionMessage] = useState("");
  const [versionDiff, setVersionDiff] = useState<SubmissionPacketDiff | null>(null);
  const packet = useMemo(
    () => buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack),
    [savedCase.classification, savedCase.input, savedCase.responsePack],
  );
  const markdown = useMemo(() => submissionPacketWithEvidenceToMarkdown(savedCase.input, packet), [packet, savedCase.input]);
  const searchActions = useMemo(() => buildSafeSearchActions(packet.discoveryPlan).slice(0, 6), [packet.discoveryPlan]);
  const connectorActions = useMemo(() => buildSubmissionConnectorActions(packet).slice(0, 4), [packet]);
  const agencyRecommendations = useMemo(() => packet.agencyWorkflowPlan.recommendations.slice(0, 4), [packet.agencyWorkflowPlan.recommendations]);
  const officialOnlyCount = packet.discoveryPlan.matchChannels.filter((channel) => channel.authority === "OFFICIAL_ONLY" || channel.authority === "SPECIALIST_ONLY").length;

  function currentSnapshot() {
    return buildSubmissionPacketSnapshot(savedCase, packet);
  }

  function saveVersionSnapshot() {
    const snapshot = saveSubmissionPacketSnapshot(currentSnapshot());
    appendCaseAudit(savedCase.id, "SUBMISSION_VERSION_SAVED", `제출 패킷 버전 저장: ${snapshot.packetFingerprint}`);
    setVersionMessage(`제출 버전을 저장했습니다: ${snapshot.packetFingerprint}`);
  }

  function compareWithPreviousSnapshot() {
    const previous = latestSubmissionPacketSnapshot(savedCase.id);
    if (!previous) {
      setVersionDiff(null);
      setVersionMessage("비교할 이전 제출 버전이 없습니다. 먼저 현재 버전을 저장하세요.");
      return;
    }
    const diff = compareSubmissionPacketSnapshots(previous, currentSnapshot());
    appendCaseAudit(savedCase.id, "SUBMISSION_VERSION_COMPARED", `제출 패킷 버전 비교: ${diff.status}`);
    setVersionDiff(diff);
    setVersionMessage(diff.status === "UNCHANGED" ? "직전 저장본과 변경된 항목이 없습니다." : `직전 저장본과 ${diff.changes.length}개 항목이 다릅니다.`);
  }

  return (
    <div className="panel panel-tight submission-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <FileCheck2 size={15} aria-hidden="true" /> 기관 제출 패킷
        </span>
        <div className="badge-row">
          <span className="badge badge-low">증거 {packet.evidenceSummaries.length}건</span>
          <span className="badge badge-medium">인계 {officialOnlyCount}건</span>
          <span className="badge badge-green">{packet.evidenceChain.manifestFingerprint}</span>
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

      <section className="trace-section" aria-labelledby="evidence-chain-title">
        <h3 id="evidence-chain-title">증거 체인·인계 이력</h3>
        <p className="muted small">체인 매니페스트: {packet.evidenceChain.manifestFingerprint}</p>
        <ul className="action-list compact-list">
          {packet.evidenceChain.events.slice(0, 5).map((event) => (
            <li key={event.id}>
              {event.at ? new Date(event.at).toLocaleString("ko-KR") : "시각 미입력"} · {event.action} · {event.summary}
            </li>
          ))}
        </ul>
        {packet.evidenceChain.missingForOperationalUse.length ? (
          <p className="small muted">운영 보강: {packet.evidenceChain.missingForOperationalUse.join(", ")}</p>
        ) : null}
      </section>

      <section className="trace-section" aria-labelledby="agency-workflow-title">
        <h3 id="agency-workflow-title">
          <Landmark size={17} aria-hidden="true" /> 기관별 제출 준비도
        </h3>
        <p className="muted small">{packet.agencyWorkflowPlan.summary}</p>
        <div className="agency-workflow-grid">
          {agencyRecommendations.map(({ profile, readiness }) => (
            <article className="agency-workflow-card" key={profile.id}>
              <div className="agency-workflow-head">
                <strong>{profile.name}</strong>
                <span className={`badge ${readiness.status === "READY_TO_SUBMIT" ? "badge-green" : readiness.status === "MISSING_CORE" ? "badge-high" : "badge-medium"}`}>
                  {readiness.score}점
                </span>
              </div>
              <p className="small muted">{readiness.nextAction}</p>
              <div className="agency-workflow-meta">
                <span>{profile.phone || "온라인 접수"}</span>
                <span>{readiness.status}</span>
              </div>
              <ul className="action-list compact-list">
                {(readiness.missingItems.length ? readiness.missingItems : readiness.reviewItems.slice(0, 2)).slice(0, 3).map((item) => (
                  <li key={`${profile.id}-${item.id}`}>
                    {item.label}: {item.detail}
                  </li>
                ))}
                {!readiness.missingItems.length && !readiness.reviewItems.length ? <li>핵심 보강 항목 없음</li> : null}
              </ul>
              <a className="connector-link" href={profile.url} target="_blank" rel="noreferrer">
                <span>공식 경로 열기</span>
                <small>{profile.sourceNote}</small>
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="trace-section" aria-labelledby="promotion-surface-title">
        <h3 id="promotion-surface-title">비공개방 유입면·홍보글 루트</h3>
        <p className="muted small">{packet.promotionSurfacePlan.summary}</p>
        {packet.promotionSurfacePlan.matches.length ? (
          <div className="trace-signal-list">
            {packet.promotionSurfacePlan.matches.map((match) => (
              <article className="trace-signal" key={match.id}>
                <div className="trace-signal-title">
                  <strong>{match.label}</strong>
                  <span className="badge badge-high">{match.riskLevel}</span>
                </div>
                <p>{match.intelligenceValue}</p>
                <p className="small muted">{match.handoffQuestion}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="small muted">아직 감지된 홍보면 후보가 없습니다. 공개 글 제목, 댓글 문구, 프로필 유도 문구, 결제 요구 흔적을 증거 메모에 추가하면 후보가 분류됩니다.</p>
        )}
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

      <section className="trace-section" aria-labelledby="submission-version-title">
        <h3 id="submission-version-title">제출 버전 관리</h3>
        <p className="muted small">현재 패킷을 스냅샷으로 저장하고, 다음 제출 전에 직전 버전과 달라진 증거·기관 후보·보강 항목을 비교합니다. 스냅샷에는 원문 URL과 피해물 원본을 저장하지 않습니다.</p>
        {versionMessage ? <p className="small muted">{versionMessage}</p> : null}
        {versionDiff ? (
          <ul className="action-list compact-list">
            {versionDiff.changes.length ? (
              versionDiff.changes.slice(0, 6).map((change) => (
                <li key={`${change.field}-${change.label}`}>
                  [{change.severity}] {change.label}: {change.before} → {change.after}
                </li>
              ))
            ) : (
              <li>변경된 제출 패킷 항목이 없습니다.</li>
            )}
          </ul>
        ) : null}
      </section>

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
            appendCaseAudit(savedCase.id, "SUBMISSION_PACKET_DOWNLOADED", "기관 제출 인쇄용 HTML을 내려받음");
            downloadFile(`jium-ai-printable-${savedCase.id}.html`, buildPrintableSubmissionHtml(savedCase, packet), "text/html;charset=utf-8");
          }}
        >
          <Download size={17} aria-hidden="true" />
          인쇄용 HTML
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => {
            appendCaseAudit(savedCase.id, "SUBMISSION_PACKET_DOWNLOADED", "기관 제출 ZIP 패키지를 내려받음");
            downloadBytesFile(`jium-ai-submission-${savedCase.id}.zip`, buildSubmissionPackageZip(savedCase), "application/zip");
          }}
        >
          <Download size={17} aria-hidden="true" />
          제출 ZIP
        </button>
        <button className="btn btn-secondary" type="button" onClick={saveVersionSnapshot}>
          <Save size={17} aria-hidden="true" />
          제출 버전 저장
        </button>
        <button className="btn btn-secondary" type="button" onClick={compareWithPreviousSnapshot}>
          <GitCompareArrows size={17} aria-hidden="true" />
          직전 버전 비교
        </button>
        {versionDiff ? (
          <button className="btn btn-secondary" type="button" onClick={() => downloadTextFile(`jium-ai-submission-diff-${savedCase.id}.md`, submissionPacketDiffToMarkdown(versionDiff))}>
            <Download size={17} aria-hidden="true" />
            비교 결과 내려받기
          </button>
        ) : null}
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
