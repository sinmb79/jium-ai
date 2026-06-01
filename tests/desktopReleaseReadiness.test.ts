import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopReleaseReadinessReport,
  formatDesktopReleaseReadinessMarkdown,
  summarizeDesktopReleaseEnv,
  validateDesktopReleaseReadiness,
} from "../scripts/check-desktop-release-readiness.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-desktop-readiness-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeDesktopRepo(root: string) {
  await mkdir(path.join(root, "desktop"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "out", "dashboard"), { recursive: true });
  await mkdir(path.join(root, "out", "_next"), { recursive: true });
  await writeFile(path.join(root, "desktop", "electron-main.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(root, "desktop", "electron-preload.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "native-secure-vault-bridge.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "prepare-desktop-app-dir.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "package-desktop-dir.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "check-desktop-distribution.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "check-desktop-update-feed.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "build-desktop-release-bundle.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(root, "scripts", "check-desktop-signing-secrets.mjs"), "export {};\n", "utf8");
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          "electron-updater": "^6.8.3",
        },
        devDependencies: {
          electron: "^42.3.0",
          "electron-builder": "^26.8.1",
        },
        scripts: {
          "desktop:vault": "node scripts/native-secure-vault-bridge.mjs",
          "desktop:vault:describe": "node scripts/native-secure-vault-bridge.mjs describe",
          "desktop:export": "node scripts/build-desktop-export.mjs",
          "desktop:package:dir": "npm run desktop:export && node scripts/prepare-desktop-app-dir.mjs && node scripts/package-desktop-dir.mjs",
          "desktop:package:signed": "npm run desktop:export && node scripts/prepare-desktop-app-dir.mjs && npm run desktop:release:check && electron-builder --config electron-builder.config.cjs --publish never",
          "desktop:distribution:check": "node scripts/check-desktop-distribution.mjs",
          "desktop:update-feed:check": "node scripts/check-desktop-update-feed.mjs",
          "desktop:release:bundle": "node scripts/build-desktop-release-bundle.mjs",
          "desktop:signing-secrets:check": "node scripts/check-desktop-signing-secrets.mjs",
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

function releaseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    JIUM_DESKTOP_RELEASE_CHANNEL: "stable",
    JIUM_DESKTOP_UPDATE_URL: "https://updates.example.com/jium-ai",
    WINDOWS_SIGNING_CERT_SHA256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    CSC_LINK: "base64-redacted",
    CSC_KEY_PASSWORD: "password-redacted",
    APPLE_TEAM_ID: "ABCDE12345",
    APPLE_SIGNING_IDENTITY: "Developer ID Application: Example",
    LINUX_PACKAGE_SIGNING_KEY_ID: "linux-secret-key-id",
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop release readiness", () => {
  it("blocks incomplete desktop release workspaces", async () => {
    const root = await tempRepo();
    const result = validateDesktopReleaseReadiness({ root, env: {} as NodeJS.ProcessEnv });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("desktop file missing");
    expect(result.errors.join("\n")).toContain("package script missing");
    expect(result.errors.join("\n")).toContain("desktop static export");
    expect(result.errors.join("\n")).toContain("release channel");
  });

  it("accepts a signed HTTPS desktop release profile without leaking raw values", async () => {
    const root = await tempRepo();
    await writeDesktopRepo(root);

    const result = validateDesktopReleaseReadiness({ root, env: releaseEnv() });
    const report = buildDesktopReleaseReadinessReport(result, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatDesktopReleaseReadinessMarkdown(report);
    const serialized = JSON.stringify(report);

    expect(result.valid).toBe(true);
    expect(report.status).toBe("READY");
    expect(report.checks.every((check) => check.status === "PASS")).toBe(true);
    expect(markdown).toContain("JiumAI Desktop Release Readiness Report");
    expect(serialized).not.toContain("updates.example.com");
    expect(serialized).not.toContain("base64-redacted");
    expect(serialized).not.toContain("password-redacted");
    expect(serialized).not.toContain("ABCDE12345");
    expect(markdown).not.toContain("linux-secret-key-id");
  });

  it("summarizes signing and updater env presence only", () => {
    const summary = summarizeDesktopReleaseEnv(releaseEnv({ JIUM_DESKTOP_UPDATE_URL: "http://updates.example.com" }));

    expect(summary.JIUM_DESKTOP_UPDATE_URL).toBe("SET_NOT_HTTPS");
    expect(summary.WINDOWS_SIGNING_PROFILE).toBe("SET");
    expect(summary.SIGNING_PROFILE_COUNT).toBe(3);
    expect(JSON.stringify(summary)).not.toContain("updates.example.com");
    expect(JSON.stringify(summary)).not.toContain("0123456789abcdef");
    expect(JSON.stringify(summary)).not.toContain("base64-redacted");
  });

  it("writes CLI JSON and Markdown reports to operator-selected files", async () => {
    const root = await tempRepo();
    await writeDesktopRepo(root);
    const scriptPath = path.join(process.cwd(), "scripts", "check-desktop-release-readiness.mjs");
    const jsonPath = path.join(root, "reports", "desktop-readiness.json");
    const markdownPath = path.join(root, "reports", "desktop-readiness.md");

    const jsonRun = spawnSync(process.execPath, [scriptPath, "--json", "--output", jsonPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...releaseEnv() } as NodeJS.ProcessEnv,
    });
    const markdownRun = spawnSync(process.execPath, [scriptPath, "--markdown", "--output", markdownPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...releaseEnv() } as NodeJS.ProcessEnv,
    });
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    const markdown = await readFile(markdownPath, "utf8");

    expect(jsonRun.status).toBe(0);
    expect(markdownRun.status).toBe(0);
    expect(json.status).toBe("READY");
    expect(markdown).toContain("Status: READY");
    expect(JSON.stringify(json)).not.toContain("updates.example.com");
    expect(markdown).not.toContain("jium-ai-signing.pfx");
  });
});
