import { spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopSigningSecretsReport,
  formatDesktopSigningSecretsMarkdown,
  summarizeDesktopSigningSecrets,
  validateDesktopSigningSecrets,
} from "../scripts/check-desktop-signing-secrets.mjs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop signing secret preflight", () => {
  it("blocks signed packaging without an electron-builder signing profile", () => {
    const result = validateDesktopSigningSecrets({
      env: {
        JIUM_DESKTOP_RELEASE_CHANNEL: "stable",
        JIUM_DESKTOP_UPDATE_URL: "https://updates.example.com/jium-ai",
      } as unknown as NodeJS.ProcessEnv,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("signing profile missing");
    expect(result.summary.WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE).toBe("MISSING");
  });

  it("accepts CSC_LINK and CSC_KEY_PASSWORD without leaking values", () => {
    const env = {
      JIUM_DESKTOP_RELEASE_CHANNEL: "stable",
      JIUM_DESKTOP_UPDATE_URL: "https://updates.example.com/jium-ai",
      CSC_LINK: "base64-pfx-secret",
      CSC_KEY_PASSWORD: "password-secret",
      WINDOWS_SIGNING_CERT_SHA256: "0".repeat(64),
    } as unknown as NodeJS.ProcessEnv;
    const result = validateDesktopSigningSecrets({ env });
    const report = buildDesktopSigningSecretsReport(result, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatDesktopSigningSecretsMarkdown(report);

    expect(result.valid).toBe(true);
    expect(result.summary.WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE).toBe("SET");
    expect(markdown).toContain("JiumAI Desktop Signing Secret Preflight");
    expect(JSON.stringify(report)).not.toContain("base64-pfx-secret");
    expect(JSON.stringify(report)).not.toContain("password-secret");
    expect(JSON.stringify(report)).not.toContain("updates.example.com");
    expect(JSON.stringify(report)).not.toContain("00000000");
  });

  it("accepts Windows-specific CSC secrets", () => {
    const summary = summarizeDesktopSigningSecrets({
      WIN_CSC_LINK: "win-cert",
      WIN_CSC_KEY_PASSWORD: "win-password",
    } as unknown as NodeJS.ProcessEnv);

    expect(summary.WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE).toBe("SET");
    expect(summary.CSC_LINK).toBe("MISSING");
  });

  it("writes redacted CLI reports", async () => {
    const dir = path.join(os.tmpdir(), `jium-signing-secrets-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    tempDirs.push(dir);
    const outputPath = path.join(dir, "signing.json");
    const scriptPath = path.join(process.cwd(), "scripts", "check-desktop-signing-secrets.mjs");
    const result = spawnSync(process.execPath, [scriptPath, "--json", "--output", outputPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        JIUM_DESKTOP_RELEASE_CHANNEL: "stable",
        JIUM_DESKTOP_UPDATE_URL: "https://updates.example.com/jium-ai",
        CSC_LINK: "base64-pfx-secret",
        CSC_KEY_PASSWORD: "password-secret",
      },
    });
    const reportText = await readFile(outputPath, "utf8");

    expect(result.status).toBe(0);
    expect(reportText).toContain("\"status\": \"READY\"");
    expect(reportText).not.toContain("base64-pfx-secret");
    expect(reportText).not.toContain("password-secret");
    expect(reportText).not.toContain("updates.example.com");
  });
});
