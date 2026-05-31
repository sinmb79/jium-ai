import { buildDiscoveryResearchPlan, type DiscoveryResearchPlan } from "@/lib/discoveryResearchEngine";
import { buildEvidenceChain, evidenceChainToMarkdown, type EvidenceChainSummary } from "@/lib/evidenceChain";
import { buildEvidenceMetadataFingerprint, formatEvidenceLedgerForDocument, getEvidenceLedger } from "@/lib/evidence";
import { CASE_TYPE_LABELS, DELETION_CHANCE_LABELS, RISK_LABELS } from "@/lib/labels";
import { buildPromotionSurfacePlan, type PromotionSurfacePlan } from "@/lib/promotionSurfaceIntelligence";
import { RESOURCE_KIND_LABELS } from "@/lib/publicResources";
import { buildSafeSearchActions } from "@/lib/searchConnectors";
import { buildSubmissionConnectorActions, connectorActionsToMarkdown } from "@/lib/submissionConnectors";
import { buildTraceAnalysis } from "@/lib/traceEngine";
import type { CaseClassification, CaseInput, EvidenceItem, ResponsePack, ServiceIntegration, TraceAnalysis } from "@/lib/types";

export type SubmissionEvidenceSummary = {
  id: string;
  label: string;
  foundAt?: string;
  capturedAt?: string;
  captureMethod: string;
  metadataFingerprint: string;
  evidenceHash?: string;
  visualFingerprint?: string;
  missing: string[];
};

export type SubmissionPacket = {
  generatedAt: string;
  caseSummary: string[];
  evidenceSummaries: SubmissionEvidenceSummary[];
  evidenceChain: EvidenceChainSummary;
  evidenceGaps: string[];
  traceMermaid: string;
  agencyTargets: ServiceIntegration[];
  discoveryPlan: DiscoveryResearchPlan;
  promotionSurfacePlan: PromotionSurfacePlan;
  lawfulInvestigationMemo: string[];
  safetyBoundaries: string[];
};

function compact(value?: string) {
  return value?.trim() || "";
}

function escapeMermaid(value: string) {
  return value.replace(/"/g, "'").replace(/\r?\n/g, " ").slice(0, 90);
}

function nodeLabel(item: EvidenceItem, index: number) {
  return compact(item.platform) || compact(item.location) || compact(item.posterId) || compact(item.url) || `증거 ${index + 1}`;
}

function missingEvidenceFields(item: EvidenceItem) {
  const missing: string[] = [];
  if (!compact(item.foundAt)) {
    missing.push("발견 일시");
  }
  if (!compact(item.capturedAt)) {
    missing.push("캡처/기록 일시");
  }
  if (!item.captureMethod || item.captureMethod === "UNKNOWN") {
    missing.push("기록 방식");
  }
  if (!compact(item.evidenceHash)) {
    missing.push("증거 해시");
  }
  return missing;
}

function evidenceSummaries(input: CaseInput): SubmissionEvidenceSummary[] {
  return getEvidenceLedger(input).map((item, index) => ({
    id: item.id,
    label: nodeLabel(item, index),
    foundAt: item.foundAt,
    capturedAt: item.capturedAt,
    captureMethod: item.captureMethod || "UNKNOWN",
    metadataFingerprint: item.metadataFingerprint || buildEvidenceMetadataFingerprint(item),
    evidenceHash: item.evidenceHash,
    visualFingerprint: item.visualFingerprint,
    missing: missingEvidenceFields(item),
  }));
}

export function traceAnalysisToMermaid(analysis: TraceAnalysis) {
  const nodeIds = new Map<string, string>();
  const lines = ["graph TD"];

  analysis.nodes.forEach((node, index) => {
    const mermaidId = `N${index}`;
    nodeIds.set(node.id, mermaidId);
    lines.push(`  ${mermaidId}["${escapeMermaid(node.label)}"]`);
  });

  analysis.edges.forEach((edge) => {
    const from = nodeIds.get(edge.from);
    const to = nodeIds.get(edge.to);
    if (!from || !to) {
      return;
    }
    lines.push(`  ${from} -->|"${escapeMermaid(edge.label)} · ${edge.confidence}"| ${to}`);
  });

  return lines.join("\n");
}

function agencyTargets(pack?: ResponsePack) {
  const services = pack?.serviceIntegrations || [];
  const seen = new Set<string>();
  return services.filter((service) => {
    if (seen.has(service.id)) {
      return false;
    }
    seen.add(service.id);
    return true;
  });
}

export function buildSubmissionPacket(input: CaseInput, classification: CaseClassification, responsePack?: ResponsePack, generatedAt = new Date().toISOString()): SubmissionPacket {
  const analysis = buildTraceAnalysis(input);
  const summaries = evidenceSummaries(input);
  const discoveryPlan = buildDiscoveryResearchPlan(input, classification, generatedAt);
  const promotionSurfacePlan = buildPromotionSurfacePlan(input);
  const evidenceChain = buildEvidenceChain(input, generatedAt);
  const missing = Array.from(new Set(summaries.flatMap((item) => item.missing)));

  return {
    generatedAt,
    caseSummary: [
      `사건 유형: ${CASE_TYPE_LABELS[classification.caseType]}`,
      `위험도: ${RISK_LABELS[classification.riskLevel]}`,
      `삭제 가능성: ${DELETION_CHANCE_LABELS[classification.deletionChance]}`,
      `접근경로 수: ${summaries.length}건`,
      `판단 이유: ${classification.reason}`,
    ],
    evidenceSummaries: summaries,
    evidenceChain,
    evidenceGaps: missing.length ? missing.map((item) => `${item} 보강 필요`) : ["기관 제출용 기본 증거 필드가 입력되어 있습니다."],
    traceMermaid: traceAnalysisToMermaid(analysis),
    agencyTargets: agencyTargets(responsePack),
    discoveryPlan,
    promotionSurfacePlan,
    lawfulInvestigationMemo: [
      "피해자는 최초 피해사실, URL, 게시 위치, 관찰 ID, 발견·캡처 시각, 접수번호를 신속히 제출해 초기 보존과 삭제 조치를 요청합니다.",
      "플랫폼 로그, IP, 가입자 정보, 서버 정보, 결제·암호화폐 흐름은 수사기관 또는 법원의 적법 절차로 확인되어야 합니다.",
      "폐쇄형 메신저, 디스코드 비공개 서버, 다크웹, 유료방 신호는 피해자 직접 탐색 대상이 아니라 긴급 인계 신호입니다.",
      "비공개방 자체가 보이지 않아도, 공개 홍보글·프로필·댓글·검색 스니펫·결제 요구는 유입면 증거로 분리해 제출합니다.",
      "삭제 요청과 증거보전·수사 요청은 목적이 다르므로, 삭제 전후의 상태와 재유포 여부를 별도 항목으로 남깁니다.",
    ],
    safetyBoundaries: Array.from(new Set([...analysis.boundaries, ...discoveryPlan.boundaries, ...promotionSurfacePlan.boundaries])),
  };
}

export function submissionPacketToMarkdown(packet: SubmissionPacket) {
  return `## 기관 제출 패킷

생성일: ${new Date(packet.generatedAt).toLocaleString("ko-KR")}

### 사건 요약

${packet.caseSummary.map((item) => `- ${item}`).join("\n")}

### 증거 무결성 요약

${packet.evidenceSummaries
  .map(
    (item, index) => `${index + 1}. ${item.label}
   - 발견 일시: ${item.foundAt || "[미입력]"}
   - 캡처/기록 일시: ${item.capturedAt || "[미입력]"}
   - 기록 방식: ${item.captureMethod}
   - 메타데이터 지문: ${item.metadataFingerprint}
   - 증거 해시: ${item.evidenceHash || "[기관 안내에 따라 필요 시 산출]"}
   - 이미지/영상 지문: ${item.visualFingerprint || "[미입력]"}
   - 보강 필요: ${item.missing.length ? item.missing.join(", ") : "없음"}`,
  )
  .join("\n\n")}

보강 항목:
${packet.evidenceGaps.map((item) => `- ${item}`).join("\n")}

${evidenceChainToMarkdown(packet.evidenceChain)}

### 추격 다이어그램

\`\`\`mermaid
${packet.traceMermaid}
\`\`\`

### 리서치·매칭 계획

${packet.discoveryPlan.summary}

공개 확인용 쿼리:
${packet.discoveryPlan.safeQueries.map((query) => `- ${query.query}: ${query.purpose}`).join("\n")}

안전 검색 커넥터:
${buildSafeSearchActions(packet.discoveryPlan)
  .map((action) => `- ${action.label}: ${action.url}
  - 목적: ${action.purpose}
  - 경계: ${action.boundary}`)
  .join("\n")}

매칭 채널:
${packet.discoveryPlan.matchChannels
  .map(
    (channel) => `- ${channel.label}
  - 권한: ${channel.authority}
  - 위험도: ${channel.severity}
  - 방식: ${channel.matchingApproach.join(" / ")}
  - 인계: ${channel.officialHandoff.join(", ")}
  - 경계: ${channel.safetyBoundary}`,
  )
  .join("\n")}

### 비공개방 유입면·홍보글 루트

${packet.promotionSurfacePlan.summary}

루트 시드:
${packet.promotionSurfacePlan.routeSeeds.length ? packet.promotionSurfacePlan.routeSeeds.map((seed) => `- ${seed}`).join("\n") : "- 입력된 루트 시드가 부족합니다."}

홍보면 후보:
${packet.promotionSurfacePlan.matches.length
  ? packet.promotionSurfacePlan.matches
      .map(
        (match) => `- ${match.label}
  - 표면: ${match.surfaceKind}
  - 위험도: ${match.riskLevel}
  - 기록할 것: ${match.evidenceToRecord.join(", ")}
  - 인계: ${match.officialHandoff.join(", ")}
  - 경계: ${match.doNotDo.join(" / ")}
  - 확인 질문: ${match.handoffQuestion}`,
      )
      .join("\n")
  : "- 아직 홍보면 후보가 감지되지 않았습니다. 공개 표면의 제목·스니펫·프로필·댓글·결제 요구 단서를 추가하면 후보가 생깁니다."}

수집 체크리스트:
${packet.promotionSurfacePlan.safeCollectionChecklist.map((item) => `- ${item}`).join("\n")}

공식 인계 트리거:
${packet.promotionSurfacePlan.officialEscalationTriggers.map((item) => `- ${item}`).join("\n")}

### 사법기관·전문기관 요청 메모

${packet.lawfulInvestigationMemo.map((item) => `- ${item}`).join("\n")}

### 공식 제출 커넥터

${connectorActionsToMarkdown(buildSubmissionConnectorActions(packet))}

### 연결 기관 후보

${packet.agencyTargets.length
  ? packet.agencyTargets
      .map(
        (service, index) => `${index + 1}. ${service.name}
   - 구분: ${RESOURCE_KIND_LABELS[service.kind]}
   - 비용: ${service.cost}
   - 링크: ${service.url}
   - 사용 시점: ${service.useWhen}
   - 준비물: ${service.prepItems.join(", ")}`,
      )
      .join("\n\n")
  : "- 분류 결과에 맞는 공식기관 후보를 먼저 확인해야 합니다."}

### 안전 경계

${packet.safetyBoundaries.map((item) => `- ${item}`).join("\n")}
`;
}

export function submissionPacketWithEvidenceToMarkdown(input: CaseInput, packet: SubmissionPacket) {
  return `${submissionPacketToMarkdown(packet)}

### 접근경로 원문 목록

${formatEvidenceLedgerForDocument(input)}
`;
}
