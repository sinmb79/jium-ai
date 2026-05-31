"use client";

import { Clipboard, Download, FileCheck2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { downloadTextFile } from "@/lib/export";
import { buildSubmissionPacket, submissionPacketWithEvidenceToMarkdown } from "@/lib/submissionPacket";
import type { SavedCase } from "@/lib/types";

export function SubmissionPacketPanel({ savedCase }: { savedCase: SavedCase }) {
  const [copied, setCopied] = useState(false);
  const packet = useMemo(
    () => buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack),
    [savedCase.classification, savedCase.input, savedCase.responsePack],
  );
  const markdown = useMemo(() => submissionPacketWithEvidenceToMarkdown(savedCase.input, packet), [packet, savedCase.input]);
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
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Clipboard size={17} aria-hidden="true" />
          {copied ? "복사됨" : "제출 패킷 복사"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => downloadTextFile(`jium-ai-submission-${savedCase.id}.md`, markdown)}>
          <Download size={17} aria-hidden="true" />
          제출 패킷 내려받기
        </button>
      </div>
    </div>
  );
}
