import { buildEvidenceMetadataFingerprint, getEvidenceLedger } from "@/lib/evidence";
import type { CaseInput, EvidenceCaptureMethod, EvidenceHashAlgorithm, EvidenceItem, EvidenceRequestLog } from "@/lib/types";

export type EvidenceChainActor = "VICTIM_OR_HELPER" | "JIUM_AI" | "PLATFORM_OR_AGENCY";

export type EvidenceChainAction = "OBSERVED" | "CAPTURED" | "REQUESTED" | "PACKET_CREATED";

export type EvidenceChainCustody = {
  collectorRef?: string;
  deviceRef?: string;
  captureMethod: EvidenceCaptureMethod;
  hashAlgorithm: EvidenceHashAlgorithm;
  verifiedAt?: string;
  handoffRecipientRef?: string;
};

export type EvidenceChainEvent = {
  id: string;
  at?: string;
  actor: EvidenceChainActor;
  action: EvidenceChainAction;
  evidenceId?: string;
  summary: string;
  integrityReference: string;
  custody?: EvidenceChainCustody;
};

export type EvidenceChainSummary = {
  generatedAt: string;
  manifestFingerprint: string;
  events: EvidenceChainEvent[];
  missingForOperationalUse: string[];
  custodyWarnings: string[];
  handlingRules: string[];
};

const UNSAFE_CUSTODY_REF = "REDACTED_UNSAFE_CUSTODY_REF";
const CUSTODY_WARNING = "custody refs must be pseudonymous and cannot contain raw contact or URL values";

function stableText(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableText).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableText(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  const text = stableText(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `JIUM-CHAIN-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

function clean(value?: string) {
  return value?.trim() || "";
}

function evidenceIntegrity(item: EvidenceItem) {
  return item.evidenceHash || item.metadataFingerprint || buildEvidenceMetadataFingerprint(item);
}

function hasUnsafeCustodyRef(value: string) {
  return (
    /https?:\/\//i.test(value) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/.test(value) ||
    /\.onion\b/i.test(value) ||
    /\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\//i.test(value)
  );
}

function safeCustodyRef(value: string | undefined, warnings: Set<string>) {
  const ref = clean(value);
  if (!ref) {
    return undefined;
  }
  if (hasUnsafeCustodyRef(ref)) {
    warnings.add(CUSTODY_WARNING);
    return UNSAFE_CUSTODY_REF;
  }
  return ref.slice(0, 96);
}

function inferHashAlgorithm(item: EvidenceItem): EvidenceHashAlgorithm {
  if (item.hashAlgorithm && item.hashAlgorithm !== "UNKNOWN") {
    return item.hashAlgorithm;
  }
  const evidenceHash = clean(item.evidenceHash).toUpperCase();
  if (evidenceHash.startsWith("SHA256") || evidenceHash.startsWith("SHA-256")) {
    return "SHA-256";
  }
  if (clean(item.visualFingerprint).toLowerCase().startsWith("ahash-")) {
    return "A_HASH";
  }
  if (clean(item.metadataFingerprint)) {
    return "METADATA_FINGERPRINT";
  }
  return "UNKNOWN";
}

function buildCustody(item: EvidenceItem, warnings: Set<string>): EvidenceChainCustody {
  return {
    collectorRef: safeCustodyRef(item.collectorRef, warnings),
    deviceRef: safeCustodyRef(item.deviceRef, warnings),
    captureMethod: item.captureMethod || "UNKNOWN",
    hashAlgorithm: inferHashAlgorithm(item),
    verifiedAt: clean(item.verifiedAt) || undefined,
    handoffRecipientRef: safeCustodyRef(item.handoffRecipientRef, warnings),
  };
}

function hasUsableCustodyRef(value?: string) {
  return Boolean(value && value !== UNSAFE_CUSTODY_REF);
}

function evidenceLabel(item: EvidenceItem, index: number) {
  return item.platform || item.location || item.posterId || item.url || `접근경로 ${index + 1}`;
}

function requestEvent(item: EvidenceItem, log: EvidenceRequestLog, custody: EvidenceChainCustody): EvidenceChainEvent {
  return {
    id: `chain-${item.id}-${log.id}`,
    at: log.requestedAt,
    actor: "PLATFORM_OR_AGENCY",
    action: "REQUESTED",
    evidenceId: item.id,
    summary: `${log.target || "제출 대상"}에 ${log.status} 상태로 요청 기록${log.receiptId ? `, 접수번호 ${log.receiptId}` : ""}`,
    integrityReference: evidenceIntegrity(item),
    custody,
  };
}

function eventTime(value: EvidenceChainEvent) {
  const parsed = Date.parse(value.at || "");
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function custodyMissingItems(custody: EvidenceChainCustody) {
  const missing: string[] = [];
  if (!hasUsableCustodyRef(custody.collectorRef)) {
    missing.push("collector pseudonymous reference");
  }
  if (!hasUsableCustodyRef(custody.deviceRef)) {
    missing.push("collection device pseudonymous reference");
  }
  if (custody.hashAlgorithm === "UNKNOWN") {
    missing.push("hash algorithm");
  }
  if (!custody.verifiedAt) {
    missing.push("verification timestamp");
  }
  if (!hasUsableCustodyRef(custody.handoffRecipientRef)) {
    missing.push("handoff recipient pseudonymous reference");
  }
  return missing;
}

export function buildEvidenceChain(input: CaseInput, generatedAt = new Date().toISOString()): EvidenceChainSummary {
  const items = getEvidenceLedger(input);
  const events: EvidenceChainEvent[] = [];
  const custodyWarnings = new Set<string>();

  items.forEach((item, index) => {
    const label = evidenceLabel(item, index);
    const integrityReference = evidenceIntegrity(item);
    const custody = buildCustody(item, custodyWarnings);

    events.push({
      id: `chain-${item.id}-observed`,
      at: item.foundAt,
      actor: "VICTIM_OR_HELPER",
      action: "OBSERVED",
      evidenceId: item.id,
      summary: `${label} 발견 사실 기록`,
      integrityReference,
      custody,
    });

    events.push({
      id: `chain-${item.id}-captured`,
      at: item.capturedAt,
      actor: "VICTIM_OR_HELPER",
      action: "CAPTURED",
      evidenceId: item.id,
      summary: `${label} 캡처·해시·메타데이터 기록`,
      integrityReference,
      custody,
    });

    (item.requestLogs || []).forEach((log) => {
      events.push(requestEvent(item, log, custody));
    });
  });

  events.push({
    id: `chain-packet-${Date.parse(generatedAt) || 0}`,
    at: generatedAt,
    actor: "JIUM_AI",
    action: "PACKET_CREATED",
    summary: "기관 제출 패킷과 증거 체인 매니페스트 생성",
    integrityReference: "패킷 생성 시점 기준",
  });

  const sortedEvents = events.sort((left, right) => eventTime(left) - eventTime(right));
  const missing = new Set<string>();
  items.forEach((item) => {
    const custody = buildCustody(item, custodyWarnings);
    if (!item.evidenceHash) {
      missing.add("증거 파일 또는 캡처본 SHA-256 해시");
    }
    if (!item.capturedAt) {
      missing.add("캡처/기록 일시");
    }
    if (!item.captureMethod || item.captureMethod === "UNKNOWN") {
      missing.add("기록 방식");
    }
    if (!item.submissionTarget) {
      missing.add("제출 대상 또는 상담 기관");
    }
    custodyMissingItems(custody).forEach((item) => missing.add(item));
  });

  return {
    generatedAt,
    manifestFingerprint: fingerprint(
      sortedEvents.map((event) => ({
        at: event.at,
        actor: event.actor,
        action: event.action,
        evidenceId: event.evidenceId,
        integrityReference: event.integrityReference,
        custody: event.custody,
      })),
    ),
    events: sortedEvents,
    missingForOperationalUse: Array.from(missing),
    custodyWarnings: Array.from(custodyWarnings),
    handlingRules: [
      "원본 피해물은 지움AI에 업로드하지 않고, 사용자가 보유한 캡처·파일의 해시와 메타데이터만 기록합니다.",
      "제출 전 패킷 생성 시각, 증거별 무결성 참조, 요청 이력, 접수번호를 함께 보관합니다.",
      "custody ref에는 실명, 전화번호, 이메일, URL, 초대링크, onion 주소를 저장하지 않고 가명 참조만 사용합니다.",
      "증거 열람·보호·내보내기는 개인 안전 기기에서 수행하고, 공용 PC에서는 암호화 보관함을 열지 않습니다.",
      "기관 제출 후 접수번호와 응답 일시를 요청 이력에 추가해 체인을 이어갑니다.",
    ],
  };
}

function formatCustody(custody?: EvidenceChainCustody) {
  if (!custody) {
    return "collector=[packet] / device=[packet] / method=[packet] / hash=[packet] / verified=[packet] / handoff=[packet]";
  }
  return [
    `collector=${custody.collectorRef || "[missing]"}`,
    `device=${custody.deviceRef || "[missing]"}`,
    `method=${custody.captureMethod}`,
    `hash=${custody.hashAlgorithm}`,
    `verified=${custody.verifiedAt || "[missing]"}`,
    `handoff=${custody.handoffRecipientRef || "[missing]"}`,
  ].join(" / ");
}

export function evidenceChainToMarkdown(chain: EvidenceChainSummary) {
  return `### 증거 체인·인계 이력

- 체인 매니페스트: ${chain.manifestFingerprint}
- 생성일: ${new Date(chain.generatedAt).toLocaleString("ko-KR")}

이력:
${chain.events
  .map(
    (event, index) => `${index + 1}. ${event.at ? new Date(event.at).toLocaleString("ko-KR") : "[시각 미입력]"} · ${event.action} · ${event.summary}
   - 주체: ${event.actor}
   - 증거 ID: ${event.evidenceId || "[패킷 전체]"}
   - 무결성 참조: ${event.integrityReference}
   - custody: ${formatCustody(event.custody)}`,
  )
  .join("\n")}

Custody warnings:
${chain.custodyWarnings.length ? chain.custodyWarnings.map((item) => `- ${item}`).join("\n") : "- none"}

운영 보강 필요:
${chain.missingForOperationalUse.length ? chain.missingForOperationalUse.map((item) => `- ${item}`).join("\n") : "- 운영 제출에 충분한 체인 필드가 입력되어 있습니다."}

처리 원칙:
${chain.handlingRules.map((item) => `- ${item}`).join("\n")}
`;
}
