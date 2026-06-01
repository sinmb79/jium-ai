import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopUpdateFeedReport,
  formatDesktopUpdateFeedMarkdown,
  parseElectronUpdaterYaml,
  sha512FileBase64,
  updateFeedMetadataName,
  validateDesktopUpdateFeed,
} from "../scripts/check-desktop-update-feed.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-desktop-update-feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "dist", "desktop"), { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version: "1.2.3" }), "utf8");
  return dir;
}

async function writeFeed(root: string, options: { sha512?: string; size?: number; url?: string; version?: string } = {}) {
  const feedDir = path.join(root, "dist", "desktop");
  const artifactName = options.url || "JiumAI-1.2.3-win-x64.exe";
  const artifactPath = path.join(feedDir, artifactName);
  await writeFile(artifactPath, "installer", "utf8");
  const sha512 = options.sha512 || (await sha512FileBase64(artifactPath));
  const size = options.size ?? 9;
  await writeFile(
    path.join(feedDir, "latest.yml"),
    [
      `version: ${options.version || "1.2.3"}`,
      "files:",
      `  - url: ${artifactName}`,
      `    sha512: ${sha512}`,
      `    size: ${size}`,
      `path: ${artifactName}`,
      `sha512: ${sha512}`,
      "releaseDate: '2026-06-01T00:00:00.000Z'",
      "",
    ].join("\n"),
    "utf8",
  );
  return feedDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop update feed readiness", () => {
  it("parses electron-updater metadata and platform filenames", () => {
    expect(updateFeedMetadataName("win32")).toBe("latest.yml");
    expect(updateFeedMetadataName("darwin")).toBe("latest-mac.yml");
    expect(updateFeedMetadataName("linux")).toBe("latest-linux.yml");
    expect(parseElectronUpdaterYaml("version: 1.0.0\nfiles:\n  - url: app.exe\n    sha512: abc\n    size: 10\npath: app.exe\n")).toMatchObject({
      version: "1.0.0",
      path: "app.exe",
      files: [{ url: "app.exe", sha512: "abc", size: 10 }],
    });
  });

  it("validates a same-build generic update feed without leaking local paths", async () => {
    const root = await tempRepo();
    const feedDir = await writeFeed(root);

    const validation = await validateDesktopUpdateFeed({ root, feedDir, platform: "win32" });
    const report = buildDesktopUpdateFeedReport(validation, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatDesktopUpdateFeedMarkdown(report);

    expect(validation.valid).toBe(true);
    expect(validation.artifacts[0]).toMatchObject({ path: "JiumAI-1.2.3-win-x64.exe", sha512Status: "MATCH", sizeStatus: "MATCH" });
    expect(markdown).toContain("JiumAI Desktop Update Feed Report");
    expect(markdown).not.toContain(root);
  });

  it("blocks mismatched update metadata", async () => {
    const root = await tempRepo();
    const feedDir = await writeFeed(root, { sha512: "bad", size: 1, version: "9.9.9" });

    const validation = await validateDesktopUpdateFeed({ root, feedDir, platform: "win32" });

    expect(validation.valid).toBe(false);
    expect(validation.errors.join("\n")).toContain("version mismatch");
    expect(validation.errors.join("\n")).toContain("sha512 mismatch");
    expect(validation.errors.join("\n")).toContain("size mismatch");
  });
});
