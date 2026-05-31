import type { CaseInput, EvidenceCaptureMethod, EvidenceItem, EvidenceRequestLog, EvidenceRequestStatus, EvidenceStatus } from "@/lib/types";

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  DISCOVERED: "발견",
  SUBMITTED: "제출",
  IN_REVIEW: "검토 중",
  REMOVED: "삭제·차단",
  REAPPEARED: "재노출",
};

export const EVIDENCE_CAPTURE_METHOD_LABELS: Record<EvidenceCaptureMethod, string> = {
  UNKNOWN: "확인 필요",
  URL_ONLY: "URL/위치만 기록",
  USER_SCREENSHOT: "사용자 캡처",
  SEARCH_RESULT: "검색결과 기록",
  PLATFORM_REPORT: "플랫폼 신고함/회신",
  THIRD_PARTY_TIP: "제3자 제보",
};

export const EVIDENCE_REQUEST_STATUS_LABELS: Record<EvidenceRequestStatus, string> = {
  DRAFTED: "초안",
  SENT: "발송",
  RECEIVED: "접수 확인",
  REJECTED: "반려/불응",
  ESCALATED: "기관 격상",
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

function normalizeRequestLog(log: EvidenceRequestLog): EvidenceRequestLog {
  return {
    id: trim(log.id) || `request-${Math.random().toString(36).slice(2, 8)}`,
    target: trim(log.target),
    requestedAt: trim(log.requestedAt),
    channel: trim(log.channel),
    status: log.status || "DRAFTED",
    receiptId: trim(log.receiptId),
    notes: trim(log.notes),
  };
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildEvidenceMetadataFingerprint(item: EvidenceItem) {
  const payload = [
    trim(item.url),
    trim(item.platform),
    trim(item.location),
    trim(item.posterId),
    trim(item.foundAt),
    trim(item.capturedAt),
    item.captureMethod || "UNKNOWN",
    trim(item.visualFingerprint),
    trim(item.evidenceHash),
    trim(item.submissionTarget),
    item.status || "DISCOVERED",
  ].join("|");

  return `JIUM-META-${stableHash(payload).toUpperCase()}`;
}

export function createEvidenceItem(seed: Partial<EvidenceItem> = {}): EvidenceItem {
  const item: EvidenceItem = {
    id: seed.id || `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: seed.url || "",
    platform: seed.platform || "",
    location: seed.location || "",
    posterId: seed.posterId || "",
    foundAt: seed.foundAt || "",
    capturedAt: seed.capturedAt || "",
    captureMethod: seed.captureMethod || "UNKNOWN",
    capturedByUser: seed.capturedByUser ?? false,
    evidenceHash: seed.evidenceHash || "",
    hashSource: seed.hashSource || "",
    visualFingerprint: seed.visualFingerprint || "",
    fileName: seed.fileName || "",
    fileSize: seed.fileSize,
    fileMimeType: seed.fileMimeType || "",
    fileLastModified: seed.fileLastModified || "",
    submissionTarget: seed.submissionTarget || EVIDENCE_SUBMISSION_TARGETS[0],
    status: seed.status || "DISCOVERED",
    requestLogs: seed.requestLogs || [],
    notes: seed.notes || "",
  };
  return {
    ...item,
    metadataFingerprint: seed.metadataFingerprint || buildEvidenceMetadataFingerprint(item),
  };
}

export function hasEvidenceValue(item: EvidenceItem) {
  return Boolean(
    trim(item.url) ||
      trim(item.platform) ||
      trim(item.location) ||
      trim(item.posterId) ||
      trim(item.foundAt) ||
      trim(item.capturedAt) ||
      trim(item.evidenceHash) ||
      trim(item.hashSource) ||
      trim(item.visualFingerprint) ||
      trim(item.fileName) ||
      trim(item.notes) ||
      (item.requestLogs || []).some((log) => trim(log.target) || trim(log.receiptId) || trim(log.notes)) ||
      item.capturedByUser,
  );
}

export function normalizeEvidenceItem(item: EvidenceItem): EvidenceItem {
  const normalized: EvidenceItem = {
    id: item.id || `evidence-${Math.random().toString(36).slice(2, 8)}`,
    url: trim(item.url),
    platform: trim(item.platform),
    location: trim(item.location),
    posterId: trim(item.posterId),
    foundAt: trim(item.foundAt),
    capturedAt: trim(item.capturedAt),
    captureMethod: item.captureMethod || "UNKNOWN",
    capturedByUser: Boolean(item.capturedByUser),
    evidenceHash: trim(item.evidenceHash),
    hashSource: trim(item.hashSource),
    visualFingerprint: trim(item.visualFingerprint),
    fileName: trim(item.fileName),
    fileSize: item.fileSize,
    fileMimeType: trim(item.fileMimeType),
    fileLastModified: trim(item.fileLastModified),
    submissionTarget: trim(item.submissionTarget) || EVIDENCE_SUBMISSION_TARGETS[0],
    status: item.status || "DISCOVERED",
    requestLogs: (item.requestLogs || []).map(normalizeRequestLog).filter((log) => trim(log.target) || trim(log.receiptId) || trim(log.notes)),
    notes: trim(item.notes),
  };
  return {
    ...normalized,
    metadataFingerprint: buildEvidenceMetadataFingerprint(normalized),
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
        capturedAt: "",
        captureMethod: "URL_ONLY",
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
    .map((item) =>
      [
        item.url,
        item.platform,
        item.location,
        item.posterId,
        item.foundAt,
        item.capturedAt,
        item.captureMethod,
        item.submissionTarget,
        item.evidenceHash,
        item.hashSource,
        item.visualFingerprint,
        item.fileName,
        item.fileMimeType,
        item.notes,
        ...(item.requestLogs || []).map((log) => [log.target, log.receiptId, log.notes].filter(Boolean).join(" ")),
      ]
        .filter(Boolean)
        .join(" "),
    )
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
        `   - 캡처/기록 일시: ${item.capturedAt || "[캡처 또는 기록 일시 미입력]"}`,
        `   - 기록 방식: ${EVIDENCE_CAPTURE_METHOD_LABELS[item.captureMethod || "UNKNOWN"]}`,
        `   - 사용자 캡처 보유: ${item.capturedByUser ? "예" : "아니오 또는 미확인"}`,
        `   - 증거 해시: ${item.evidenceHash || "[기관 안내에 따라 필요한 경우 별도 산출]"}`,
        `   - 해시 출처: ${item.hashSource || "[미입력]"}`,
        `   - 이미지/영상 지문: ${item.visualFingerprint || "[미입력]"}`,
        `   - 로컬 파일 메타데이터: ${[item.fileName, item.fileSize ? `${item.fileSize} bytes` : "", item.fileMimeType, item.fileLastModified].filter(Boolean).join(" / ") || "[파일 원본 미첨부]"}`,
        `   - 메타데이터 지문: ${item.metadataFingerprint || buildEvidenceMetadataFingerprint(item)}`,
        `   - 제출 대상: ${item.submissionTarget || EVIDENCE_SUBMISSION_TARGETS[0]}`,
        `   - 처리 상태: ${EVIDENCE_STATUS_LABELS[item.status] || item.status}`,
        `   - 요청 이력: ${
          item.requestLogs?.length
            ? item.requestLogs
                .map((log) => `${log.target || "대상 미입력"} / ${EVIDENCE_REQUEST_STATUS_LABELS[log.status]} / ${log.receiptId || "접수번호 없음"} / ${log.requestedAt || "시각 미입력"}`)
                .join("; ")
            : "[요청 이력 없음]"
        }`,
        `   - 메모: ${item.notes || "[메모 없음]"}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export function countEvidenceUrls(input: CaseInput) {
  return getEvidenceLedger(input).filter((item) => Boolean(item.url)).length;
}
