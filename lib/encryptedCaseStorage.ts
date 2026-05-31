import { appendAuditLog } from "@/lib/caseStorage";
import { decryptJsonWithPassphrase, encryptJsonWithPassphrase, isEncryptedJsonPayload, type EncryptedJsonPayload } from "@/lib/localCrypto";
import type { SavedCase } from "@/lib/types";

const ENCRYPTED_STORAGE_KEY = "jium-ai.encrypted-cases.v1";
const ENCRYPTED_NOTE = "이 사본은 사용자가 입력한 패스프레이즈로 브라우저 localStorage에 암호화 보관됩니다. 패스프레이즈는 저장하지 않습니다.";

export type EncryptedVaultState = {
  savedAt: string;
  cases: SavedCase[];
};

function readPayload(): EncryptedJsonPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(ENCRYPTED_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return isEncryptedJsonPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasEncryptedVault() {
  return Boolean(readPayload());
}

export async function loadEncryptedVault(passphrase: string): Promise<EncryptedVaultState> {
  const payload = readPayload();
  if (!payload) {
    return { savedAt: new Date(0).toISOString(), cases: [] };
  }
  return decryptJsonWithPassphrase<EncryptedVaultState>(payload, passphrase);
}

export async function saveEncryptedVault(cases: SavedCase[], passphrase: string) {
  if (typeof window === "undefined") {
    return { savedAt: new Date(0).toISOString(), cases: [] };
  }
  const state: EncryptedVaultState = {
    savedAt: new Date().toISOString(),
    cases,
  };
  const payload = await encryptJsonWithPassphrase(state, passphrase);
  window.localStorage.setItem(ENCRYPTED_STORAGE_KEY, JSON.stringify(payload));
  return state;
}

export async function upsertEncryptedCase(savedCase: SavedCase, passphrase: string) {
  const current = await loadEncryptedVault(passphrase);
  const encryptedCase = appendAuditLog(
    {
      ...savedCase,
      notes: savedCase.notes.includes(ENCRYPTED_NOTE) ? savedCase.notes : [...savedCase.notes, ENCRYPTED_NOTE],
    },
    "STORED",
    "패스프레이즈 기반 암호화 보관함에 저장",
  );
  const index = current.cases.findIndex((item) => item.id === encryptedCase.id);
  const cases = index >= 0 ? current.cases.map((item) => (item.id === encryptedCase.id ? encryptedCase : item)) : [encryptedCase, ...current.cases];
  return saveEncryptedVault(cases, passphrase);
}

export function clearEncryptedVault() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
  }
}

export function encryptedVaultStorageKey() {
  return ENCRYPTED_STORAGE_KEY;
}
