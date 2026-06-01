#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDesktopDistribution } from "./check-desktop-distribution.mjs";
import { validateDesktopReleaseReadiness } from "./check-desktop-release-readiness.mjs";
import { validateDesktopUpdateFeed } from "./check-desktop-update-feed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function present(value) {
  return Boolean(String(value || "").trim());
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

export function parseDesktopReleaseTag(tag) {
  const value = String(tag || "").trim();
  const match = value.match(/^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  return {
    tag: value,
    valid: Boolean(match),
    version: match?.[1] || "",
  };
}

function statusFromValid(valid) {
  return valid ? "PASS" : "BLOCKED";
}

function summarizePublishEnv(env = process.env) {
  return {
    JIUM_DESKTOP_RELEASE_TAG: present(env.JIUM_DESKTOP_RELEASE_TAG) ? "SET" : "MISSING",
    JIUM_DESKTOP_PUBLISH_APPROVAL: env.JIUM_DESKTOP_PUBLISH_APPROVAL === "APPROVED" ? "APPROVED" : "MISSING_OR_NOT_APPROVED",
    GITHUB_REPOSITORY: present(env.GITHUB_REPOSITORY) ? "SET" : "MISSING",
    GITHUB_TOKEN: present(env.GITHUB_TOKEN) || present(env.GH_TOKEN) ? "SET" : "MISSING",
  };
}

export function inspectDesktopPublishArtifacts({ feedDir = path.join(repoRoot, "dist", "desktop"), platform = process.platform } = {}) {
  const errors = [];
  const resolvedFeedDir = path.resolve(feedDir);
  const files = existsSync(resolvedFeedDir)
    ? readdirSync(resolvedFeedDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort()
    : [];

  if (!existsSync(resolvedFeedDir)) {
    errors.push("desktop publish artifact directory missing");
  }

  if (platform === "win32") {
    if (!files.some((file) => file.toLowerCase().endsWith(".exe"))) {
      errors.push("desktop publish Windows installer artifact missing: *.exe");
    }
    if (!files.some((file) => file.toLowerCase().endsWith(".blockmap"))) {
      errors.push("desktop publish Windows blockmap artifact missing: *.blockmap");
    }
    if (!files.includes("latest.yml")) {
      errors.push("desktop publish Windows update metadata missing: latest.yml");
    }
  } else if (platform === "darwin") {
    if (!files.some((file) => file.toLowerCase().endsWith(".dmg") || file.toLowerCase().endsWith(".zip"))) {
      errors.push("desktop publish macOS installer artifact missing: *.dmg or *.zip");
    }
    if (!files.includes("latest-mac.yml")) {
      errors.push("desktop publish macOS update metadata missing: latest-mac.yml");
    }
  } else {
    if (!files.some((file) => file.toLowerCase().endsWith(".appimage"))) {
      errors.push("desktop publish Linux installer artifact missing: *.AppImage");
    }
    if (!files.includes("latest-linux.yml")) {
      errors.push("desktop publish Linux update metadata missing: latest-linux.yml");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    files,
  };
}

function publishNextActionFor(error) {
  if (error.includes("release tag")) {
    return "Set JIUM_DESKTOP_RELEASE_TAG to the approved installer release tag that matches package.json, for example vMAJOR.MINOR.PATCH.";
  }
  if (error.includes("package version")) {
    return "Align package.json version, update metadata version, and the approved release tag before publishing.";
  }
  if (error.includes("publish approval")) {
    return "Set JIUM_DESKTOP_PUBLISH_APPROVAL=APPROVED only after human release approval.";
  }
  if (error.includes("GitHub")) {
    return "Run publishing inside GitHub Actions with repository context and a token that can upload release assets.";
  }
  if (error.includes("distribution")) {
    return "Rebuild and validate the signed desktop distribution artifacts.";
  }
  if (error.includes("release readiness")) {
    return "Resolve desktop release readiness blockers before publishing assets.";
  }
  if (error.includes("update feed")) {
    return "Rebuild signed artifacts and latest.yml from the same desktop build.";
  }
  if (error.includes("artifact")) {
    return "Build signed installer artifacts before attempting GitHub Release upload.";
  }
  return "Resolve this publishing readiness error before uploading release assets.";
}

export async function validateDesktopPublishReadiness({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  feedDir = path.join(root, "dist", "desktop"),
  validations,
} = {}) {
  const errors = [];
  const packageVersion = readPackageVersion(root);
  const tag = parseDesktopReleaseTag(env.JIUM_DESKTOP_RELEASE_TAG);
  const envSummary = summarizePublishEnv(env);

  if (!tag.tag) {
    errors.push("desktop publish release tag missing: JIUM_DESKTOP_RELEASE_TAG");
  } else if (!tag.valid) {
    errors.push("desktop publish release tag must use vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-prerelease format");
  }

  if (!packageVersion) {
    errors.push("desktop publish package version missing: package.json version");
  } else if (tag.valid && tag.version !== packageVersion) {
    errors.push(`desktop publish package version mismatch: package.json ${packageVersion} does not match release tag ${tag.tag}`);
  }

  if (envSummary.JIUM_DESKTOP_PUBLISH_APPROVAL !== "APPROVED") {
    errors.push("desktop publish approval missing: JIUM_DESKTOP_PUBLISH_APPROVAL=APPROVED");
  }
  if (envSummary.GITHUB_REPOSITORY !== "SET") {
    errors.push("desktop publish GitHub repository context missing: GITHUB_REPOSITORY");
  }
  if (envSummary.GITHUB_TOKEN !== "SET") {
    errors.push("desktop publish GitHub token missing: GITHUB_TOKEN or GH_TOKEN");
  }

  const distribution = validations?.distribution || (await validateDesktopDistribution({ root, platform }));
  const releaseReadiness = validations?.releaseReadiness || validateDesktopReleaseReadiness({ root, env });
  const updateFeed = validations?.updateFeed || (await validateDesktopUpdateFeed({ root, feedDir, platform }));
  const publishArtifacts = validations?.publishArtifacts || inspectDesktopPublishArtifacts({ feedDir, platform });

  if (!distribution.valid) {
    distribution.errors.forEach((error) => errors.push(`desktop publish distribution: ${error}`));
  }
  if (!releaseReadiness.valid) {
    releaseReadiness.errors.forEach((error) => errors.push(`desktop publish release readiness: ${error}`));
  }
  if (!updateFeed.valid) {
    updateFeed.errors.forEach((error) => errors.push(`desktop publish update feed: ${error}`));
  }
  if (!publishArtifacts.valid) {
    publishArtifacts.errors.forEach((error) => errors.push(error));
  }

  return {
    valid: errors.length === 0,
    errors,
    packageVersion,
    releaseTag: tag.tag,
    releaseTagVersion: tag.version,
    envSummary,
    distribution,
    releaseReadiness,
    updateFeed,
    publishArtifacts,
  };
}

export function buildDesktopPublishReadinessReport(readiness, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const checks = [
    {
      id: "release-tag",
      label: "Approved release tag is present and semver-shaped",
      status: statusFromValid(Boolean(readiness.releaseTag && readiness.releaseTagVersion)),
    },
    {
      id: "version-alignment",
      label: "Release tag version matches package.json and update metadata version",
      status: statusFromValid(
        Boolean(
          readiness.packageVersion &&
            readiness.releaseTagVersion === readiness.packageVersion &&
            readiness.updateFeed.metadata.version === readiness.packageVersion,
        ),
      ),
    },
    {
      id: "manual-approval",
      label: "Human publish approval is explicitly present",
      status: readiness.envSummary.JIUM_DESKTOP_PUBLISH_APPROVAL === "APPROVED" ? "PASS" : "BLOCKED",
    },
    {
      id: "github-context",
      label: "GitHub repository and upload token are available",
      status: readiness.envSummary.GITHUB_REPOSITORY === "SET" && readiness.envSummary.GITHUB_TOKEN === "SET" ? "PASS" : "BLOCKED",
    },
    {
      id: "desktop-distribution",
      label: "Desktop distribution integrity gate passes",
      status: statusFromValid(readiness.distribution.valid),
    },
    {
      id: "desktop-release-readiness",
      label: "Desktop release readiness gate passes",
      status: statusFromValid(readiness.releaseReadiness.valid),
    },
    {
      id: "desktop-update-feed",
      label: "Desktop update feed metadata matches the artifacts",
      status: statusFromValid(readiness.updateFeed.valid),
    },
    {
      id: "publish-artifacts",
      label: "Installer, update metadata, and blockmap assets are present for release upload",
      status: statusFromValid(readiness.publishArtifacts.valid),
    },
  ];

  return {
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    summary: {
      errorCount: readiness.errors.length,
      packageVersion: readiness.packageVersion,
      releaseTag: readiness.releaseTag,
      releaseTagVersion: readiness.releaseTagVersion,
      updateMetadata: readiness.updateFeed.metadata.file,
      updateVersion: readiness.updateFeed.metadata.version,
      artifactCount: readiness.updateFeed.artifacts.length,
      publishArtifactCount: readiness.publishArtifacts.files.length,
    },
    envSummary: readiness.envSummary,
    checks,
    errors: [...readiness.errors],
    nextActions: readiness.errors.length
      ? Array.from(new Set(readiness.errors.map(publishNextActionFor)))
      : ["Upload the signed installer, blockmap, update metadata, and redacted evidence bundle to the approved GitHub Release."],
    safetyNotes: [
      "This report stores release tag, package version, artifact counts, and setting presence only.",
      "It does not store GitHub token values, update endpoint values, certificate material, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.",
      "A READY result means release asset publication is technically gated; legal, institution, and incident-response operating approval still need human sign-off.",
    ],
  };
}

export function formatDesktopPublishReadinessMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Publish Readiness Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Package version: ${report.summary.packageVersion || "MISSING"}`,
    `- Release tag: ${report.summary.releaseTag || "MISSING"}`,
    `- Update metadata: ${report.summary.updateMetadata || "MISSING"}`,
    `- Update version: ${report.summary.updateVersion || "MISSING"}`,
    `- Artifact count: ${report.summary.artifactCount}`,
    `- Publish asset count: ${report.summary.publishArtifactCount}`,
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
    "",
    "## Environment Summary",
    ...Object.entries(report.envSummary).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Next Actions",
    ...report.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = { format: "text", outputPath: "", feedDir: "", platform: process.platform };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--feed-dir") {
      args.feedDir = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--feed-dir=")) {
      args.feedDir = arg.slice("--feed-dir=".length);
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (!arg.startsWith("-") && !args.feedDir) {
      args.feedDir = arg;
    }
  }
  return args;
}

function writeOutput(content, outputPath) {
  if (!outputPath) {
    console.log(content);
    return;
  }
  mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, content, "utf8");
  console.log(`Desktop publish readiness report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const readiness = await validateDesktopPublishReadiness({
      feedDir: args.feedDir ? path.resolve(args.feedDir) : undefined,
      platform: args.platform,
    });
    const report = buildDesktopPublishReadinessReport(readiness);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatDesktopPublishReadinessMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!readiness.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
