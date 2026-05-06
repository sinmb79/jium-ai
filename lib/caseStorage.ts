import type { CaseStatus, SavedCase } from "@/lib/types";
import { generateResponsePack } from "@/lib/responsePack";

const STORAGE_KEY = "jium-ai.local-cases.v1";

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
    return (parsed as SavedCase[]).map((item) => {
      const responsePack = item.responsePack;
      return {
        ...item,
        responsePack: responsePack?.serviceIntegrations ? responsePack : generateResponsePack(item.input, item.classification),
      };
    });
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
  const current = loadCases();
  const index = current.findIndex((item) => item.id === savedCase.id);
  const next = index >= 0 ? current.map((item) => (item.id === savedCase.id ? savedCase : item)) : [savedCase, ...current];
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
        }
      : item,
  );
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
