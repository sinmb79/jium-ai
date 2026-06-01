import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopReleaseCandidateBundle,
  formatDesktopReleaseCandidateSummary,
} from "../scripts/build-desktop-release-bundle.mjs";
import { expectedDesktopDirArtifact } from "../scripts/package-desktop-dir.mjs";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar") as { createPackage: (source: string, dest: string) => Promise<void> };
const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-desktop-release-bundle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "desktop"), { recursive: true });
  await mkdir(path.join(dir, "scripts"), { recursive: true });
  await mkdir(path.join(dir, "out", "_next"), { recursive: true });
  await mkdir(path.join(dir, "out", "dashboard"), { recursive: true });
  await writeFile(path.join(dir, "desktop", "electron-main.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(dir, "desktop", "electron-preload.cjs"), "module.exports = {};\n", "utf8");
  for (const scriptName of [
    "native-secure-vault-bridge.mjs",
    "prepare-desktop-app-dir.mjs",
    "package-desktop-dir.mjs",
    "check-desktop-distribution.mjs",
    "check-desktop-update-feed.mjs",
    "build-desktop-release-bundle.mjs",
    "check-desktop-signing-secrets.mjs",
  ]) {
    await writeFile(path.join(dir, "scripts", scriptName), "export {};\n", "utf8");
  }
  await writeFile(path.join(dir, "out", "index.html"), "<!doctype html><script src=\"/_next/app.js\"></script>", "utf8");
  await writeFile(path.join(dir, "out", "dashboard", "index.html"), "<!doctype html><script src=\"/_next/app.js\"></script>", "utf8");
  await writeFile(path.join(dir, "out", "_next", "app.js"), "console.log('ok');\n", "utf8");
  await writeFile(path.join(dir, "next.config.ts"), "process.env.JIUM_DESKTOP_EXPORT;\n", "utf8");
  await writeFile(
    path.join(dir, "electron-builder.config.cjs"),
    [
      "module.exports = {",
      "  directories: { app: \"dist/electron-app\" },",
      "  files: [\"package.json\", \"node_modules/**\", \"out/**\", \"desktop/electron-main.cjs\", \"desktop/electron-preload.cjs\", \"scripts/native-secure-vault-bridge.mjs\"],",
      "  publish: [{ provider: \"generic\", url: \"https://updates.invalid/jium-ai\" }],",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        version: "0.1.0",
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
  return dir;
}

async function writeDesktopArtifacts(root: string) {
  const source = path.join(root, "asar-source");
  await mkdir(path.join(source, "desktop"), { recursive: true });
  await mkdir(path.join(source, "scripts"), { recursive: true });
  await mkdir(path.join(source, "out", "dashboard"), { recursive: true });
  await mkdir(path.join(source, "node_modules", "electron-updater"), { recursive: true });
  await writeFile(path.join(source, "package.json"), "{\"main\":\"desktop/electron-main.cjs\"}\n", "utf8");
  await writeFile(path.join(source, "desktop", "electron-main.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(source, "desktop", "electron-preload.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(source, "scripts", "native-secure-vault-bridge.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(source, "out", "index.html"), "<!doctype html>\n", "utf8");
  await writeFile(path.join(source, "out", "dashboard", "index.html"), "<!doctype html>\n", "utf8");
  await writeFile(path.join(source, "node_modules", "electron-updater", "package.json"), "{\"name\":\"electron-updater\"}\n", "utf8");

  const artifact = expectedDesktopDirArtifact(root, "win32");
  await mkdir(path.dirname(artifact.executable), { recursive: true });
  await mkdir(path.dirname(artifact.appArchive), { recursive: true });
  await writeFile(artifact.executable, "exe", "utf8");
  await asar.createPackage(source, artifact.appArchive);
  await mkdir(path.join(root, "dist", "electron-app"), { recursive: true });
  await writeFile(path.join(root, "dist", "electron-app", "package.json"), "{\"dependencies\":{\"electron-updater\":\"^6.8.3\"}}\n", "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop release candidate bundle", () => {
  it("writes redacted release candidate reports even when update metadata is not ready", async () => {
    const root = await tempRepo();
    await writeDesktopArtifacts(root);

    const result = await buildDesktopReleaseCandidateBundle({
      root,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: {
        JIUM_DESKTOP_RELEASE_CHANNEL: "stable",
        JIUM_DESKTOP_UPDATE_URL: "https://updates.example.com/jium-ai",
        CSC_LINK: "base64-redacted",
        CSC_KEY_PASSWORD: "password-redacted",
      } as unknown as NodeJS.ProcessEnv,
    });
    const summaryMarkdown = await readFile(path.join(root, "dist", "desktop-release-bundle", "desktop-release-candidate-summary.md"), "utf8");

    expect(result.valid).toBe(false);
    expect(result.summary.gates).toEqual([
      { id: "desktop-distribution", status: "READY", errorCount: 0 },
      { id: "desktop-release-readiness", status: "READY", errorCount: 0 },
      { id: "desktop-update-feed", status: "BLOCKED", errorCount: 6 },
    ]);
    expect(summaryMarkdown).toContain("JiumAI Desktop Release Candidate Bundle");
    expect(summaryMarkdown).not.toContain(root);
    expect(summaryMarkdown).not.toContain("updates.example.com");
    expect(formatDesktopReleaseCandidateSummary(result.summary)).toContain("desktop-update-feed");
  });
});
