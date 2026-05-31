import { beforeEach, describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { clearEncryptedVault, loadEncryptedVault, saveEncryptedVault } from "@/lib/encryptedCaseStorage";
import { buildJiumCaseArchive, decryptJiumCaseArchive, importJiumCaseArchiveToVault, serializeJiumCaseArchive } from "@/lib/jiumCaseFile";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "암호화 사건 파일 테스트",
  description: "공개 글에 피해 내용이 암시되어 있습니다.",
  targetUrl: "https://example.com/private/post/999?secret=true",
  platform: "Example Forum",
  keywords: "alias",
  evidenceItems: [],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

function savedCase(id = "case-jiumcase", updatedAt = "2026-05-31T00:00:00.000Z"): SavedCase {
  const classification = classifyCase(input);
  return {
    id,
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt,
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

describe("jium case archive", () => {
  beforeEach(() => {
    clearEncryptedVault();
  });

  it("exports an encrypted .jiumcase archive without plaintext case data", async () => {
    const archive = await buildJiumCaseArchive([savedCase()], "long passphrase for archive", "2026-05-31T01:00:00.000Z");
    const serialized = serializeJiumCaseArchive(archive);

    expect(serialized).toContain("JIUM_CASE_ARCHIVE");
    expect(serialized).not.toContain("암호화 사건 파일 테스트");
    expect(serialized).not.toContain("/private/post/999");

    const decrypted = await decryptJiumCaseArchive(serialized, "long passphrase for archive");

    expect(decrypted.cases).toHaveLength(1);
    expect(decrypted.cases[0]?.input.targetUrl).toBe("https://example.com/private/post/999?secret=true");
  });

  it("imports a .jiumcase archive into the encrypted vault and keeps the newest case copy", async () => {
    await saveEncryptedVault([savedCase("case-jiumcase", "2026-05-31T00:30:00.000Z")], "long passphrase for archive");
    const archive = await buildJiumCaseArchive([savedCase("case-jiumcase", "2026-05-31T02:00:00.000Z")], "long passphrase for archive");

    await importJiumCaseArchiveToVault(serializeJiumCaseArchive(archive), "long passphrase for archive");

    const vault = await loadEncryptedVault("long passphrase for archive");
    expect(vault.cases).toHaveLength(1);
    expect(vault.cases[0]?.updatedAt).toBe("2026-05-31T02:00:00.000Z");
  });
});
