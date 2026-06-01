import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopPublishReadinessReport,
  formatDesktopPublishReadinessMarkdown,
  parseDesktopReleaseTag,
  inspectDesktopPublishArtifacts,
  validateDesktopPublishReadiness,
} from "../scripts/check-desktop-publish-readiness.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.48") {
  const dir = path.join(os.tmpdir(), `jium-desktop-publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

function readyValidations(version = "0.3.48") {
  return {
    distribution: {
      valid: true,
      errors: [],
      artifact: {
        executable: "dist/desktop/JiumAI.exe",
        executableBytes: 10,
        executableSha256: "sha256",
        appArchive: "dist/desktop/win-unpacked/resources/app.asar",
        appArchiveBytes: 10,
        appArchiveSha256: "sha256",
      },
    },
    releaseReadiness: {
      valid: true,
      errors: [],
    },
    updateFeed: {
      valid: true,
      errors: [],
      metadata: {
        file: "latest.yml",
        version,
        path: `JiumAI-${version}-win-x64.exe`,
        releaseDate: "2026-06-01T00:00:00.000Z",
        fileCount: 2,
      },
      artifacts: [
        {
          path: `JiumAI-${version}-win-x64.exe`,
          bytes: 123,
          sha512Status: "MATCH" as const,
          sizeStatus: "MATCH" as const,
        },
      ],
    },
    publishArtifacts: {
      valid: true,
      errors: [],
      files: [`JiumAI-${version}-win-x64.exe`, `JiumAI-${version}-win-x64.exe.blockmap`, "latest.yml"],
    },
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop publish readiness", () => {
  it("parses approved release tags", () => {
    expect(parseDesktopReleaseTag("v0.3.48")).toMatchObject({ valid: true, version: "0.3.48" });
    expect(parseDesktopReleaseTag("v0.3.48-rc.1")).toMatchObject({ valid: true, version: "0.3.48-rc.1" });
    expect(parseDesktopReleaseTag("release-0.3.48")).toMatchObject({ valid: false, version: "" });
  });

  it("accepts an approved GitHub publication profile without leaking token values", async () => {
    const root = await tempRepo();
    const readiness = await validateDesktopPublishReadiness({
      root,
      platform: "win32",
      env: {
        JIUM_DESKTOP_RELEASE_TAG: "v0.3.48",
        JIUM_DESKTOP_PUBLISH_APPROVAL: "APPROVED",
        GITHUB_REPOSITORY: "sinmb79/jium-ai",
        GH_TOKEN: "ghs_secret_token",
      } as unknown as NodeJS.ProcessEnv,
      validations: readyValidations(),
    });
    const report = buildDesktopPublishReadinessReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatDesktopPublishReadinessMarkdown(report);

    expect(readiness.valid).toBe(true);
    expect(report.status).toBe("READY");
    expect(markdown).toContain("JiumAI Desktop Publish Readiness Report");
    expect(JSON.stringify(report)).not.toContain("ghs_secret_token");
    expect(JSON.stringify(report)).not.toContain("sinmb79/jium-ai");
  });

  it("checks publishable Windows installer assets separately from distribution artifacts", async () => {
    const root = await tempRepo();
    const feedDir = path.join(root, "dist", "desktop");
    await mkdir(feedDir, { recursive: true });

    expect(inspectDesktopPublishArtifacts({ feedDir, platform: "win32" }).valid).toBe(false);

    await writeFile(path.join(feedDir, "JiumAI-0.3.48-win-x64.exe"), "installer", "utf8");
    await writeFile(path.join(feedDir, "JiumAI-0.3.48-win-x64.exe.blockmap"), "blockmap", "utf8");
    await writeFile(path.join(feedDir, "latest.yml"), "version: 0.3.48\n", "utf8");

    const result = inspectDesktopPublishArtifacts({ feedDir, platform: "win32" });

    expect(result.valid).toBe(true);
    expect(result.files).toEqual(["JiumAI-0.3.48-win-x64.exe", "JiumAI-0.3.48-win-x64.exe.blockmap", "latest.yml"]);
  });

  it("blocks version mismatch, missing approval, and missing upload credentials", async () => {
    const root = await tempRepo();
    const readiness = await validateDesktopPublishReadiness({
      root,
      env: {
        JIUM_DESKTOP_RELEASE_TAG: "v0.3.49",
      } as unknown as NodeJS.ProcessEnv,
      validations: readyValidations(),
    });
    const report = buildDesktopPublishReadinessReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("package version mismatch");
    expect(readiness.errors.join("\n")).toContain("publish approval missing");
    expect(readiness.errors.join("\n")).toContain("GitHub token missing");
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toEqual(
      expect.arrayContaining(["version-alignment", "manual-approval", "github-context"]),
    );
  });
});
