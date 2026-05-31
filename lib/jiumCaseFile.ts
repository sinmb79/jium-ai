import { loadEncryptedVault, saveEncryptedVault, type EncryptedVaultState } from "@/lib/encryptedCaseStorage";
import { decryptJsonWithPassphrase, encryptJsonWithPassphrase, isEncryptedJsonPayload, type EncryptedJsonPayload } from "@/lib/localCrypto";
import type { SavedCase } from "@/lib/types";

export type JiumCaseArchive = {
  version: 1;
  kind: "JIUM_CASE_ARCHIVE";
  exportedAt: string;
  encrypted: EncryptedJsonPayload;
  warning: string;
};

const ARCHIVE_WARNING = "암호화된 지움AI 사건 파일입니다. 패스프레이즈 없이 복구할 수 없으며, 안전한 기기에서만 여세요.";

function newestFirst(cases: SavedCase[]) {
  return [...cases].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function mergeCases(current: SavedCase[], imported: SavedCase[]) {
  const byId = new Map<string, SavedCase>();

  [...current, ...imported].forEach((item) => {
    const existing = byId.get(item.id);
    if (!existing || Date.parse(item.updatedAt) >= Date.parse(existing.updatedAt)) {
      byId.set(item.id, item);
    }
  });

  return newestFirst(Array.from(byId.values()));
}

export async function buildJiumCaseArchive(cases: SavedCase[], passphrase: string, exportedAt = new Date().toISOString()): Promise<JiumCaseArchive> {
  const state: EncryptedVaultState = {
    savedAt: exportedAt,
    cases: newestFirst(cases),
  };

  return {
    version: 1,
    kind: "JIUM_CASE_ARCHIVE",
    exportedAt,
    encrypted: await encryptJsonWithPassphrase(state, passphrase),
    warning: ARCHIVE_WARNING,
  };
}

export function serializeJiumCaseArchive(archive: JiumCaseArchive) {
  return JSON.stringify(archive, null, 2);
}

export function parseJiumCaseArchive(text: string): JiumCaseArchive {
  const parsed = JSON.parse(text) as Partial<JiumCaseArchive>;
  if (parsed.version !== 1 || parsed.kind !== "JIUM_CASE_ARCHIVE" || !parsed.encrypted || !isEncryptedJsonPayload(parsed.encrypted)) {
    throw new Error("Unsupported Jium case archive");
  }
  return {
    version: 1,
    kind: "JIUM_CASE_ARCHIVE",
    exportedAt: parsed.exportedAt || new Date(0).toISOString(),
    encrypted: parsed.encrypted,
    warning: parsed.warning || ARCHIVE_WARNING,
  };
}

export async function decryptJiumCaseArchive(text: string, passphrase: string) {
  const archive = parseJiumCaseArchive(text);
  return decryptJsonWithPassphrase<EncryptedVaultState>(archive.encrypted, passphrase);
}

export async function exportEncryptedVaultAsJiumCase(passphrase: string) {
  const state = await loadEncryptedVault(passphrase);
  return buildJiumCaseArchive(state.cases, passphrase);
}

export async function importJiumCaseArchiveToVault(text: string, passphrase: string) {
  const imported = await decryptJiumCaseArchive(text, passphrase);
  const current = await loadEncryptedVault(passphrase);
  const cases = mergeCases(current.cases, imported.cases);
  return saveEncryptedVault(cases, passphrase);
}
