import { getEvidenceLedger } from "@/lib/evidence";
import { buildSubmissionPacket, type SubmissionPacket } from "@/lib/submissionPacket";
import type { EvidenceItem, SavedCase } from "@/lib/types";

export type PreSubmissionCheckStatus = "PASS" | "REVIEW" | "BLOCKED";

export type PreSubmissionCheckOwner = "VICTIM" | "SUPPORTER" | "AGENCY" | "OFFICIAL_AUTHORITY";

export type PreSubmissionCheckItem = {
  id: string;
  label: string;
  status: PreSubmissionCheckStatus;
  detail: string;
  evidence: string;
  owner: PreSubmissionCheckOwner;
};

export type PreSubmissionTargetSummary = {
  agencyName: string;
  readinessStatus: string;
  readinessScore: number;
  nextAction: string;
  missingCount: number;
  reviewCount: number;
};

export type PreSubmissionOverallStatus = "READY_TO_SUBMIT" | "NEEDS_REVIEW" | "BLOCKED";

export type PreSubmissionChecklistReport = {
  generatedAt: string;
  caseId: string;
  overallStatus: PreSubmissionOverallStatus;
  score: number;
  targets: PreSubmissionTargetSummary[];
  items: PreSubmissionCheckItem[];
  blockers: PreSubmissionCheckItem[];
  reviewItems: PreSubmissionCheckItem[];
  warnings: string[];
  nextActions: string[];
};

const STATUS_LABELS: Record<PreSubmissionCheckStatus | PreSubmissionOverallStatus, string> = {
  PASS: "통과",
  REVIEW: "검토 필요",
  BLOCKED: "제출 보류",
  READY_TO_SUBMIT: "제출 가능",
  NEEDS_REVIEW: "검토 후 제출",
};

const OWNER_LABELS: Record<PreSubmissionCheckOwner, string> = {
  VICTIM: "피해자/지원자",
  SUPPORTER: "상담자/지원자",
  AGENCY: "접수기관",
  OFFICIAL_AUTHORITY: "수사·심의기관",
};

function clean(value?: string) {
  return value?.trim() || "";
}

function check(
  id: string,
  label: string,
  status: PreSubmissionCheckStatus,
  detail: string,
  evidence: string,
  owner: PreSubmissionCheckOwner,
): PreSubmissionCheckItem {
  return { id, label, status, detail, evidence, owner };
}

function allEvidenceHave(evidenceItems: EvidenceItem[], predicate: (item: EvidenceItem) => boolean) {
  return evidenceItems.length > 0 && evidenceItems.every(predicate);
}

function someEvidenceHave(evidenceItems: EvidenceItem[], predicate: (item: EvidenceItem) => boolean) {
  return evidenceItems.some(predicate);
}

function hasRequestLog(evidenceItems: EvidenceItem[]) {
  return evidenceItems.some((item) => (item.requestLogs || []).some((log) => clean(log.target) || clean(log.receiptId) || clean(log.notes)));
}

function hasSubmissionTarget(evidenceItems: EvidenceItem[]) {
  return evidenceItems.some((item) => clean(item.submissionTarget));
}

const CUSTODY_MISSING_FIELDS = new Set([
  "collector pseudonymous reference",
  "collection device pseudonymous reference",
  "hash algorithm",
  "verification timestamp",
  "handoff recipient pseudonymous reference",
]);

function custodyMissingFields(packet: SubmissionPacket) {
  return packet.evidenceChain.missingForOperationalUse.filter((item) => CUSTODY_MISSING_FIELDS.has(item));
}

function hasOriginalMediaMetadata(evidenceItems: EvidenceItem[]) {
  return evidenceItems.some((item) => clean(item.fileName) || clean(item.fileMimeType) || typeof item.fileSize === "number");
}

function hasAccessPath(savedCase: SavedCase, packet: SubmissionPacket) {
  return Boolean(packet.evidenceSummaries.length || clean(savedCase.input.targetUrl) || clean(savedCase.input.platform) || clean(savedCase.input.keywords));
}

function scoreItems(items: PreSubmissionCheckItem[]) {
  const weighted = items.reduce((total, item) => total + (item.status === "PASS" ? 1 : item.status === "REVIEW" ? 0.5 : 0), 0);
  return Math.round((weighted / Math.max(items.length, 1)) * 100);
}

function buildNextActions(report: Omit<PreSubmissionChecklistReport, "nextActions">) {
  const actions: string[] = [];
  if (report.blockers.length) {
    actions.push("제출 보류 항목을 먼저 보강한 뒤 기관 제출 패킷을 다시 생성합니다.");
    actions.push("URL·게시 위치·발견 시각처럼 피해자가 직접 확인 가능한 사실부터 채웁니다.");
  }
  if (report.reviewItems.length) {
    actions.push("검토 필요 항목은 상담자 또는 담당기관에 '미상/확인 필요'로 분리해 설명합니다.");
  }
  if (report.targets[0]) {
    actions.push(`${report.targets[0].agencyName} 제출 준비도를 우선 기준으로 공식 접수 화면 또는 상담 경로에서 최종 확인합니다.`);
  }
  actions.push("피해물 원본, 신분증 원본, 비밀번호는 ZIP에 넣지 말고 기관 안내가 있을 때 최소 범위로 별도 제출합니다.");
  actions.push("IP·가입자 정보·결제·서버 로그는 피해자가 직접 추적하지 않고 수사·심의기관 요청사항으로 분리합니다.");
  return actions;
}

export function preSubmissionStatusLabel(status: PreSubmissionCheckStatus | PreSubmissionOverallStatus) {
  return STATUS_LABELS[status];
}

export function preSubmissionOwnerLabel(owner: PreSubmissionCheckOwner) {
  return OWNER_LABELS[owner];
}

export function buildPreSubmissionChecklistReport(
  savedCase: SavedCase,
  packet = buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack),
): PreSubmissionChecklistReport {
  const evidenceItems = getEvidenceLedger(savedCase.input);
  const summaryParts = [savedCase.input.title, savedCase.input.description, savedCase.input.situation].filter((value) => clean(value));
  const completeSummary = summaryParts.length === 3;
  const accessPath = hasAccessPath(savedCase, packet);
  const custodyMissing = custodyMissingFields(packet);
  const custodyWarnings = packet.evidenceChain.custodyWarnings;
  const custodyStatus: PreSubmissionCheckStatus = custodyWarnings.length ? "BLOCKED" : custodyMissing.length ? "REVIEW" : evidenceItems.length ? "PASS" : "BLOCKED";
  const targets = packet.agencyWorkflowPlan.recommendations.map(({ profile, readiness }) => ({
    agencyName: profile.name,
    readinessStatus: readiness.status,
    readinessScore: readiness.score,
    nextAction: readiness.nextAction,
    missingCount: readiness.missingItems.length,
    reviewCount: readiness.reviewItems.length,
  }));

  const items: PreSubmissionCheckItem[] = [
    check(
      "case-summary",
      "피해 사실 요약",
      completeSummary ? "PASS" : summaryParts.length ? "REVIEW" : "BLOCKED",
      completeSummary ? "제목·상황·상세 설명이 모두 입력되어 있습니다." : summaryParts.length ? "일부 설명이 있으나 제출 전 3~5문장 요약으로 보강하는 편이 안전합니다." : "기관이 최초 피해 사실을 이해할 수 있는 요약이 없습니다.",
      `${summaryParts.length}/3개 핵심 설명 입력`,
      "VICTIM",
    ),
    check(
      "agency-target",
      "제출 기관 후보",
      targets.length ? "PASS" : "BLOCKED",
      targets.length ? `${targets.length}개 기관 제출 후보와 준비도가 계산되었습니다.` : "사건 유형에 맞는 공식 제출 후보가 없습니다.",
      targets.map((target) => `${target.agencyName} ${target.readinessScore}점`).join(", ") || "기관 후보 없음",
      "SUPPORTER",
    ),
    check(
      "evidence-access-path",
      "접근 경로·게시 위치",
      accessPath ? "PASS" : "BLOCKED",
      accessPath ? "URL, 플랫폼, 키워드 또는 증거 항목에서 접근 경로를 확인했습니다." : "접근 경로가 없으면 기관이 삭제·보존 요청 대상을 특정하기 어렵습니다.",
      `${packet.evidenceSummaries.length}개 증거 요약`,
      "VICTIM",
    ),
    check(
      "found-captured-time",
      "발견·캡처 시각",
      allEvidenceHave(evidenceItems, (item) => Boolean(clean(item.foundAt) && clean(item.capturedAt)))
        ? "PASS"
        : someEvidenceHave(evidenceItems, (item) => Boolean(clean(item.foundAt) || clean(item.capturedAt)))
          ? "REVIEW"
          : accessPath
            ? "REVIEW"
            : "BLOCKED",
      allEvidenceHave(evidenceItems, (item) => Boolean(clean(item.foundAt) && clean(item.capturedAt)))
        ? "모든 증거에 발견 시각과 기록 시각이 있습니다."
        : "시간 정보가 일부 비어 있습니다. 모르면 '미상'으로 두되 최초 인지 시점을 별도 메모하세요.",
      `${evidenceItems.filter((item) => clean(item.foundAt)).length}개 발견 시각 / ${evidenceItems.filter((item) => clean(item.capturedAt)).length}개 캡처 시각`,
      "VICTIM",
    ),
    check(
      "capture-method",
      "기록 방식",
      allEvidenceHave(evidenceItems, (item) => item.captureMethod !== "UNKNOWN") ? "PASS" : evidenceItems.length ? "REVIEW" : "BLOCKED",
      allEvidenceHave(evidenceItems, (item) => item.captureMethod !== "UNKNOWN")
        ? "증거별 기록 방식이 구분되어 있습니다."
        : "화면 캡처, 검색결과 기록, 플랫폼 신고 회신 등 기록 방식을 보강해야 합니다.",
      evidenceItems.map((item) => item.captureMethod || "UNKNOWN").join(", ") || "증거 없음",
      "VICTIM",
    ),
    check(
      "integrity-fingerprint",
      "무결성 지문",
      allEvidenceHave(evidenceItems, (item) => Boolean(clean(item.evidenceHash))) ? "PASS" : someEvidenceHave(evidenceItems, (item) => Boolean(clean(item.metadataFingerprint))) ? "REVIEW" : "BLOCKED",
      allEvidenceHave(evidenceItems, (item) => Boolean(clean(item.evidenceHash)))
        ? "증거 해시가 있어 제출 전후 동일성을 설명할 수 있습니다."
        : "메타데이터 지문은 있으나 원본 파일 해시가 부족할 수 있습니다. 기관 안내가 있을 때 별도 산출하세요.",
      packet.evidenceSummaries.map((item) => item.evidenceHash || item.metadataFingerprint).join(", ") || "지문 없음",
      "SUPPORTER",
    ),
    check(
      "evidence-custody-chain",
      "증거 인계·검증 메타데이터",
      custodyStatus,
      custodyWarnings.length
        ? custodyWarnings.join("; ")
        : custodyMissing.length
          ? custodyMissing.join(", ")
          : "증거별 collector, device, capture method, hash algorithm, verification timestamp, handoff recipient ref가 준비되어 있습니다.",
      custodyMissing.length ? custodyMissing.join(", ") : packet.evidenceChain.manifestFingerprint,
      "SUPPORTER",
    ),
    check(
      "request-history",
      "제출 대상·요청 이력",
      hasRequestLog(evidenceItems) ? "PASS" : "REVIEW",
      hasRequestLog(evidenceItems)
        ? "기존 삭제·신고 요청 이력 또는 접수 단서가 기록되어 있습니다."
        : hasSubmissionTarget(evidenceItems)
          ? "제출 대상은 있으나 실제 요청 이력은 아직 부족합니다. 접수번호와 회신 여부를 추후 보강하세요."
          : "직접 삭제요청 전/후 기록, 접수번호, 회신 여부를 추후 보강하세요.",
      evidenceItems.flatMap((item) => item.requestLogs || []).map((log) => log.receiptId || log.target || log.status).join(", ") || "요청 이력 없음",
      "VICTIM",
    ),
    check(
      "original-media-boundary",
      "원본 피해물 취급",
      hasOriginalMediaMetadata(evidenceItems) ? "REVIEW" : "PASS",
      hasOriginalMediaMetadata(evidenceItems)
        ? "로컬 원본 파일 메타데이터가 있습니다. ZIP에는 원본을 넣지 말고 기관 안내가 있을 때 최소 범위로 별도 제출하세요."
        : "제출 패키지에는 원본 피해물이 포함되지 않는 구조입니다.",
      hasOriginalMediaMetadata(evidenceItems) ? "파일 메타데이터 있음" : "원본 파일 첨부 없음",
      "SUPPORTER",
    ),
    check(
      "official-authority-boundary",
      "수사권한 분리",
      packet.lawfulInvestigationMemo.length && packet.safetyBoundaries.length ? "PASS" : "REVIEW",
      "IP·가입자·결제·서버 로그는 피해자가 직접 추적하지 않고 수사·심의기관 요청사항으로 분리합니다.",
      `${packet.lawfulInvestigationMemo.length}개 권한 메모 / ${packet.safetyBoundaries.length}개 안전 경계`,
      "OFFICIAL_AUTHORITY",
    ),
    check(
      "read-only-handoff",
      "지원자 읽기전용 전달",
      savedCase.auditLog?.some((entry) => entry.action === "SUPPORT_HANDOFF_EXPORTED") ? "PASS" : "REVIEW",
      savedCase.auditLog?.some((entry) => entry.action === "SUPPORT_HANDOFF_EXPORTED")
        ? "암호화된 읽기전용 전달 파일 생성 이력이 있습니다."
        : "상담자·지원자 검토가 필요하면 암호화된 읽기전용 전달 파일로 공유하세요.",
      savedCase.auditLog?.some((entry) => entry.action === "SUPPORT_HANDOFF_EXPORTED") ? "전달 이력 있음" : "전달 이력 없음",
      "SUPPORTER",
    ),
    check(
      "post-submission-follow-up",
      "접수 후 추적 기록",
      savedCase.auditLog?.some((entry) => entry.action === "SUBMISSION_VERSION_SAVED" || entry.action === "SUBMISSION_PACKET_DOWNLOADED") ? "PASS" : "REVIEW",
      savedCase.auditLog?.some((entry) => entry.action === "SUBMISSION_VERSION_SAVED" || entry.action === "SUBMISSION_PACKET_DOWNLOADED")
        ? "제출 패킷 또는 버전 저장 이력이 있어 후속 비교가 가능합니다."
        : "제출 전 버전을 저장해 접수번호·회신·추가 보강 요청을 같은 사건 보드에 이어 기록하세요.",
      savedCase.auditLog?.map((entry) => entry.action).join(", ") || "감사로그 없음",
      "VICTIM",
    ),
  ];

  const blockers = items.filter((item) => item.status === "BLOCKED");
  const reviewItems = items.filter((item) => item.status === "REVIEW");
  const score = scoreItems(items);
  const overallStatus: PreSubmissionOverallStatus = blockers.length ? "BLOCKED" : score >= 80 ? "READY_TO_SUBMIT" : "NEEDS_REVIEW";
  const warnings = [
    ...custodyWarnings,
    ...custodyMissing.map((item) => `Evidence custody review needed: ${item}`),
    "지움AI는 자동 제출·자동 고소·가해자 단정을 하지 않습니다.",
    "비공개방 침투, 초대링크 수집, 직접 잠입, 계정 구매, 다크웹 접속은 피해자 직접 수행 대상이 아닙니다.",
    "공식기관 제출 전 민감 원문과 원본 피해물 포함 여부를 다시 확인하세요.",
  ];
  const reportWithoutActions = {
    generatedAt: packet.generatedAt,
    caseId: savedCase.id,
    overallStatus,
    score,
    targets,
    items,
    blockers,
    reviewItems,
    warnings,
  };

  return {
    ...reportWithoutActions,
    nextActions: buildNextActions(reportWithoutActions),
  };
}

function formatItems(items: PreSubmissionCheckItem[]) {
  return items.length
    ? items.map((item) => `- [${preSubmissionStatusLabel(item.status)}] ${item.label}: ${item.detail}\n  - 근거: ${item.evidence}\n  - 담당: ${preSubmissionOwnerLabel(item.owner)}`).join("\n")
    : "- 해당 없음";
}

export function formatPreSubmissionChecklistMarkdown(report: PreSubmissionChecklistReport) {
  return `# 지움AI 수사·심의기관 제출 전 최종 검수표

- 사건 ID: ${report.caseId}
- 생성 시각: ${new Date(report.generatedAt).toLocaleString("ko-KR")}
- 전체 상태: ${preSubmissionStatusLabel(report.overallStatus)}
- 점수: ${report.score}점
- 제출 보류: ${report.blockers.length}건
- 검토 필요: ${report.reviewItems.length}건

## 기관별 제출 후보

${
  report.targets.length
    ? report.targets
        .map(
          (target, index) => `${index + 1}. ${target.agencyName}
   - 준비도: ${target.readinessScore}점 / ${target.readinessStatus}
   - 누락: ${target.missingCount}건
   - 검토: ${target.reviewCount}건
   - 다음 행동: ${target.nextAction}`,
        )
        .join("\n\n")
    : "- 기관 후보 없음"
}

## 제출 보류 항목

${formatItems(report.blockers)}

## 검토 필요 항목

${formatItems(report.reviewItems)}

## 전체 점검 항목

${formatItems(report.items)}

## 다음 행동

${report.nextActions.map((item) => `- ${item}`).join("\n")}

## 안전 경계

${report.warnings.map((item) => `- ${item}`).join("\n")}
`;
}
