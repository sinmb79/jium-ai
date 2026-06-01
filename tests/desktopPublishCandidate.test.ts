import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESKTOP_PUBLISH_CANDIDATE_SCHEMA,
  buildDesktopPublishCandidate,
  formatDesktopPublishCandidateMarkdown,
} from "../scripts/build-desktop-publish-candidate.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.93") {
  const dir = path.join(os.tmpdir(), `jium-desktop-publish-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

function readyValidations(version = "0.3.93"): any {
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
    releaseEvidenceDigest: {
      valid: true,
      report: {
        status: "READY" as const,
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
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop publish candidate", () => {
  it("builds a publish approval candidate before human approval or GitHub upload context is present", async () => {
    const root = await tempRepo();
    const result = await buildDesktopPublishCandidate({
      root,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: {
        JIUM_DESKTOP_RELEASE_TAG: "v0.3.93",
      } as unknown as NodeJS.ProcessEnv,
      validations: readyValidations(),
    });
    const markdown = formatDesktopPublishCandidateMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.schema).toBe(DESKTOP_PUBLISH_CANDIDATE_SCHEMA);
    expect(result.report.status).toBe("READY_FOR_PUBLISH_APPROVAL");
    expect(result.report.summary.technicalErrorCount).toBe(0);
    expect(result.report.summary.approvalOrUploadWarningCount).toBe(3);
    expect(result.report.checks.find((check) => check.id === "manual-approval")?.status).toBe("PENDING");
    expect(result.report.checks.find((check) => check.id === "github-upload-context")?.status).toBe("PENDING");
    expect(markdown).toContain("JiumAI Desktop Publish Candidate");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("sinmb79/jium-ai");
    expect(serialized).not.toContain("ghs_secret_token");
  });

  it("marks the candidate ready for release upload when final publish readiness is complete", async () => {
    const root = await tempRepo();
    const result = await buildDesktopPublishCandidate({
      root,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: {
        JIUM_DESKTOP_RELEASE_TAG: "v0.3.93",
        JIUM_DESKTOP_PUBLISH_APPROVAL: "APPROVED",
        GITHUB_REPOSITORY: "sinmb79/jium-ai",
        GH_TOKEN: "ghs_secret_token",
      } as unknown as NodeJS.ProcessEnv,
      validations: readyValidations(),
    });

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("READY_FOR_RELEASE_UPLOAD");
    expect(result.report.summary.publishReadinessErrorCount).toBe(0);
    expect(result.report.warnings).toHaveLength(0);
    expect(result.report.checks.find((check) => check.id === "manual-approval")?.status).toBe("PASS");
    expect(result.report.checks.find((check) => check.id === "github-upload-context")?.status).toBe("PASS");
    expect(JSON.stringify(result.report)).not.toContain("sinmb79/jium-ai");
    expect(JSON.stringify(result.report)).not.toContain("ghs_secret_token");
  });

  it("blocks the candidate when signed artifacts or evidence digests are not technically ready", async () => {
    const root = await tempRepo();
    const validations = readyValidations();
    validations.releaseEvidenceDigest = {
      valid: false,
      report: {
        status: "BLOCKED",
        aggregateDigest: "",
        summary: {
          fileCount: 0,
          readyFileCount: 0,
          unsafeFindingCount: 0,
          errorCount: 1,
        },
        errors: ["desktop release evidence digest report missing"],
      },
    };

    const result = await buildDesktopPublishCandidate({
      root,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: {
        JIUM_DESKTOP_RELEASE_TAG: "v0.3.93",
      } as unknown as NodeJS.ProcessEnv,
      validations,
    });
    const canonical = await readFile(
      path.join(root, "dist", "desktop-publish-candidate", "desktop-publish-candidate-report.md"),
      "utf8",
    );

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("desktop publish release evidence digest");
    expect(canonical).toContain("Status: BLOCKED");
  });

  it("redacts unsafe strings from technical errors", async () => {
    const root = await tempRepo();
    const validations = readyValidations();
    validations.updateFeed = {
      ...validations.updateFeed,
      valid: false,
      errors: [
        "desktop update file entry must be a relative artifact path: https://updates.example.org/JiumAI.exe",
        `desktop update feed failed under ${root}`,
      ],
    };

    const result = await buildDesktopPublishCandidate({
      root,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: {
        JIUM_DESKTOP_RELEASE_TAG: "v0.3.93",
      } as unknown as NodeJS.ProcessEnv,
      validations,
    });
    const serialized = JSON.stringify(result.report);

    expect(result.report.status).toBe("BLOCKED");
    expect(serialized).not.toContain("updates.example.org");
    expect(serialized).not.toContain(root);
    expect(serialized).toContain("[REDACTED_URL]");
    expect(serialized).toContain("[REDACTED_REPO_ROOT]");
  });

  it("runs the CLI and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "build-desktop-publish-candidate.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--json", "--output", "../unsafe-report.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(existsSync(path.join(root, "..", "unsafe-report.json"))).toBe(false);
  });
});
