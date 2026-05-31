import { beforeEach, describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { clearEncryptedVault, encryptedVaultStorageKey, getEncryptedVaultStorageStatus, loadEncryptedVault, upsertEncryptedCase } from "@/lib/encryptedCaseStorage";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "개인정보가 노출됐어요",
  title: "민감 URL 보관",
  description: "공개 게시글에 개인정보가 노출됐습니다.",
  targetUrl: "https://example.com/private/post/123",
  platform: "Example",
  keywords: "alias",
  evidenceItems: [],
  exposedInfo: ["이메일"],
  urgent: false,
  helperMode: "self",
};

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-encrypted",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
    storageMode: "LOCAL_FIRST",
    input,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(input, classification),
    responsePack: generateResponsePack(input, classification),
    status: "READY",
    notes: [],
  };
}

describe("encrypted case storage", () => {
  beforeEach(() => {
    delete window.jiumSecureVault;
    clearEncryptedVault();
  });

  it("stores cases encrypted in localStorage and restores with the passphrase", async () => {
    await upsertEncryptedCase(savedCase(), "long passphrase for vault");
    const raw = window.localStorage.getItem(encryptedVaultStorageKey()) || "";

    expect(raw).not.toContain("민감 URL 보관");
    expect(raw).not.toContain("/private/post/123");

    const vault = await loadEncryptedVault("long passphrase for vault");

    expect(vault.cases).toHaveLength(1);
    expect(vault.cases[0]?.input.targetUrl).toBe("https://example.com/private/post/123");
    expect(vault.cases[0]?.auditLog?.some((entry) => entry.summary.includes("암호화 보관함"))).toBe(true);
  });

  it("uses a desktop secure-storage bridge when one is available", async () => {
    const bridgeStore = new Map<string, string>();
    window.jiumSecureVault = {
      readEncryptedVault: (key) => bridgeStore.get(key) || null,
      writeEncryptedVault: (key, value) => {
        bridgeStore.set(key, value);
      },
      deleteEncryptedVault: (key) => {
        bridgeStore.delete(key);
      },
      hasEncryptedVault: (key) => bridgeStore.has(key),
      describe: () => ({
        providerName: "Windows DPAPI test bridge",
        platform: "windows-dpapi",
        platformProtected: true,
      }),
    };

    await upsertEncryptedCase(savedCase(), "long passphrase for vault");

    const bridgeRaw = bridgeStore.get(encryptedVaultStorageKey()) || "";
    expect(window.localStorage.getItem(encryptedVaultStorageKey())).toBeNull();
    expect(bridgeRaw).not.toContain("민감 URL 보관");
    expect(bridgeRaw).not.toContain("/private/post/123");

    const status = await getEncryptedVaultStorageStatus();
    expect(status.kind).toBe("DESKTOP_SECURE_STORAGE_BRIDGE");
    expect(status.usesPlatformSecretStore).toBe(true);
    expect(status.providerName).toBe("Windows DPAPI test bridge");
    expect(status.hasVault).toBe(true);

    const vault = await loadEncryptedVault("long passphrase for vault");
    expect(vault.cases[0]?.input.targetUrl).toBe("https://example.com/private/post/123");
  });
});
