import { appendAuditLog } from "@/lib/caseStorage";
import { decryptJsonWithPassphrase, encryptJsonWithPassphrase, isEncryptedJsonPayload, type EncryptedJsonPayload } from "@/lib/localCrypto";
import type { SavedCase } from "@/lib/types";

const ENCRYPTED_STORAGE_KEY = "jium-ai.encrypted-cases.v1";
const ENCRYPTED_NOTE = "이 사본은 사용자가 입력한 패스프레이즈로 브라우저 localStorage에 암호화 보관됩니다. 패스프레이즈는 저장하지 않습니다.";

export type EncryptedVaultStorageKind = "BROWSER_LOCAL_STORAGE" | "DESKTOP_SECURE_STORAGE_BRIDGE";

export type DesktopSecureVaultBridgeInfo = {
  providerName?: string;
  platform?: "windows-dpapi" | "macos-keychain" | "linux-secret-service" | "custom";
  platformProtected?: boolean;
  warning?: string;
};

export type DesktopSecureVaultBridge = {
  readEncryptedVault: (key: string) => Promise<string | null> | string | null;
  writeEncryptedVault: (key: string, value: string) => Promise<void> | void;
  deleteEncryptedVault: (key: string) => Promise<void> | void;
  hasEncryptedVault?: (key: string) => Promise<boolean> | boolean;
  describe?: () => Promise<DesktopSecureVaultBridgeInfo> | DesktopSecureVaultBridgeInfo;
};

export type EncryptedVaultStorageStatus = {
  kind: EncryptedVaultStorageKind;
  label: string;
  available: boolean;
  hasVault: boolean;
  encryptedAtRest: boolean;
  usesPlatformSecretStore: boolean;
  providerName?: string;
  warnings: string[];
  checklist: string[];
};

export type EncryptedVaultState = {
  savedAt: string;
  cases: SavedCase[];
};

declare global {
  interface Window {
    jiumSecureVault?: DesktopSecureVaultBridge;
  }
}

function getDesktopSecureVaultBridge(): DesktopSecureVaultBridge | null {
  if (typeof window === "undefined") {
    return null;
  }
  const bridge = window.jiumSecureVault;
  if (
    bridge &&
    typeof bridge.readEncryptedVault === "function" &&
    typeof bridge.writeEncryptedVault === "function" &&
    typeof bridge.deleteEncryptedVault === "function"
  ) {
    return bridge;
  }
  return null;
}

function parsePayload(raw: string | null): EncryptedJsonPayload | null {
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

async function readPayload(): Promise<EncryptedJsonPayload | null> {
  if (typeof window === "undefined") {
    return null;
  }
  const bridge = getDesktopSecureVaultBridge();
  if (bridge) {
    return parsePayload(await bridge.readEncryptedVault(ENCRYPTED_STORAGE_KEY));
  }
  return parsePayload(window.localStorage.getItem(ENCRYPTED_STORAGE_KEY));
}

async function writePayload(payload: EncryptedJsonPayload) {
  if (typeof window === "undefined") {
    return;
  }
  const serialized = JSON.stringify(payload);
  const bridge = getDesktopSecureVaultBridge();
  if (bridge) {
    await bridge.writeEncryptedVault(ENCRYPTED_STORAGE_KEY, serialized);
    window.localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ENCRYPTED_STORAGE_KEY, serialized);
}

async function deletePayload() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
  const bridge = getDesktopSecureVaultBridge();
  if (bridge) {
    await bridge.deleteEncryptedVault(ENCRYPTED_STORAGE_KEY);
  }
}

export function hasEncryptedVault() {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(parsePayload(window.localStorage.getItem(ENCRYPTED_STORAGE_KEY)));
}

export async function hasEncryptedVaultAsync() {
  return Boolean(await readPayload());
}

export async function getEncryptedVaultStorageStatus(): Promise<EncryptedVaultStorageStatus> {
  if (typeof window === "undefined") {
    return {
      kind: "BROWSER_LOCAL_STORAGE",
      label: "브라우저 보관함",
      available: false,
      hasVault: false,
      encryptedAtRest: true,
      usesPlatformSecretStore: false,
      warnings: ["브라우저 환경에서만 보관함 상태를 확인할 수 있습니다."],
      checklist: ["실제 운영 배포에서는 신뢰 가능한 사용자 기기에서만 보관함을 열도록 안내"],
    };
  }

  const bridge = getDesktopSecureVaultBridge();
  if (bridge) {
    const info = bridge.describe ? await bridge.describe() : {};
    const hasVault =
      typeof bridge.hasEncryptedVault === "function"
        ? await bridge.hasEncryptedVault(ENCRYPTED_STORAGE_KEY)
        : Boolean(parsePayload(await bridge.readEncryptedVault(ENCRYPTED_STORAGE_KEY)));
    const providerName = info.providerName || "desktop secure storage bridge";
    return {
      kind: "DESKTOP_SECURE_STORAGE_BRIDGE",
      label: "데스크톱 보안 저장소",
      available: true,
      hasVault,
      encryptedAtRest: true,
      usesPlatformSecretStore: Boolean(info.platformProtected),
      providerName,
      warnings: info.platformProtected ? [] : [info.warning || "브리지가 OS 보안 저장소 보호 여부를 명시하지 않았습니다."],
      checklist: [
        `${providerName} 제공자 식별과 버전을 운영 기록에 남김`,
        "OS 계정 잠금, 디스크 암호화, 악성 확장프로그램 점검 후 보관함 열기",
        "브리지 장애 시 브라우저 localStorage로 자동 복사되지 않는지 확인",
      ],
    };
  }

  return {
    kind: "BROWSER_LOCAL_STORAGE",
    label: "브라우저 localStorage 보관",
    available: true,
    hasVault: hasEncryptedVault(),
    encryptedAtRest: true,
    usesPlatformSecretStore: false,
    warnings: ["현재 보관함은 패스프레이즈로 암호화되지만 OS 보안 저장소에는 연결되어 있지 않습니다."],
    checklist: [
      "공용 PC나 감염 의심 기기에서는 보관함을 열지 않음",
      "운영 배포 전 Windows DPAPI, macOS Keychain, Linux Secret Service 브리지를 연결",
      "패스프레이즈 분실 시 복구할 수 없음을 피해자에게 명확히 안내",
    ],
  };
}

export async function loadEncryptedVault(passphrase: string): Promise<EncryptedVaultState> {
  const payload = await readPayload();
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
  await writePayload(payload);
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
    const bridge = getDesktopSecureVaultBridge();
    if (bridge) {
      void bridge.deleteEncryptedVault(ENCRYPTED_STORAGE_KEY);
    }
  }
}

export async function clearEncryptedVaultAsync() {
  await deletePayload();
}

export function encryptedVaultStorageKey() {
  return ENCRYPTED_STORAGE_KEY;
}
