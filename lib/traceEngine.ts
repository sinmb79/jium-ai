import { getEvidenceLedger } from "@/lib/evidence";
import {
  DIGITAL_CRIME_ROUTE_BOUNDARIES,
  detectDigitalCrimeRoutePatterns,
} from "@/lib/digitalCrimeRouteKnowledge";
import type {
  CaseInput,
  EvidenceItem,
  TraceAnalysis,
  TraceConfidence,
  TraceEdge,
  TraceLearningSignal,
  TraceNode,
  TracePatternDefinition,
  TraceSignalSeverity,
  TraceTimelineEntry,
} from "@/lib/types";

const OFFICIAL_ROUTE_NODE_ID = "official-route";

export const TRACE_BOUNDARIES = [
  "피해물 원본을 다운로드하거나 재유포하지 않습니다.",
  "비밀방 잠입, 사칭, 유료 결제, 초대코드 수집을 안내하지 않습니다.",
  "게시자 실명이나 신원은 단정하지 않고 관찰된 ID와 근거만 기록합니다.",
  "우회 IP, 다크웹, 폐쇄형 채널 신호는 피해자 직접 추적이 아니라 수사·상담기관 인계 표시로만 사용합니다.",
];

export const TRACE_PATTERN_DEFINITIONS: TracePatternDefinition[] = [
  {
    id: "encrypted-channel",
    label: "폐쇄형 메신저/초대방 신호",
    description: "텔레그램, 초대방, 비밀방, 채널처럼 피해자가 직접 접근하면 2차 피해와 법적 위험이 커지는 경로입니다.",
    safeSignals: ["텔레그램", "비밀방", "초대방", "채널", "invite"],
    prohibitedActions: ["잠입", "사칭", "초대코드 구매", "방 내부 피해물 다운로드"],
    officialHandoff: ["중앙디지털성범죄피해자지원센터", "경찰 ECRM", "수사기관 상담"],
  },
  {
    id: "dark-web",
    label: "다크웹/은닉 서비스 신호",
    description: ".onion, 다크웹 언급처럼 일반 피해자가 직접 확인하기 어려운 은닉 유통 경로입니다.",
    safeSignals: [".onion", "다크웹", "dark web", "tor"],
    prohibitedActions: ["직접 접속", "거래", "계정 생성", "자료 다운로드"],
    officialHandoff: ["전문 상담기관", "수사기관", "변호사 상담"],
  },
  {
    id: "proxy-or-vpn",
    label: "우회 IP/VPN 주장 신호",
    description: "우회 IP나 VPN 언급은 신원 단정 근거가 아니라 수사기관이 통신자료·플랫폼 협조로 확인해야 할 단서입니다.",
    safeSignals: ["우회", "VPN", "proxy", "프록시", "아이피", "IP"],
    prohibitedActions: ["개인 신상 추정 공개", "보복성 연락", "불법 로그 수집"],
    officialHandoff: ["경찰 신고 준비자료", "플랫폼 보존 요청", "법률 상담"],
  },
  {
    id: "reupload-after-removal",
    label: "삭제 후 재업로드 신호",
    description: "삭제 이후 다시 올라오는 패턴은 단일 게시물보다 유통망과 반복 게시자를 따로 관리해야 합니다.",
    safeSignals: ["재업", "재노출", "reupload", "repost", "reappeared"],
    prohibitedActions: ["피해물 검색 반복", "가해자와 직접 협상", "삭제 성공 단정"],
    officialHandoff: ["삭제지원 모니터링", "경찰 보강자료", "플랫폼 반복 침해 신고"],
  },
  {
    id: "search-cache-or-archive",
    label: "검색 캐시/아카이브 신호",
    description: "원 게시물이 사라져도 검색 결과, 캐시, 아카이브에 남아 피해가 지속될 수 있는 경로입니다.",
    safeSignals: ["검색", "캐시", "아카이브", "archive", "cached", "검색결과"],
    prohibitedActions: ["캐시 원본 재저장", "새 공유 링크 생성", "피해물 미리보기 확산"],
    officialHandoff: ["검색엔진 삭제요청", "방심위 심의 신청", "플랫폼 삭제요청"],
  },
  {
    id: "cross-border-hosting",
    label: "해외 서버/국외 플랫폼 신호",
    description: "국외 서버나 해외 플랫폼은 국내 삭제요청만으로 끝나지 않을 수 있어 국제 협력 경로가 필요합니다.",
    safeSignals: ["해외", "국외", "foreign", "server", "서버", "cdn"],
    prohibitedActions: ["무단 침입", "서비스 공격", "운영자 협박"],
    officialHandoff: ["중앙디성센터 국제협력", "플랫폼 공식 신고", "수사기관"],
  },
];

function compact(value?: string) {
  return value?.trim() || "";
}

function normalizeKey(value?: string) {
  return compact(value).toLowerCase();
}

function nodeId(prefix: string, value: string) {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 72)}`;
}

function parseTime(value?: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function readableEvidenceTitle(item: EvidenceItem, index: number) {
  const platform = compact(item.platform);
  const location = compact(item.location);
  if (platform && location) {
    return `${platform} / ${location}`;
  }
  return platform || location || compact(item.url) || `접근경로 ${index + 1}`;
}

function safeUrlHint(value?: string) {
  if (!value) {
    return "";
  }
  try {
    const url = new URL(value);
    return url.hostname;
  } catch {
    return "";
  }
}

function addUnique<T extends { id: string }>(items: T[], next: T) {
  if (!items.some((item) => item.id === next.id)) {
    items.push(next);
  }
}

function edge(
  from: string,
  to: string,
  kind: TraceEdge["kind"],
  label: string,
  confidence: TraceConfidence,
  reason: string,
  sourceEvidenceIds: string[],
): TraceEdge {
  return {
    id: `${kind}:${from}->${to}`,
    from,
    to,
    kind,
    label,
    confidence,
    reason,
    sourceEvidenceIds,
  };
}

function joinedEvidenceText(item: EvidenceItem) {
  return [item.url, item.platform, item.location, item.posterId, item.notes].filter(Boolean).join(" ");
}

function severityForPattern(patternId: string): TraceSignalSeverity {
  if (patternId === "dark-web" || patternId === "encrypted-channel") {
    return "CRITICAL";
  }
  if (patternId === "proxy-or-vpn" || patternId === "reupload-after-removal" || patternId === "cross-border-hosting") {
    return "HIGH";
  }
  return "MEDIUM";
}

function signalNextAction(pattern: TracePatternDefinition) {
  return `${pattern.officialHandoff.join(", ")} 인계자료에 이 신호를 표시하고, 피해자가 직접 접촉하지 않도록 분리합니다.`;
}

function detectLearningSignals(evidenceItems: EvidenceItem[]): TraceLearningSignal[] {
  return TRACE_PATTERN_DEFINITIONS.flatMap((pattern) => {
    const matchedEvidenceIds = evidenceItems
      .filter((item) => {
        const haystack = joinedEvidenceText(item).toLowerCase();
        const statusSignal = pattern.id === "reupload-after-removal" && item.status === "REAPPEARED";
        return statusSignal || pattern.safeSignals.some((signal) => haystack.includes(signal.toLowerCase()));
      })
      .map((item) => item.id);

    if (!matchedEvidenceIds.length) {
      return [];
    }

    return [
      {
        id: pattern.id,
        label: pattern.label,
        severity: severityForPattern(pattern.id),
        matchedEvidenceIds,
        whyItMatters: pattern.description,
        nextAction: signalNextAction(pattern),
        learningNote: "개인정보나 피해물 원본이 아니라 패턴명, 위험도, 근거 ID만 다음 사건의 탐지 규칙으로 남깁니다.",
      },
    ];
  });
}

function detectRouteKnowledgeSignals(evidenceItems: EvidenceItem[]): TraceLearningSignal[] {
  return detectDigitalCrimeRoutePatterns(evidenceItems).map((route) => ({
    id: `route-${route.id}`,
    label: route.label,
    severity: route.riskLevel,
    matchedEvidenceIds: route.matchedEvidenceIds,
    whyItMatters: route.intelligenceValue,
    nextAction: `${route.officialHandoff.join(", ")}. Record only: ${route.evidenceToRecord.join(", ")}.`,
    learningNote:
      `피해물 원본은 저장하지 않습니다. Route intelligence access: ${route.accessLevel}. Keep exact indicators in the case ledger or authorized feeds; do not expose them as a public directory.`,
  }));
}

function mergeLearningSignals(signals: TraceLearningSignal[]) {
  const merged = new Map<string, TraceLearningSignal>();
  signals.forEach((signal) => {
    const existing = merged.get(signal.id);
    if (!existing) {
      merged.set(signal.id, signal);
      return;
    }
    merged.set(signal.id, {
      ...existing,
      matchedEvidenceIds: Array.from(new Set([...existing.matchedEvidenceIds, ...signal.matchedEvidenceIds])),
    });
  });
  return Array.from(merged.values());
}

function buildNextQuestions(evidenceItems: EvidenceItem[], signals: TraceLearningSignal[]) {
  const questions = new Set<string>();
  if (!evidenceItems.some((item) => compact(item.foundAt))) {
    questions.add("처음 발견한 날짜와 시간을 입력하면 전파 순서를 더 정확히 볼 수 있습니다.");
  }
  if (!evidenceItems.some((item) => compact(item.platform))) {
    questions.add("플랫폼명이나 사이트 종류를 적으면 공식 신고 경로를 더 좁힐 수 있습니다.");
  }
  if (!evidenceItems.some((item) => compact(item.posterId))) {
    questions.add("보이는 ID나 닉네임은 실명 단정 없이 관찰값으로만 기록할 수 있습니다.");
  }
  if (signals.some((signal) => signal.severity === "CRITICAL")) {
    questions.add("폐쇄형·은닉 경로 신호는 피해자가 직접 확인하지 말고 전문기관 인계자료로 묶어야 합니다.");
  }
  return Array.from(questions);
}

export function buildTraceAnalysis(input: CaseInput): TraceAnalysis {
  const evidenceItems = getEvidenceLedger(input);
  const nodes: TraceNode[] = [];
  const edges: TraceEdge[] = [];
  const timeline: TraceTimelineEntry[] = [];

  addUnique(nodes, {
    id: "case",
    kind: "CASE",
    label: input.title || "사건",
    detail: input.situation || input.description,
    sourceEvidenceIds: evidenceItems.map((item) => item.id),
  });

  addUnique(nodes, {
    id: OFFICIAL_ROUTE_NODE_ID,
    kind: "OFFICIAL_ROUTE",
    label: "공식 인계",
    detail: "상담, 삭제지원, 수사·법률 연계",
    sourceEvidenceIds: evidenceItems.map((item) => item.id),
  });

  evidenceItems.forEach((item, index) => {
    const evidenceNodeId = nodeId("evidence", item.id || String(index));
    const title = readableEvidenceTitle(item, index);
    const sourceEvidenceIds = [item.id];

    addUnique(nodes, {
      id: evidenceNodeId,
      kind: "EVIDENCE",
      label: title,
      detail: [safeUrlHint(item.url), compact(item.notes)].filter(Boolean).join(" · "),
      occurredAt: item.foundAt,
      sourceEvidenceIds,
    });

    addUnique(edges, edge("case", evidenceNodeId, "HAS_EVIDENCE", "접근경로", "OBSERVED", "사용자가 입력한 증거목록입니다.", sourceEvidenceIds));
    addUnique(edges, edge(evidenceNodeId, OFFICIAL_ROUTE_NODE_ID, "ESCALATE_TO", "인계자료", "OBSERVED", "기관 제출용 증거목록에 포함할 수 있습니다.", sourceEvidenceIds));

    if (compact(item.platform)) {
      const platformNodeId = nodeId("platform", normalizeKey(item.platform));
      addUnique(nodes, {
        id: platformNodeId,
        kind: "PLATFORM",
        label: compact(item.platform),
        detail: "관찰된 플랫폼/사이트",
        sourceEvidenceIds,
      });
      addUnique(edges, edge(evidenceNodeId, platformNodeId, "HOSTED_ON", "게시 장소", "OBSERVED", "입력된 플랫폼 또는 사이트명입니다.", sourceEvidenceIds));
    }

    if (compact(item.posterId)) {
      const actorNodeId = nodeId("alias", normalizeKey(item.posterId));
      addUnique(nodes, {
        id: actorNodeId,
        kind: "ACTOR_ALIAS",
        label: compact(item.posterId),
        detail: "관찰된 ID/닉네임, 실명 단정 아님",
        sourceEvidenceIds,
      });
      addUnique(edges, edge(evidenceNodeId, actorNodeId, "POSTED_BY_ALIAS", "관찰된 게시자", "OBSERVED", "화면에 보이는 식별자를 기록한 값이며 실제 신원 판단은 아닙니다.", sourceEvidenceIds));
    }

    timeline.push({
      id: `timeline-${item.id}`,
      title,
      at: item.foundAt,
      summary: [compact(item.platform), compact(item.location), compact(item.posterId) ? `ID: ${compact(item.posterId)}` : ""].filter(Boolean).join(" · ") || "상세 위치 미입력",
      evidenceId: item.id,
      confidence: compact(item.foundAt) ? "OBSERVED" : "NEEDS_REVIEW",
    });
  });

  const orderedEvidence = [...evidenceItems].sort((a, b) => parseTime(a.foundAt) - parseTime(b.foundAt));
  orderedEvidence.forEach((item, index) => {
    const next = orderedEvidence[index + 1];
    if (!next) {
      return;
    }
    const from = nodeId("evidence", item.id);
    const to = nodeId("evidence", next.id);
    const confidence: TraceConfidence = compact(item.foundAt) && compact(next.foundAt) ? "INFERRED" : "NEEDS_REVIEW";
    addUnique(
      edges,
      edge(
        from,
        to,
        "TIME_SEQUENCE",
        "다음 발견",
        confidence,
        "발견 시각 기준의 전파 가설입니다. 실제 최초 유포 순서로 단정하지 않습니다.",
        [item.id, next.id],
      ),
    );
  });

  const byAlias = new Map<string, EvidenceItem[]>();
  evidenceItems.forEach((item) => {
    const alias = normalizeKey(item.posterId);
    if (!alias) {
      return;
    }
    byAlias.set(alias, [...(byAlias.get(alias) || []), item]);
  });
  byAlias.forEach((items, alias) => {
    if (items.length < 2) {
      return;
    }
    const aliasNode = nodeId("alias", alias);
    items.forEach((item) => {
      addUnique(
        edges,
        edge(
          aliasNode,
          nodeId("evidence", item.id),
          "SHARED_ALIAS",
          "동일 ID 반복",
          "INFERRED",
          "같은 ID가 여러 접근경로에서 관찰되었습니다. 동일 인물 여부는 수사기관 확인이 필요합니다.",
          items.map((entry) => entry.id),
        ),
      );
    });
  });

  const learningSignals = mergeLearningSignals([...detectLearningSignals(evidenceItems), ...detectRouteKnowledgeSignals(evidenceItems)]);
  learningSignals.forEach((signal) => {
    const signalNodeId = nodeId("signal", signal.id);
    addUnique(nodes, {
      id: signalNodeId,
      kind: "INFRASTRUCTURE_SIGNAL",
      label: signal.label,
      detail: signal.whyItMatters,
      sourceEvidenceIds: signal.matchedEvidenceIds,
    });
    signal.matchedEvidenceIds.forEach((evidenceId) => {
      addUnique(
        edges,
        edge(
          nodeId("evidence", evidenceId),
          signalNodeId,
          "HAS_SIGNAL",
          "패턴 신호",
          "INFERRED",
          "증거 메모와 플랫폼명에서 안전하게 추출한 위험 패턴입니다.",
          [evidenceId],
        ),
      );
    });
  });

  const sortedTimeline = timeline.sort((a, b) => parseTime(a.at) - parseTime(b.at));

  return {
    nodes,
    edges,
    timeline: sortedTimeline,
    learningSignals,
    patternDefinitions: TRACE_PATTERN_DEFINITIONS,
    boundaries: [...TRACE_BOUNDARIES, ...DIGITAL_CRIME_ROUTE_BOUNDARIES],
    nextQuestions: buildNextQuestions(evidenceItems, learningSignals),
  };
}
