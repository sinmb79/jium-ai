import { buildDiscoveryResearchPlan } from "@/lib/discoveryResearchEngine";
import { buildPromotionSurfacePlan } from "@/lib/promotionSurfaceIntelligence";
import { buildTraceAnalysis } from "@/lib/traceEngine";
import type { SavedCase, TraceSignalSeverity } from "@/lib/types";

const LEARNING_STORAGE_KEY = "jium-ai.anonymized-learning.v1";

export type AnonymizedLearningRecord = {
  id: string;
  createdAt: string;
  caseType: string;
  riskLevel: string;
  deletionChance: string;
  evidenceCount: number;
  routeSignalIds: string[];
  promotionSurfaceIds: string[];
  matchChannelIds: string[];
  highestSeverity: TraceSignalSeverity;
  officialOnlyCount: number;
  specialistOnlyCount: number;
  status: string;
};

export type LearningSummary = {
  total: number;
  byCaseType: Record<string, number>;
  byRouteSignal: Record<string, number>;
  byPromotionSurface: Record<string, number>;
  officialOnlyCount: number;
  specialistOnlyCount: number;
};

function severityRank(value: TraceSignalSeverity) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[value];
}

function highestSeverity(values: TraceSignalSeverity[]): TraceSignalSeverity {
  return values.sort((a, b) => severityRank(b) - severityRank(a))[0] || "LOW";
}

function learningRecordId() {
  return `learning_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildAnonymizedLearningRecord(savedCase: SavedCase): AnonymizedLearningRecord {
  const trace = buildTraceAnalysis(savedCase.input);
  const discovery = buildDiscoveryResearchPlan(savedCase.input, savedCase.classification);
  const promotionSurface = buildPromotionSurfacePlan(savedCase.input);
  const routeSignalIds = trace.learningSignals.map((signal) => signal.id).sort();
  const officialOnlyCount = discovery.matchChannels.filter((channel) => channel.authority === "OFFICIAL_ONLY").length;
  const specialistOnlyCount = discovery.matchChannels.filter((channel) => channel.authority === "SPECIALIST_ONLY").length;

  return {
    id: learningRecordId(),
    createdAt: new Date().toISOString(),
    caseType: savedCase.classification.caseType,
    riskLevel: savedCase.classification.riskLevel,
    deletionChance: savedCase.classification.deletionChance,
    evidenceCount: trace.timeline.length,
    routeSignalIds,
    promotionSurfaceIds: promotionSurface.matches.map((match) => match.id).sort(),
    matchChannelIds: discovery.matchChannels.map((channel) => channel.id).sort(),
    highestSeverity: highestSeverity(trace.learningSignals.map((signal) => signal.severity)),
    officialOnlyCount,
    specialistOnlyCount,
    status: savedCase.status,
  };
}

export function unsafeLearningRecordMarkers(record: AnonymizedLearningRecord) {
  const serialized = JSON.stringify(record).toLowerCase();
  return ["http://", "https://", "@", "010-", "discord.gg/", "t.me/", ".onion"].filter((marker) => serialized.includes(marker));
}

export function loadLearningRecords(): AnonymizedLearningRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEARNING_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as AnonymizedLearningRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLearningRecord(record: AnonymizedLearningRecord) {
  if (typeof window === "undefined") {
    return [];
  }
  if (unsafeLearningRecordMarkers(record).length) {
    throw new Error("Learning record contains unsafe raw indicators");
  }
  const next = [record, ...loadLearningRecords()].slice(0, 200);
  window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearLearningRecords() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEARNING_STORAGE_KEY);
  }
}

export function summarizeLearningRecords(records: AnonymizedLearningRecord[]): LearningSummary {
  return records.reduce<LearningSummary>(
    (summary, record) => {
      summary.total += 1;
      summary.byCaseType[record.caseType] = (summary.byCaseType[record.caseType] || 0) + 1;
      record.routeSignalIds.forEach((id) => {
        summary.byRouteSignal[id] = (summary.byRouteSignal[id] || 0) + 1;
      });
      record.promotionSurfaceIds.forEach((id) => {
        summary.byPromotionSurface[id] = (summary.byPromotionSurface[id] || 0) + 1;
      });
      summary.officialOnlyCount += record.officialOnlyCount;
      summary.specialistOnlyCount += record.specialistOnlyCount;
      return summary;
    },
    { total: 0, byCaseType: {}, byRouteSignal: {}, byPromotionSurface: {}, officialOnlyCount: 0, specialistOnlyCount: 0 },
  );
}
