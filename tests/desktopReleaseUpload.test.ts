import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESKTOP_RELEASE_UPLOAD_SCHEMA,
  buildDesktopReleaseUploadReport,
  formatDesktopReleaseUploadMarkdown,
  writeDesktopReleaseUploadReportFiles,
} from "../scripts/check-desktop-release-upload.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.102") {
  const dir = path.join(os.tmpdir(), `jium-desktop-release-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

function readyReleaseView(version = "0.3.102") {
  return {
    tagName: `v${version}`,
    isDraft: false,
    isPrerelease: false,
    assets: [
      { name: `JiumAI-${version}-win-x64.exe`, size: 1234, downloadUrl: "https://github.com/sinmb79/jium-ai/releases/download/secret" },
      { name: `JiumAI-${version}-win-x64.exe.blockmap`, size: 234, downloadUrl: "https://github.com/sinmb79/jium-ai/releases/download/secret" },
      { name: "latest.yml", size: 456, downloadUrl: "https://github.com/sinmb79/jium-ai/releases/download/secret" },
      { name: "jium-ai-windows-signed-release-evidence.tgz", size: 789, downloadUrl: "https://github.com/sinmb79/jium-ai/releases/download/secret" },
    ],
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop release upload verification", () => {
  it("accepts uploaded signed desktop assets without leaking download URLs", async () => {
    const root = await tempRepo();
    const report = buildDesktopReleaseUploadReport({
      root,
      releaseTag: "v0.3.102",
      releaseView: readyReleaseView(),
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const markdown = formatDesktopReleaseUploadMarkdown(report);
    const serialized = JSON.stringify(report);

    expect(report.schema).toBe(DESKTOP_RELEASE_UPLOAD_SCHEMA);
    expect(report.status).toBe("READY");
    expect(report.summary.assetCount).toBe(4);
    expect(report.summary.evidenceArchiveStatus).toBe("PRESENT");
    expect(report.leakScan.status).toBe("PASS");
    expect(markdown).toContain("Desktop Release Upload Verification");
    expect(markdown).toContain("Evidence archive: PRESENT");
    expect(serialized).not.toContain("github.com");
    expect(serialized).not.toContain("releases/download/secret");
    expect(serialized).not.toContain("downloadUrl");
    expect(serialized).not.toContain(root);
  });

  it("blocks missing upload assets and draft releases", async () => {
    const root = await tempRepo();
    const releaseView = {
      tagName: "v0.3.102",
      isDraft: true,
      isPrerelease: false,
      assets: [{ name: "latest.yml", size: 456 }],
    };

    const report = buildDesktopReleaseUploadReport({
      root,
      releaseTag: "v0.3.102",
      releaseView,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.checks.find((check: { id: string }) => check.id === "release-draft-state")?.status).toBe("BLOCKED");
    expect(report.checks.find((check: { id: string }) => check.id === "windows-installer")?.status).toBe("BLOCKED");
    expect(report.errors.join("\n")).toContain("draft release");
  });

  it("runs the CLI from captured GitHub release JSON and guards output paths", async () => {
    const root = await tempRepo();
    await mkdir(path.join(root, "ops", "private"), { recursive: true });
    await writeFile(path.join(root, "ops", "private", "release-view.json"), JSON.stringify(readyReleaseView(), null, 2), "utf8");
    const scriptPath = path.join(process.cwd(), "scripts", "check-desktop-release-upload.mjs");
    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--release-tag",
        "v0.3.102",
        "--release-view-json",
        "ops/private/release-view.json",
        "--json",
        "--output",
        "reports/release-upload.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "release-upload.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(report.schema).toBe(DESKTOP_RELEASE_UPLOAD_SCHEMA);
    expect(report.status).toBe("READY");
    expect(JSON.stringify(report)).not.toContain("github.com");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--release-tag",
        "v0.3.102",
        "--release-view-json",
        "ops/private/release-view.json",
        "--json",
        "--output",
        "../unsafe-release-upload.json",
      ],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
  });
});
