#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDesktopDistributionReport,
  formatDesktopDistributionMarkdown,
  validateDesktopDistribution,
} from "./check-desktop-distribution.mjs";
import {
  buildDesktopReleaseReadinessReport,
  formatDesktopReleaseReadinessMarkdown,
  validateDesktopReleaseReadiness,
} from "./check-desktop-release-readiness.mjs";
import {
  buildDesktopUpdateFeedReport,
  formatDesktopUpdateFeedMarkdown,
  validateDesktopUpdateFeed,
} from "./check-desktop-update-feed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
export const DESKTOP_RELEASE_BUNDLE_DIR = "dist/desktop-release-bundle";

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePrepareBundleDir(root, bundleDir) {
  const resolved = path.resolve(root, bundleDir);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== DESKTOP_RELEASE_BUNDLE_DIR) {
    throw new Error(`Refusing to clean unsafe desktop release bundle directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function currentGitCommit(root, env = process.env) {
  if (env.GITHUB_SHA) {
    return env.GITHUB_SHA;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  writeFileSync(filePath, value, "utf8");
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

export async function buildDesktopReleaseCandidateBundle({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
} = {}) {
  const bundleDir = safePrepareBundleDir(root, DESKTOP_RELEASE_BUNDLE_DIR);
  const distributionValidation = await validateDesktopDistribution({ root, platform });
  const readinessValidation = validateDesktopReleaseReadiness({ root, env });
  const updateFeedValidation = await validateDesktopUpdateFeed({ root, platform });

  const distributionReport = buildDesktopDistributionReport(distributionValidation, { generatedAt });
  const readinessReport = buildDesktopReleaseReadinessReport(readinessValidation, { generatedAt });
  const updateFeedReport = buildDesktopUpdateFeedReport(updateFeedValidation, { generatedAt });

  const summary = {
    schema: "jium-desktop-release-candidate-bundle-v1",
    generatedAt,
    status: [distributionReport.status, readinessReport.status, updateFeedReport.status].every((status) => status === "READY") ? "READY" : "BLOCKED",
    version: readPackageVersion(root),
    commit: currentGitCommit(root, env),
    platform,
    gates: [
      {
        id: "desktop-distribution",
        status: distributionReport.status,
        errorCount: distributionReport.errors.length,
      },
      {
        id: "desktop-release-readiness",
        status: readinessReport.status,
        errorCount: readinessReport.errors.length,
      },
      {
        id: "desktop-update-feed",
        status: updateFeedReport.status,
        errorCount: updateFeedReport.errors.length,
      },
    ],
    artifact: distributionReport.artifact,
    reports: {
      distributionJson: "desktop-distribution-report.json",
      distributionMarkdown: "desktop-distribution-report.md",
      releaseReadinessJson: "desktop-release-readiness-report.json",
      releaseReadinessMarkdown: "desktop-release-readiness-report.md",
      updateFeedJson: "desktop-update-feed-report.json",
      updateFeedMarkdown: "desktop-update-feed-report.md",
    },
    nextActions: Array.from(
      new Set([...distributionReport.nextActions, ...readinessReport.nextActions, ...updateFeedReport.nextActions]),
    ),
    safetyNotes: [
      "This bundle is a release-candidate evidence packet, not proof that legal, institutional, signing, or update-hosting sign-off is complete.",
      "Reports use relative artifact names, byte sizes, digest values, and setting presence only.",
      "Do not add update endpoint secrets, certificate material, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers to this bundle.",
    ],
  };

  writeJson(path.join(bundleDir, "desktop-distribution-report.json"), distributionReport);
  writeText(path.join(bundleDir, "desktop-distribution-report.md"), formatDesktopDistributionMarkdown(distributionReport));
  writeJson(path.join(bundleDir, "desktop-release-readiness-report.json"), readinessReport);
  writeText(path.join(bundleDir, "desktop-release-readiness-report.md"), formatDesktopReleaseReadinessMarkdown(readinessReport));
  writeJson(path.join(bundleDir, "desktop-update-feed-report.json"), updateFeedReport);
  writeText(path.join(bundleDir, "desktop-update-feed-report.md"), formatDesktopUpdateFeedMarkdown(updateFeedReport));
  writeJson(path.join(bundleDir, "desktop-release-candidate-summary.json"), summary);
  writeText(path.join(bundleDir, "desktop-release-candidate-summary.md"), formatDesktopReleaseCandidateSummary(summary));

  return {
    valid: summary.status === "READY",
    bundleDir,
    bundleDirRelative: relativePath(root, bundleDir),
    summary,
  };
}

export function formatDesktopReleaseCandidateSummary(summary) {
  const lines = [
    "# JiumAI Desktop Release Candidate Bundle",
    "",
    `- Generated at: ${summary.generatedAt}`,
    `- Status: ${summary.status}`,
    `- Version: ${summary.version || "MISSING"}`,
    `- Commit: ${summary.commit || "MISSING"}`,
    `- Platform: ${summary.platform}`,
    "",
    "## Gates",
    ...summary.gates.map((gate) => `- ${gate.status} ${gate.id}: ${gate.errorCount} error(s)`),
    "",
    "## Artifact",
    `- Executable: ${summary.artifact.executable}`,
    `- Executable bytes: ${summary.artifact.executableBytes}`,
    `- Executable sha256: ${summary.artifact.executableSha256 || "MISSING"}`,
    `- App archive: ${summary.artifact.appArchive}`,
    `- App archive bytes: ${summary.artifact.appArchiveBytes}`,
    `- App archive sha256: ${summary.artifact.appArchiveSha256 || "MISSING"}`,
    "",
    "## Reports",
    ...Object.entries(summary.reports).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Next Actions",
    ...summary.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...summary.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = { format: "text" };
  for (const arg of argv) {
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const result = await buildDesktopReleaseCandidateBundle();
    if (args.format === "json") {
      console.log(JSON.stringify(result.summary, null, 2));
    } else {
      console.log(formatDesktopReleaseCandidateSummary(result.summary));
      console.log(`Desktop release candidate bundle written: ${result.bundleDirRelative}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
