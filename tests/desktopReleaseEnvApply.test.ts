import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyDesktopReleaseEnv,
  formatDesktopReleaseEnvApplyMarkdown,
  validateDesktopReleaseEnvApply,
} from "../scripts/apply-desktop-release-env.mjs";
import { validateDesktopReleaseReadiness } from "../scripts/check-desktop-release-readiness.mjs";
import { validateDesktopPublishReadiness } from "../scripts/check-desktop-publish-readiness.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.80") {
  const dir = path.join(os.tmpdir(), `jium-desktop-release-env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

async function writeDesktopRepo(root: string) {
  await mkdir(path.join(root, "desktop"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "out", "dashboard"), { recursive: true });
  await mkdir(path.join(root, "out", "_next"), { recursive: true });
  for (const relativePath of [
    "desktop/electron-main.cjs",
    "desktop/electron-preload.cjs",
    "scripts/native-secure-vault-bridge.mjs",
    "scripts/prepare-desktop-app-dir.mjs",
    "scripts/package-desktop-dir.mjs",
    "scripts/check-desktop-distribution.mjs",
    "scripts/check-desktop-update-feed.mjs",
    "scripts/build-desktop-release-bundle.mjs",
    "scripts/check-desktop-signing-secrets.mjs",
    "scripts/check-desktop-release-upload.mjs",
  ]) {
    await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
    await writeFile(path.join(root, relativePath), "export {};\n", "utf8");
  }
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        version: "0.3.80",
        dependencies: { "electron-updater": "^6.8.3" },
        devDependencies: { electron: "^42.3.0", "electron-builder": "^26.8.1" },
        scripts: {
          "desktop:vault": "node scripts/native-secure-vault-bridge.mjs",
          "desktop:vault:describe": "node scripts/native-secure-vault-bridge.mjs describe",
          "desktop:export": "node scripts/build-desktop-export.mjs",
          "desktop:package:dir": "npm run desktop:export && node scripts/prepare-desktop-app-dir.mjs && node scripts/package-desktop-dir.mjs",
          "desktop:package:signed": "npm run desktop:export && node scripts/prepare-desktop-app-dir.mjs && npm run desktop:release:check && electron-builder --config electron-builder.config.cjs --publish never",
          "desktop:distribution:check": "node scripts/check-desktop-distribution.mjs",
          "desktop:update-feed:check": "node scripts/check-desktop-update-feed.mjs",
          "desktop:release:bundle": "node scripts/build-desktop-release-bundle.mjs",
          "desktop:release-upload:check": "node scripts/check-desktop-release-upload.mjs",
          "desktop:release-upload:check:json": "node scripts/check-desktop-release-upload.mjs --json",
          "desktop:release-upload:check:markdown": "node scripts/check-desktop-release-upload.mjs --markdown",
          "desktop:signing-secrets:check": "node scripts/check-desktop-signing-secrets.mjs",
          "desktop:release-env:apply": "node scripts/apply-desktop-release-env.mjs",
          "desktop:release-env:apply:json": "node scripts/apply-desktop-release-env.mjs --json",
          "desktop:release-env:apply:markdown": "node scripts/apply-desktop-release-env.mjs --markdown",
          "desktop:release:check": "node scripts/check-desktop-release-readiness.mjs",
          "desktop:release:json": "node scripts/check-desktop-release-readiness.mjs --json",
          "desktop:release:markdown": "node scripts/check-desktop-release-readiness.mjs --markdown",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(path.join(root, "next.config.ts"), "process.env.JIUM_DESKTOP_EXPORT;\n", "utf8");
  await writeFile(
    path.join(root, "electron-builder.config.cjs"),
    [
      "module.exports = {",
      "  directories: { app: \"dist/electron-app\" },",
      "  files: [\"node_modules/**\", \"out/**\", \"desktop/electron-main.cjs\", \"desktop/electron-preload.cjs\", \"scripts/native-secure-vault-bridge.mjs\"],",
      "  publish: [{ provider: \"generic\", url: \"https://updates.invalid/jium-ai\" }],",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(path.join(root, "out", "index.html"), "<!doctype html><script src=\"/_next/app.js\"></script>", "utf8");
  await writeFile(path.join(root, "out", "dashboard", "index.html"), "<!doctype html><script src=\"/_next/app.js\"></script>", "utf8");
}

function signingEnv() {
  return {
    CSC_LINK: "base64-pfx-secret",
    CSC_KEY_PASSWORD: "password-secret",
    WINDOWS_SIGNING_CERT_SHA256: "0".repeat(64),
  } as unknown as NodeJS.ProcessEnv;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop release env apply", () => {
  it("applies non-secret desktop release env and lets readiness load it without leaking raw values", async () => {
    const root = await tempRepo();
    await writeDesktopRepo(root);

    const result = await applyDesktopReleaseEnv({
      root,
      channel: "stable",
      updateUrl: "https://updates.example.com/jium-ai/",
      releaseTag: "v0.3.80",
      publishApprovalRef: "DESKTOP-PUBLISH-APPROVAL-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, ".env.desktop.local"), "utf8");
    const readiness = validateDesktopReleaseReadiness({ root, env: signingEnv() });
    const reportText = JSON.stringify(result.report);
    const markdown = formatDesktopReleaseEnvApplyMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("APPLIED");
    expect(envText).toContain("JIUM_DESKTOP_RELEASE_CHANNEL=stable");
    expect(envText).toContain("JIUM_DESKTOP_UPDATE_URL=https://updates.example.com/jium-ai/");
    expect(envText).toContain("JIUM_DESKTOP_RELEASE_TAG=v0.3.80");
    expect(envText).toContain("JIUM_DESKTOP_PUBLISH_APPROVAL=APPROVED");
    expect(readiness.valid).toBe(true);
    expect(result.report.evidence.updateUrlDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.evidence.publishApprovalRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Desktop Release Env Apply");
    expect(reportText).not.toContain("updates.example.com");
    expect(reportText).not.toContain("DESKTOP-PUBLISH-APPROVAL-2026-001");
    expect(reportText).not.toContain(root);
  });

  it("feeds desktop publish readiness release tag and approval without storing tokens", async () => {
    const root = await tempRepo();
    await applyDesktopReleaseEnv({
      root,
      channel: "stable",
      updateUrl: "https://updates.example.com/jium-ai/",
      releaseTag: "v0.3.80",
      publishApprovalRef: "DESKTOP-PUBLISH-APPROVAL-2026-002",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });

    const readiness = await validateDesktopPublishReadiness({
      root,
      platform: "win32",
      env: {
        GITHUB_REPOSITORY: "sinmb79/jium-ai",
        GH_TOKEN: "ghs_secret_token",
      } as unknown as NodeJS.ProcessEnv,
      validations: {
        distribution: { valid: true, errors: [] },
        releaseReadiness: { valid: true, errors: [] },
        updateFeed: {
          valid: true,
          errors: [],
          metadata: {
            file: "latest.yml",
            version: "0.3.80",
            path: "JiumAI-0.3.80-win-x64.exe",
            releaseDate: "2026-06-01T00:00:00.000Z",
            fileCount: 2,
          },
          artifacts: [{ path: "JiumAI-0.3.80-win-x64.exe", bytes: 123, sha512Status: "MATCH", sizeStatus: "MATCH" }],
        },
        publishArtifacts: {
          valid: true,
          errors: [],
          files: ["JiumAI-0.3.80-win-x64.exe", "JiumAI-0.3.80-win-x64.exe.blockmap", "latest.yml"],
        },
        releaseEvidenceDigest: {
          valid: true,
          report: {
            status: "READY",
            aggregateDigest: "sha256-desktop-release-evidence",
            summary: {
              fileCount: 5,
              readyFileCount: 5,
              unsafeFindingCount: 0,
              errorCount: 0,
            },
            errors: [],
          },
        },
      },
    });

    expect(readiness.valid).toBe(true);
    expect(readiness.envSummary.JIUM_DESKTOP_RELEASE_TAG).toBe("SET");
    expect(readiness.envSummary.JIUM_DESKTOP_PUBLISH_APPROVAL).toBe("APPROVED");
  });

  it("tolerates UTF-8 BOM package metadata created by Windows tooling", async () => {
    const root = await tempRepo();
    await writeFile(path.join(root, "package.json"), `\uFEFF${JSON.stringify({ version: "0.3.80" })}`, "utf8");

    const result = await applyDesktopReleaseEnv({
      root,
      channel: "stable",
      updateUrl: "https://updates.example.com/jium-ai/",
      publishApprovalRef: "DESKTOP-PUBLISH-APPROVAL-2026-BOM",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, ".env.desktop.local"), "utf8");

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("APPLIED");
    expect(envText).toContain("JIUM_DESKTOP_RELEASE_TAG=v0.3.80");
  });

  it("blocks unsafe desktop release values before writing env", async () => {
    const root = await tempRepo();

    const plan = validateDesktopReleaseEnvApply({
      root,
      channel: "prod@example.com",
      updateUrl: "http://updates.example.com/jium-ai/",
      releaseTag: "release-0.3.80",
      publishApprovalRef: "https://approval.example/private",
    });
    const result = await applyDesktopReleaseEnv({
      root,
      channel: "prod@example.com",
      updateUrl: "http://updates.example.com/jium-ai/",
      releaseTag: "release-0.3.80",
      publishApprovalRef: "https://approval.example/private",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("channel must be a short release lane");
    expect(result.report.errors.join("\n")).toContain("updateUrl must use HTTPS");
    expect(result.report.errors.join("\n")).toContain("releaseTag must use vMAJOR.MINOR.PATCH");
    expect(result.report.errors.join("\n")).toContain("publishApprovalRef contains raw URL or contact value");
    await expect(readFile(path.join(root, ".env.desktop.local"), "utf8")).rejects.toThrow();
    expect(JSON.stringify(result.report)).not.toContain("approval.example");
  });

  it("runs the CLI and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "apply-desktop-release-env.mjs");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--channel",
        "stable",
        "--update-url",
        "https://updates.example.com/jium-ai/",
        "--release-tag",
        "v0.3.80",
        "--publish-approval-ref",
        "DESKTOP-PUBLISH-APPROVAL-2026-010",
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    await expect(readFile(path.join(root, ".env.desktop.local"), "utf8")).rejects.toThrow();

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--channel",
        "stable",
        "--update-url",
        "https://updates.example.com/jium-ai/",
        "--release-tag",
        "v0.3.80",
        "--publish-approval-ref",
        "DESKTOP-PUBLISH-APPROVAL-2026-010",
        "--json",
        "--output",
        "reports/desktop-release-env.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "desktop-release-env.json"), "utf8"));
    const envText = await readFile(path.join(root, ".env.desktop.local"), "utf8");

    expect(run.status).toBe(0);
    expect(report.status).toBe("APPLIED");
    expect(JSON.stringify(report)).not.toContain("updates.example.com");
    expect(envText).toContain("JIUM_DESKTOP_PUBLISH_APPROVAL=APPROVED");
  });
});
