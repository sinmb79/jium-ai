import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopDistributionReport,
  formatDesktopDistributionMarkdown,
  validateDesktopDistribution,
} from "../scripts/check-desktop-distribution.mjs";
import { expectedDesktopDirArtifact } from "../scripts/package-desktop-dir.mjs";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar") as { createPackage: (source: string, dest: string) => Promise<void> };
const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-desktop-distribution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version: "0.1.0" }), "utf8");
  return dir;
}

async function writeAsarSource(root: string, options: { forbidden?: boolean } = {}) {
  const source = path.join(root, "asar-source");
  await mkdir(path.join(source, "desktop"), { recursive: true });
  await mkdir(path.join(source, "scripts"), { recursive: true });
  await mkdir(path.join(source, "out", "dashboard"), { recursive: true });
  await mkdir(path.join(source, "node_modules", "electron-updater"), { recursive: true });
  await writeFile(path.join(source, "package.json"), JSON.stringify({ main: "desktop/electron-main.cjs" }), "utf8");
  await writeFile(path.join(source, "desktop", "electron-main.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(source, "desktop", "electron-preload.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(source, "scripts", "native-secure-vault-bridge.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(source, "out", "index.html"), "<!doctype html>\n", "utf8");
  await writeFile(path.join(source, "out", "dashboard", "index.html"), "<!doctype html>\n", "utf8");
  await writeFile(path.join(source, "node_modules", "electron-updater", "package.json"), JSON.stringify({ name: "electron-updater" }), "utf8");
  if (options.forbidden) {
    await mkdir(path.join(source, "node_modules", "next"), { recursive: true });
    await writeFile(path.join(source, "node_modules", "next", "package.json"), JSON.stringify({ name: "next" }), "utf8");
  }
  return source;
}

async function writeDesktopPackage(root: string, options: { forbidden?: boolean } = {}) {
  const artifact = expectedDesktopDirArtifact(root, "win32");
  await mkdir(path.dirname(artifact.executable), { recursive: true });
  await mkdir(path.dirname(artifact.appArchive), { recursive: true });
  await writeFile(artifact.executable, "exe", "utf8");
  await asar.createPackage(await writeAsarSource(root, options), artifact.appArchive);
  await mkdir(path.join(root, "dist", "electron-app"), { recursive: true });
  await writeFile(
    path.join(root, "dist", "electron-app", "package.json"),
    JSON.stringify({ dependencies: { "electron-updater": "^6.8.3" } }, null, 2),
    "utf8",
  );
  return artifact;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop distribution report", () => {
  it("validates lean desktop package artifacts without leaking local paths", async () => {
    const root = await tempRepo();
    await writeDesktopPackage(root);

    const validation = await validateDesktopDistribution({ root, platform: "win32" });
    const report = buildDesktopDistributionReport(validation, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatDesktopDistributionMarkdown(report);

    expect(validation.valid).toBe(true);
    expect(validation.archiveInspection.missingEntries).toEqual([]);
    expect(validation.stagedApp.dependencies).toEqual(["electron-updater"]);
    expect(markdown).toContain("JiumAI Desktop Distribution Report");
    expect(markdown).not.toContain(root);
    expect(report.artifact.executableSha256).toBe(createHash("sha256").update("exe").digest("hex"));
  });

  it("blocks desktop packages that include root web dependencies", async () => {
    const root = await tempRepo();
    await writeDesktopPackage(root, { forbidden: true });

    const validation = await validateDesktopDistribution({ root, platform: "win32" });

    expect(validation.valid).toBe(false);
    expect(validation.errors.join("\n")).toContain("forbidden web/runtime dependency");
  });
});
