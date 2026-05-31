import { buildSubmissionPacket, type SubmissionPacket } from "@/lib/submissionPacket";
import type { RiskLevel, SavedCase } from "@/lib/types";

export const SUBMISSION_SNAPSHOT_SCHEMA_VERSION = "1.0.0";
const SNAPSHOT_STORAGE_KEY = "jium-ai.submission-snapshots.v1";
const MAX_SNAPSHOTS_PER_CASE = 20;

export type SubmissionPacketSnapshot = {
  schemaVersion: typeof SUBMISSION_SNAPSHOT_SCHEMA_VERSION;
  caseId: string;
  savedAt: string;
  packetGeneratedAt: string;
  packetFingerprint: string;
  chainManifestFingerprint: string;
  caseStatus: SavedCase["status"];
  caseType: SavedCase["classification"]["caseType"];
  riskLevel: RiskLevel;
  evidenceCount: number;
  evidenceIds: string[];
  evidenceIntegrityRefs: string[];
  evidenceGaps: string[];
  agencyTargetIds: string[];
  agencyTargetNames: string[];
  promotionSurfaceIds: string[];
  matchChannelIds: string[];
  officialOnlyCount: number;
  safetyBoundaryCount: number;
};

export type SubmissionPacketChange = {
  field: string;
  label: string;
  severity: "INFO" | "MEDIUM" | "HIGH";
  before: string;
  after: string;
};

export type SubmissionPacketDiff = {
  status: "UNCHANGED" | "CHANGED";
  base: SubmissionPacketSnapshot;
  next: SubmissionPacketSnapshot;
  changes: SubmissionPacketChange[];
};

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
  return `JIUM-PACKET-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function integrityRef(summary: SubmissionPacket["evidenceSummaries"][number]) {
  return [summary.id, summary.metadataFingerprint, summary.evidenceHash || "", summary.visualFingerprint || "", summary.captureMethod].join("|");
}

export function buildSubmissionPacketSnapshot(savedCase: SavedCase, packet = buildSubmissionPacket(savedCase.input, savedCase.classification, savedCase.responsePack), savedAt = new Date().toISOString()): SubmissionPacketSnapshot {
  const agencyTargetIds = uniqueSorted(packet.agencyTargets.map((target) => target.id));
  const agencyTargetNames = uniqueSorted(packet.agencyTargets.map((target) => target.name));
  const promotionSurfaceIds = uniqueSorted(packet.promotionSurfacePlan.matches.map((match) => match.id));
  const matchChannelIds = uniqueSorted(packet.discoveryPlan.matchChannels.map((channel) => channel.id));
  const officialOnlyCount = packet.discoveryPlan.matchChannels.filter((channel) => channel.authority === "OFFICIAL_ONLY" || channel.authority === "SPECIALIST_ONLY").length;
  const evidenceIds = uniqueSorted(packet.evidenceSummaries.map((summary) => summary.id));
  const evidenceIntegrityRefs = uniqueSorted(packet.evidenceSummaries.map(integrityRef));
  const evidenceGaps = uniqueSorted(packet.evidenceGaps);

  const fingerprintPayload = {
    caseStatus: savedCase.status,
    caseType: savedCase.classification.caseType,
    riskLevel: savedCase.classification.riskLevel,
    deletionChance: savedCase.classification.deletionChance,
    chainManifestFingerprint: packet.evidenceChain.manifestFingerprint,
    evidenceIds,
    evidenceIntegrityRefs,
    evidenceGaps,
    agencyTargetIds,
    promotionSurfaceIds,
    matchChannelIds,
    officialOnlyCount,
    safetyBoundaries: uniqueSorted(packet.safetyBoundaries),
  };

  return {
    schemaVersion: SUBMISSION_SNAPSHOT_SCHEMA_VERSION,
    caseId: savedCase.id,
    savedAt,
    packetGeneratedAt: packet.generatedAt,
    packetFingerprint: fingerprint(fingerprintPayload),
    chainManifestFingerprint: packet.evidenceChain.manifestFingerprint,
    caseStatus: savedCase.status,
    caseType: savedCase.classification.caseType,
    riskLevel: savedCase.classification.riskLevel,
    evidenceCount: packet.evidenceSummaries.length,
    evidenceIds,
    evidenceIntegrityRefs,
    evidenceGaps,
    agencyTargetIds,
    agencyTargetNames,
    promotionSurfaceIds,
    matchChannelIds,
    officialOnlyCount,
    safetyBoundaryCount: packet.safetyBoundaries.length,
  };
}

function listChange(field: string, label: string, beforeValues: string[], afterValues: string[], severity: SubmissionPacketChange["severity"]) {
  const before = new Set(beforeValues);
  const after = new Set(afterValues);
  const added = afterValues.filter((value) => !before.has(value));
  const removed = beforeValues.filter((value) => !after.has(value));
  if (!added.length && !removed.length) {
    return undefined;
  }
  return {
    field,
    label,
    severity,
    before: beforeValues.length ? beforeValues.join(", ") : "없음",
    after: [...(added.length ? [`추가: ${added.join(", ")}`] : []), ...(removed.length ? [`삭제: ${removed.join(", ")}`] : [])].join(" / "),
  } satisfies SubmissionPacketChange;
}

function scalarChange(field: string, label: string, before: string | number, after: string | number, severity: SubmissionPacketChange["severity"]) {
  if (before === after) {
    return undefined;
  }
  return { field, label, severity, before: String(before), after: String(after) } satisfies SubmissionPacketChange;
}

export function compareSubmissionPacketSnapshots(base: SubmissionPacketSnapshot, next: SubmissionPacketSnapshot): SubmissionPacketDiff {
  const changes = [
    scalarChange("packetFingerprint", "패킷 지문", base.packetFingerprint, next.packetFingerprint, "HIGH"),
    scalarChange("chainManifestFingerprint", "증거 체인 매니페스트", base.chainManifestFingerprint, next.chainManifestFingerprint, "HIGH"),
    scalarChange("caseStatus", "사건 상태", base.caseStatus, next.caseStatus, "MEDIUM"),
    scalarChange("riskLevel", "위험도", base.riskLevel, next.riskLevel, "HIGH"),
    scalarChange("evidenceCount", "증거 건수", base.evidenceCount, next.evidenceCount, "HIGH"),
    listChange("evidenceIds", "증거 ID", base.evidenceIds, next.evidenceIds, "HIGH"),
    listChange("evidenceIntegrityRefs", "증거 지문/해시", base.evidenceIntegrityRefs, next.evidenceIntegrityRefs, "HIGH"),
    listChange("evidenceGaps", "보강 필요 항목", base.evidenceGaps, next.evidenceGaps, "MEDIUM"),
    listChange("agencyTargetNames", "기관 후보", base.agencyTargetNames, next.agencyTargetNames, "INFO"),
    listChange("promotionSurfaceIds", "홍보면 패턴", base.promotionSurfaceIds, next.promotionSurfaceIds, "MEDIUM"),
    listChange("matchChannelIds", "매칭 채널", base.matchChannelIds, next.matchChannelIds, "MEDIUM"),
    scalarChange("officialOnlyCount", "공식권한 인계 수", base.officialOnlyCount, next.officialOnlyCount, "MEDIUM"),
    scalarChange("safetyBoundaryCount", "안전 경계 수", base.safetyBoundaryCount, next.safetyBoundaryCount, "INFO"),
  ].filter(Boolean) as SubmissionPacketChange[];

  return {
    status: changes.length ? "CHANGED" : "UNCHANGED",
    base,
    next,
    changes,
  };
}

export function submissionPacketSnapshotToMarkdown(snapshot: SubmissionPacketSnapshot) {
  return `# 지움AI 제출 패킷 버전 스냅샷

- 사건 ID: ${snapshot.caseId}
- 저장 시각: ${new Date(snapshot.savedAt).toLocaleString("ko-KR")}
- 패킷 지문: ${snapshot.packetFingerprint}
- 증거 체인: ${snapshot.chainManifestFingerprint}
- 사건 상태: ${snapshot.caseStatus}
- 위험도: ${snapshot.riskLevel}
- 증거 건수: ${snapshot.evidenceCount}
- 공식권한 인계 수: ${snapshot.officialOnlyCount}

보강 필요:
${snapshot.evidenceGaps.length ? snapshot.evidenceGaps.map((item) => `- ${item}`).join("\n") : "- 없음"}

기관 후보:
${snapshot.agencyTargetNames.length ? snapshot.agencyTargetNames.map((item) => `- ${item}`).join("\n") : "- 없음"}
`;
}

export function submissionPacketDiffToMarkdown(diff: SubmissionPacketDiff) {
  return `# 지움AI 제출 패킷 버전 비교

- 기준 저장 시각: ${new Date(diff.base.savedAt).toLocaleString("ko-KR")}
- 현재 저장 시각: ${new Date(diff.next.savedAt).toLocaleString("ko-KR")}
- 기준 지문: ${diff.base.packetFingerprint}
- 현재 지문: ${diff.next.packetFingerprint}
- 상태: ${diff.status === "UNCHANGED" ? "변경 없음" : "변경 있음"}

${diff.changes.length
  ? diff.changes
      .map(
        (change, index) => `${index + 1}. [${change.severity}] ${change.label}
   - 이전: ${change.before}
   - 현재: ${change.after}`,
      )
      .join("\n\n")
  : "변경된 제출 패킷 항목이 없습니다."}
`;
}

function readStoredSnapshots(): SubmissionPacketSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNAPSHOT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as SubmissionPacketSnapshot[]).filter((item) => item.schemaVersion === SUBMISSION_SNAPSHOT_SCHEMA_VERSION) : [];
  } catch {
    return [];
  }
}

function writeStoredSnapshots(snapshots: SubmissionPacketSnapshot[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
  }
}

export function loadSubmissionPacketSnapshots(caseId?: string) {
  const snapshots = readStoredSnapshots().sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  return caseId ? snapshots.filter((snapshot) => snapshot.caseId === caseId) : snapshots;
}

export function latestSubmissionPacketSnapshot(caseId: string) {
  return loadSubmissionPacketSnapshots(caseId)[0] || null;
}

export function saveSubmissionPacketSnapshot(snapshot: SubmissionPacketSnapshot) {
  const others = readStoredSnapshots().filter((item) => item.caseId !== snapshot.caseId);
  const sameCase = [snapshot, ...readStoredSnapshots().filter((item) => item.caseId === snapshot.caseId && item.packetFingerprint !== snapshot.packetFingerprint)].slice(0, MAX_SNAPSHOTS_PER_CASE);
  const next = [...sameCase, ...others];
  writeStoredSnapshots(next);
  return snapshot;
}

export function clearSubmissionPacketSnapshots() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  }
}

export function submissionSnapshotStorageKey() {
  return SNAPSHOT_STORAGE_KEY;
}
