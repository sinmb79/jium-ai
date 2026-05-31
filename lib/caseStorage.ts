import type { CaseAuditAction, CaseAuditEntry, CaseInput, CaseStatus, SavedCase } from "@/lib/types";
import { generateResponsePack } from "@/lib/responsePack";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { maskSensitiveText } from "@/lib/pii";
import { evidenceToSearchText, hasEvidenceValue, normalizeEvidenceItem } from "@/lib/evidence";

const STORAGE_KEY = "jium-ai.local-cases.v1";
const HIDDEN_URL_VALUE = "[URL 원문은 로컬 저장하지 않음]";
const STORAGE_NOTE = "로컬 저장본은 민감정보를 낮추기 위해 URL 원문과 차단 수준 정보를 보관하지 않습니다.";

export function createAuditEntry(action: CaseAuditAction, summary: string, at = new Date().toISOString()): CaseAuditEntry {
  return {
    id: `audit-${Date.parse(at) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at,
    action,
    summary: maskSensitiveText(summary),
  };
}

export function appendAuditLog(savedCase: SavedCase, action: CaseAuditAction, summary: string): SavedCase {
  return {
    ...savedCase,
    updatedAt: new Date().toISOString(),
    auditLog: [...(savedCase.auditLog || []), createAuditEntry(action, summary)],
  };
}

function safeUrlForStorage(value?: string) {
  if (!value?.trim()) {
    return value;
  }

  try {
    const url = new URL(value.trim());
    return `${url.origin}/[경로 숨김]`;
  } catch {
    return HIDDEN_URL_VALUE;
  }
}

export function sanitizeCaseInputForStorage(input: CaseInput): CaseInput {
  const keepExactUrls = Boolean(input.keepExactUrlsForSubmission);
  const evidenceItems = (input.evidenceItems || [])
    .map(normalizeEvidenceItem)
    .filter(hasEvidenceValue)
    .map((item) => ({
      ...item,
      url: keepExactUrls ? item.url : safeUrlForStorage(item.url) || "",
      platform: item.platform ? maskSensitiveText(item.platform) : item.platform,
      location: item.location ? maskSensitiveText(item.location) : item.location,
      posterId: item.posterId ? maskSensitiveText(item.posterId) : item.posterId,
      hashSource: item.hashSource ? maskSensitiveText(item.hashSource) : item.hashSource,
      visualFingerprint: item.visualFingerprint,
      fileName: item.fileName ? maskSensitiveText(item.fileName) : item.fileName,
      requestLogs: (item.requestLogs || []).map((log) => ({
        ...log,
        target: log.target ? maskSensitiveText(log.target) : log.target,
        channel: log.channel ? maskSensitiveText(log.channel) : log.channel,
        receiptId: log.receiptId ? maskSensitiveText(log.receiptId) : log.receiptId,
        notes: log.notes ? maskSensitiveText(log.notes) : log.notes,
      })),
      notes: item.notes ? maskSensitiveText(item.notes) : item.notes,
    }));

  return {
    ...input,
    situation: maskSensitiveText(input.situation),
    title: maskSensitiveText(input.title),
    description: maskSensitiveText(input.description),
    targetUrl: keepExactUrls ? input.targetUrl?.trim() : safeUrlForStorage(input.targetUrl),
    platform: input.platform ? maskSensitiveText(input.platform) : input.platform,
    keywords: input.keywords ? maskSensitiveText(input.keywords) : input.keywords,
    evidenceItems,
    keepExactUrlsForSubmission: keepExactUrls,
    exposedInfo: input.exposedInfo.map(maskSensitiveText),
  };
}

function isExpired(savedCase: SavedCase, now: number) {
  const expiresAt = Date.parse(savedCase.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function prepareCaseForStorage(savedCase: SavedCase): SavedCase {
  const input = sanitizeCaseInputForStorage(savedCase.input);
  const draft = generateRequestDraft(input, savedCase.classification);
  const responsePack = generateResponsePack(input, savedCase.classification);
  const redactedPreview = maskSensitiveText([input.title, input.description, input.targetUrl, input.platform, input.keywords, evidenceToSearchText(input), input.exposedInfo.join(" ")].filter(Boolean).join("\n"));
  const notes = savedCase.notes.includes(STORAGE_NOTE) ? savedCase.notes : [...savedCase.notes, STORAGE_NOTE];
  const auditLog = (savedCase.auditLog || []).map((entry) => ({
    ...entry,
    summary: maskSensitiveText(entry.summary),
  }));

  return {
    ...savedCase,
    input,
    redactedPreview,
    draft,
    responsePack,
    auditLog,
    notes,
  };
}

export function loadCases(): SavedCase[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const now = Date.now();
    const activeCases = (parsed as SavedCase[]).filter((item) => !isExpired(item, now));
    const normalized = activeCases.map((item) =>
      prepareCaseForStorage({
        ...item,
        notes: Array.isArray(item.notes) ? item.notes : [],
      }),
    );

    if (normalized.length !== parsed.length || JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      saveCases(normalized);
    }

    return normalized;
  } catch {
    return [];
  }
}

export function saveCases(cases: SavedCase[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

export function upsertCase(savedCase: SavedCase) {
  const safeCase = prepareCaseForStorage(appendAuditLog(savedCase, "STORED", "로컬 사건 보드에 저장"));
  const current = loadCases();
  const index = current.findIndex((item) => item.id === safeCase.id);
  const next = index >= 0 ? current.map((item) => (item.id === safeCase.id ? safeCase : item)) : [safeCase, ...current];
  saveCases(next);
  return next;
}

export function updateCaseStatus(id: string, status: CaseStatus) {
  const next = loadCases().map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          updatedAt: new Date().toISOString(),
          verifiedByUserAt: status === "USER_VERIFIED" ? new Date().toISOString() : item.verifiedByUserAt,
          auditLog: [...(item.auditLog || []), createAuditEntry("STATUS_CHANGED", `진행 상태를 ${status}로 변경`)],
        }
      : item,
  );
  saveCases(next);
  return next;
}

export function appendCaseAudit(id: string, action: CaseAuditAction, summary: string) {
  const next = loadCases().map((item) => (item.id === id ? appendAuditLog(item, action, summary) : item));
  saveCases(next);
  return next;
}

export function deleteCase(id: string) {
  const next = loadCases().filter((item) => item.id !== id);
  saveCases(next);
  return next;
}

export function clearCases() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
