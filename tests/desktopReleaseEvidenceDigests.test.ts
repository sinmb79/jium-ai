import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopReleaseEvidenceDigests,
  formatDesktopReleaseEvidenceDigestsMarkdown,
} from "../scripts/build-desktop-release-evidence-digests.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.87") {
  const dir = path.join(os.tmpdir(), `jium-desktop-release-evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

async function writeSignedReleaseEvidence(root: string, version = "0.3.87") {
  const feedDir = path.join(root, "dist", "desktop");
  await mkdir(feedDir, { recursive: true });
  await writeFile(path.join(feedDir, `JiumAI-${version}-win-x64.exe`), "signed-installer", "utf8");
  await writeFile(path.join(feedDir, `JiumAI-${version}-win-x64.exe.blockmap`), "blockmap", "utf8");
  await writeFile(
    path.join(feedDir, "latest.yml"),
    [
      `version: ${version}`,
      `path: JiumAI-${version}-win-x64.exe`,
      "sha512: signedsha512",
      "releaseDate: 2026-06-01T00:00:00.000Z",
      "files:",
      `  - url: JiumAI-${version}-win-x64.exe`,
      "    sha512: signedsha512",
      "    size: 16",
      "",
    ].join("\n"),
    "utf8",
  );

  const bundleDir = path.join(root, "dist", "desktop-release-bundle");
  await mkdir(bundleDir, { recursive: true });
  await writeFile(
    path.join(bundleDir, "desktop-release-candidate-summary.json"),
    `${JSON.stringify(
      {
        schema: "jium-desktop-release-candidate-bundle-v1",
        generatedAt: "2026-06-01T00:00:00.000Z",
        status: "READY",
        version,
        commit: "abc123",
        platform: "win32",
        gates: [
          { id: "desktop-distribution", status: "READY", errorCount: 0 },
          { id: "desktop-release-readiness", status: "READY", errorCount: 0 },
          { id: "desktop-update-feed", status: "READY", errorCount: 0 },
        ],
        artifact: {
          executable: "JiumAI.exe",
          executableBytes: 123,
          executableSha256: "sha256-safe",
          appArchive: "app.asar",
          appArchiveBytes: 456,
          appArchiveSha256: "sha256-safe-archive",
        },
        reports: {},
        nextActions: ["Archive signed release evidence."],
        safetyNotes: ["No raw endpoint values are stored."],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(bundleDir, "desktop-release-candidate-summary.md"),
    [
      "# JiumAI Desktop Release Candidate Bundle",
      "",
      "- Status: READY",
      "- Version: 0.3.87",
      "- Installer: JiumAI-0.3.87-win-x64.exe",
      "",
    ].join("\n"),
    "utf8",
  );
  return feedDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop release evidence digests", () => {
  it("builds a redacted digest manifest for signed desktop release evidence", async () => {
    const root = await tempRepo();
    const feedDir = await writeSignedReleaseEvidence(root);

    const result = await buildDesktopReleaseEvidenceDigests({
      root,
      feedDir,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const markdown = formatDesktopReleaseEvidenceDigestsMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("READY");
    expect(result.report.summary.fileCount).toBe(5);
    expect(result.report.summary.readyFileCount).toBe(5);
    expect(result.report.aggregateDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.files.map((file) => file.fileName)).toEqual(
      expect.arrayContaining([
        "JiumAI-0.3.87-win-x64.exe",
        "JiumAI-0.3.87-win-x64.exe.blockmap",
        "latest.yml",
        "desktop-release-candidate-summary.json",
        "desktop-release-candidate-summary.md",
      ]),
    );
    expect(markdown).toContain("JiumAI Desktop Release Evidence Digests");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain(feedDir);
    expect(serialized).not.toContain("signed-installer");
  });

  it("blocks unsafe raw values in text evidence without echoing them", async () => {
    const root = await tempRepo();
    const feedDir = await writeSignedReleaseEvidence(root);
    await writeFile(
      path.join(root, "dist", "desktop-release-bundle", "desktop-release-candidate-summary.md"),
      "Do not publish https://updates.example.com/raw-endpoint\n",
      "utf8",
    );

    const result = await buildDesktopReleaseEvidenceDigests({
      root,
      feedDir,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.aggregateDigest).toBe("");
    expect(result.report.summary.unsafeFindingCount).toBeGreaterThan(0);
    expect(serialized).not.toContain("updates.example.com");
  });

  it("runs the CLI and rejects unsafe output paths", async () => {
    const root = await tempRepo();
    const feedDir = await writeSignedReleaseEvidence(root);
    const scriptPath = path.join(process.cwd(), "scripts", "build-desktop-release-evidence-digests.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--feed-dir", feedDir, "--platform", "win32", "--json", "--output", "../unsafe.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");

    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--feed-dir", feedDir, "--platform", "win32", "--json", "--output", "reports/desktop-digests.json"],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "desktop-digests.json"), "utf8"));
    const canonical = await readFile(
      path.join(root, "dist", "desktop-release-evidence-digests", "desktop-release-evidence-digests.md"),
      "utf8",
    );

    expect(run.status).toBe(0);
    expect(report.status).toBe("READY");
    expect(canonical).toContain("JiumAI Desktop Release Evidence Digests");
    expect(JSON.stringify(report)).not.toContain(root);
    expect(JSON.stringify(report)).not.toContain(feedDir);
  });
});
