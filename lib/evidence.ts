import type { CaseInput, EvidenceItem, EvidenceStatus } from "@/lib/types";

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  DISCOVERED: "발견",
  SUBMITTED: "제출",
  IN_REVIEW: "검토 중",
  REMOVED: "삭제·차단",
  REAPPEARED: "재노출",
};

export const EVIDENCE_SUBMISSION_TARGETS = [
  "전문기관 상담 후 결정",
  "중앙디지털성범죄피해자지원센터",
  "경찰청 ECRM",
  "방송미디어통신심의위원회",
  "KISA 개인정보침해 신고센터",
  "온라인피해365센터",
  "플랫폼 관리자",
  "검색엔진 삭제 요청",
  "법률상담",
  "기타",
];

function trim(value?: string) {
  return value?.trim() || "";
}

export function createEvidenceItem(seed: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: seed.id || `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: seed.url || "",
    platform: seed.platform || "",
    location: seed.location || "",
    posterId: seed.posterId || "",
    foundAt: seed.foundAt || "",
    capturedByUser: seed.capturedByUser ?? false,
    submissionTarget: seed.submissionTarget || EVIDENCE_SUBMISSION_TARGETS[0],
    status: seed.status || "DISCOVERED",
    notes: seed.notes || "",
  };
}

export function hasEvidenceValue(item: EvidenceItem) {
  return Boolean(
    trim(item.url) ||
      trim(item.platform) ||
      trim(item.location) ||
      trim(item.posterId) ||
      trim(item.foundAt) ||
      trim(item.notes) ||
      item.capturedByUser,
  );
}

export function normalizeEvidenceItem(item: EvidenceItem): EvidenceItem {
  return {
    id: item.id || `evidence-${Math.random().toString(36).slice(2, 8)}`,
    url: trim(item.url),
    platform: trim(item.platform),
    location: trim(item.location),
    posterId: trim(item.posterId),
    foundAt: trim(item.foundAt),
    capturedByUser: Boolean(item.capturedByUser),
    submissionTarget: trim(item.submissionTarget) || EVIDENCE_SUBMISSION_TARGETS[0],
    status: item.status || "DISCOVERED",
    notes: trim(item.notes),
  };
}

export function getEvidenceLedger(input: CaseInput): EvidenceItem[] {
  const explicitItems = (input.evidenceItems || []).map(normalizeEvidenceItem).filter(hasEvidenceValue);
  if (explicitItems.length) {
    return explicitItems;
  }

  if (trim(input.targetUrl) || trim(input.platform) || trim(input.keywords)) {
    return [
      normalizeEvidenceItem({
        id: "primary-access-path",
        url: input.targetUrl || "",
        platform: input.platform || "",
        posterId: input.keywords || "",
        foundAt: "",
        capturedByUser: false,
        submissionTarget: EVIDENCE_SUBMISSION_TARGETS[0],
        status: "DISCOVERED",
        notes: "기본 입력에서 만든 접근경로입니다.",
      }),
    ];
  }

  return [];
}

export function evidenceToSearchText(input: CaseInput) {
  return getEvidenceLedger(input)
    .map((item) => [item.url, item.platform, item.location, item.posterId, item.submissionTarget, item.notes].filter(Boolean).join(" "))
    .join("\n");
}

export function formatEvidenceLedgerForDocument(input: CaseInput) {
  const records = getEvidenceLedger(input);
  if (!records.length) {
    return "아직 확인된 URL 또는 게시 위치가 없습니다. 기관 상담 전 발견 일시, 게시 위치, 게시자 ID, 검색어를 최소 단서로 정리하세요.";
  }

  return records
    .map((item, index) =>
      [
        `${index + 1}. 접근경로`,
        `   - URL: ${item.url || "[URL 미입력]"}`,
        `   - 플랫폼/사이트: ${item.platform || "[플랫폼 미입력]"}`,
        `   - 게시 위치: ${item.location || "[게시판명, 방 이름, 검색결과 위치 등]"}`,
        `   - 게시자 ID·닉네임: ${item.posterId || "[확인된 단서 없음]"}`,
        `   - 발견 일시: ${item.foundAt || "[발견 일시 미입력]"}`,
        `   - 사용자 캡처 보유: ${item.capturedByUser ? "예" : "아니오 또는 미확인"}`,
        `   - 제출 대상: ${item.submissionTarget || EVIDENCE_SUBMISSION_TARGETS[0]}`,
        `   - 처리 상태: ${EVIDENCE_STATUS_LABELS[item.status] || item.status}`,
        `   - 메모: ${item.notes || "[메모 없음]"}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function countEvidenceUrls(input: CaseInput) {
  return getEvidenceLedger(input).filter((item) => Boolean(item.url)).length;
}
