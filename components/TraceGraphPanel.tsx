import { AlertTriangle, GitBranch, Network, Route, ShieldCheck } from "lucide-react";
import { buildTraceAnalysis } from "@/lib/traceEngine";
import type { CaseInput, TraceConfidence, TraceSignalSeverity } from "@/lib/types";

function formatDateTime(value?: string) {
  if (!value) {
    return "시각 확인 필요";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function confidenceLabel(value: TraceConfidence) {
  if (value === "OBSERVED") {
    return "관찰";
  }
  if (value === "INFERRED") {
    return "가설";
  }
  return "확인 필요";
}

function confidenceClass(value: TraceConfidence) {
  if (value === "OBSERVED") {
    return "badge-green";
  }
  if (value === "INFERRED") {
    return "badge-medium";
  }
  return "badge-low";
}

function severityClass(value: TraceSignalSeverity) {
  if (value === "CRITICAL") {
    return "badge-critical";
  }
  if (value === "HIGH") {
    return "badge-high";
  }
  if (value === "MEDIUM") {
    return "badge-medium";
  }
  return "badge-low";
}

export function TraceGraphPanel({ input }: { input: CaseInput }) {
  const analysis = buildTraceAnalysis(input);
  const timeline = analysis.timeline.length
    ? analysis.timeline
    : [
        {
          id: "timeline-empty",
          title: "접근경로 미입력",
          summary: "URL, 플랫폼, 게시 위치, 발견 시각을 입력하면 추격 다이어그램이 만들어집니다.",
          confidence: "NEEDS_REVIEW" as const,
        },
      ];
  const sequenceEdges = analysis.edges.filter((edge) => edge.kind === "TIME_SEQUENCE");

  return (
    <div className="panel panel-tight trace-panel">
      <div className="trace-header">
        <span className="eyebrow">
          <GitBranch size={15} aria-hidden="true" /> 추격 다이어그램
        </span>
        <div className="badge-row">
          <span className="badge badge-low">노드 {analysis.nodes.length}</span>
          <span className="badge badge-low">연결 {analysis.edges.length}</span>
          <span className={analysis.learningSignals.length ? "badge badge-high" : "badge badge-green"}>패턴 {analysis.learningSignals.length}</span>
        </div>
      </div>

      <div className="trace-diagram" aria-label="시간순 추격 다이어그램">
        {timeline.map((entry, index) => (
          <div className="trace-step" key={entry.id}>
            <div className="trace-node">
              <span className="trace-node-index">{index + 1}</span>
              <div>
                <strong>{entry.title}</strong>
                <span>{formatDateTime(entry.at)}</span>
                <p>{entry.summary}</p>
              </div>
              <span className={`badge ${confidenceClass(entry.confidence)}`}>{confidenceLabel(entry.confidence)}</span>
            </div>
            {index < timeline.length - 1 ? (
              <div className="trace-arrow" aria-hidden="true">
                <span />
                <small>{sequenceEdges[index]?.confidence === "INFERRED" ? "전파 가설" : "순서 확인 필요"}</small>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {analysis.learningSignals.length ? (
        <section className="trace-section" aria-labelledby="trace-signal-title">
          <h3 id="trace-signal-title">
            <AlertTriangle size={17} aria-hidden="true" /> 학습 신호
          </h3>
          <div className="trace-signal-list">
            {analysis.learningSignals.map((signal) => (
              <article className="trace-signal" key={signal.id}>
                <div className="trace-signal-title">
                  <strong>{signal.label}</strong>
                  <span className={`badge ${severityClass(signal.severity)}`}>{signal.severity}</span>
                </div>
                <p>{signal.whyItMatters}</p>
                <p className="small muted">{signal.nextAction}</p>
                <p className="small muted">{signal.learningNote}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="trace-section" aria-labelledby="trace-handoff-title">
        <h3 id="trace-handoff-title">
          <Route size={17} aria-hidden="true" /> 담당자 인계 관점
        </h3>
        <ul className="action-list">
          {analysis.nextQuestions.map((item, index) => (
            <li key={`trace-question-${index}-${item}`}>
              <Network size={16} aria-hidden="true" />
              {item}
            </li>
          ))}
          {!analysis.nextQuestions.length ? (
            <li>
              <ShieldCheck size={16} aria-hidden="true" />
              시간, 장소, 관찰 ID가 함께 정리되어 담당자에게 전달할 기본 구조가 만들어졌습니다.
            </li>
          ) : null}
        </ul>
      </section>

      <div className="notice notice-safe">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>안전 경계</strong>
          {analysis.boundaries.join(" ")}
        </div>
      </div>
    </div>
  );
}
