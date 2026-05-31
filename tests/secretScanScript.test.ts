import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanTextForSecrets, runSecretScan } from "@/scripts/secret-scan.mjs";

describe("secret scan script", () => {
  it("detects high-confidence credentials and redacts previews", () => {
    const token = ["sk", "-proj-", "abcdefghijklmnopqrstuvwxyz123456"].join("");
    const findings = scanTextForSecrets(`OPENAI_API_KEY=${token}`, "sample.env");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.id).toBe("openai-api-key");
    expect(findings[0]?.preview).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });

  it("scans non-git folders in all-files mode", () => {
    const root = mkdtempSync(join(tmpdir(), "jium-secret-scan-"));
    try {
      writeFileSync(join(root, "safe.txt"), "OPENAI_API_KEY=\nAI_MODE=off\n", "utf8");
      const token = ["gh", "p_", "abcdefghijklmnopqrstuvwxyz1234567890"].join("");
      writeFileSync(join(root, "leaked.txt"), `token=${token}\n`, "utf8");

      const findings = runSecretScan({ root, allFiles: true });

      expect(findings.map((finding) => finding.filePath)).toContain("leaked.txt");
      expect(findings.map((finding) => finding.filePath)).not.toContain("safe.txt");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
