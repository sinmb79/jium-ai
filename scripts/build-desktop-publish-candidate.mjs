#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDesktopPublishReadinessReport,
  validateDesktopPublishReadiness,
} from "./check-desktop-publish-readiness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const DESKTOP_PUBLISH_CANDIDATE_SCHEMA = "jium-desktop-publish-candidate-v1";
export const DESKTOP_PUBLISH_CANDIDATE_DIR = "dist/desktop-publish-candidate";
export const DESKTOP_PUBLISH_CANDIDATE_JSON = "desktop-publish-candidate-report.json";
export const DESKTOP_PUBLISH_CANDIDATE_MARKDOWN = "desktop-publish-candidate-report.md";

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
  } catch {
    return "";
  }
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function assertSafeFixedDir(root, target, expectedRelative) {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== expectedRelative) {
    throw new Error(`Refusing to clean unsafe desktop publish candidate directory: ${resolved}`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = assertSafeFixedDir(root, DESKTOP_PUBLISH_CANDIDATE_DIR, DESKTOP_PUBLISH_CANDIDATE_DIR);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function redactCandidateText(value, root) {
  const rootPath = path.resolve(root);
  return String(value || "")
    .replaceAll(rootPath, "[REDACTED_REPO_ROOT]")
    .replaceAll(rootPath.replace(/\\/g, "/"), "[REDACTED_REPO_ROOT]")
    .replace(/https?:\/\/[^\s")]+/gi, "[REDACTED_URL]")
    .replace(/\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/gi, "[REDACTED_INVITE]")
    .replace(/\b[a-z2-7]{16,56}\.onion\b/gi, "[REDACTED_ONION]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/gi, "[REDACTED_TOKEN]")
    .replace(/\b(?:(?:\+82[\s.-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4})\b/g, "[REDACTED_PHONE]")
    .replace(/(?:[A-Za-z]:\\|\/(?:Users|home|var|etc|tmp|mnt|opt)\/)[^\s")]+/gi, "[REDACTED_PATH]");
}

function isPublishApprovalOrUploadContextError(error) {
  return (
    error.includes("desktop publish approval missing") ||
    error.includes("desktop publish GitHub repository context missing") ||
    error.includes("desktop publish GitHub token missing")
  );
}

function candidateStatus(readiness, technicalErrors) {
  if (technicalErrors.length) {
    return "BLOCKED";
  }
  if (readiness.valid) {
    return "READY_FOR_RELEASE_UPLOAD";
  }
  return "READY_FOR_PUBLISH_APPROVAL";
}

function buildCandidateChecks(readinessReport) {
  const technical = readinessReport.checks
    .filter((check) => !["manual-approval", "github-context"].includes(check.id))
    .map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
    }));
  const manualApproval = readinessReport.checks.find((check) => check.id === "manual-approval");
  const githubContext = readinessReport.checks.find((check) => check.id === "github-context");
  return [
    ...technical,
    {
      id: "manual-approval",
      label: manualApproval?.label || "Human publish approval is explicitly present",
      status: manualApproval?.status === "PASS" ? "PASS" : "PENDING",
    },
    {
      id: "github-upload-context",
      label: githubContext?.label || "GitHub repository and upload token are available",
      status: githubContext?.status === "PASS" ? "PASS" : "PENDING",
    },
  ];
}

function nextActionsFor(status) {
  if (status === "READY_FOR_RELEASE_UPLOAD") {
    return [
      "Run npm run desktop:publish:check -- --feed-dir <signed-release-folder> inside the approved GitHub Release upload job.",
      "Upload the signed installer, blockmap, update metadata, desktop release evidence, and this candidate report to the approved release archive.",
    ];
  }
  if (status === "READY_FOR_PUBLISH_APPROVAL") {
    return [
      "Review this redacted desktop publish candidate with the release manager and legal reviewer.",
      "Record the human publish approval as a pseudonymous private approval reference before enabling GitHub Release upload.",
      "Run the Desktop Signed Release workflow with publish_to_github_release=true and publish_approval=APPROVED only after approval.",
    ];
  }
  return [
    "Resolve signed desktop release blockers before requesting publish approval.",
    "Rebuild signed artifacts, update metadata, release evidence digests, and then regenerate this candidate report.",
  ];
}

export async function buildDesktopPublishCandidate({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  feedDir = path.join(root, "dist", "desktop"),
  generatedAt = new Date().toISOString(),
  validations,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const readiness = await validateDesktopPublishReadiness({
    root: resolvedRoot,
    env,
    platform,
    feedDir,
    validations,
  });
  const readinessReport = buildDesktopPublishReadinessReport(readiness, { generatedAt });
  const technicalErrors = readiness.errors
    .filter((error) => !isPublishApprovalOrUploadContextError(error))
    .map((error) => redactCandidateText(error, resolvedRoot));
  const contextWarnings = readiness.errors
    .filter(isPublishApprovalOrUploadContextError)
    .map((error) => redactCandidateText(error, resolvedRoot));
  const status = candidateStatus(readiness, technicalErrors);

  const report = {
    schema: DESKTOP_PUBLISH_CANDIDATE_SCHEMA,
    generatedAt,
    status,
    version: readPackageVersion(resolvedRoot),
    platform,
    summary: {
      packageVersion: readinessReport.summary.packageVersion,
      releaseTag: readinessReport.summary.releaseTag,
      releaseTagVersion: readinessReport.summary.releaseTagVersion,
      updateMetadata: readinessReport.summary.updateMetadata,
      updateVersion: readinessReport.summary.updateVersion,
      artifactCount: readinessReport.summary.artifactCount,
      publishArtifactCount: readinessReport.summary.publishArtifactCount,
      releaseEvidenceDigestStatus: readinessReport.summary.releaseEvidenceDigestStatus,
      releaseEvidenceReadyFileCount: readinessReport.summary.releaseEvidenceReadyFileCount,
      releaseEvidenceFileCount: readinessReport.summary.releaseEvidenceFileCount,
      releaseEvidenceUnsafeFindingCount: readinessReport.summary.releaseEvidenceUnsafeFindingCount,
      releaseEvidenceAggregateDigest: readinessReport.summary.releaseEvidenceAggregateDigest,
      publishReadinessErrorCount: readiness.errors.length,
      technicalErrorCount: technicalErrors.length,
      approvalOrUploadWarningCount: contextWarnings.length,
    },
    envSummary: readiness.envSummary,
    checks: buildCandidateChecks(readinessReport),
    errors: technicalErrors,
    warnings: contextWarnings,
    nextActions: nextActionsFor(status),
    safetyNotes: [
      "This candidate separates signed desktop artifact readiness from final human approval and GitHub upload context.",
      "READY_FOR_PUBLISH_APPROVAL does not approve publication; it means the redacted technical evidence can be reviewed for approval.",
      "This report stores setting presence, artifact counts, release tag, package version, and aggregate evidence digests only.",
      "It does not store GitHub repository values, tokens, update endpoint values, certificate material, private paths, raw URLs, victim indicators, invite links, onion addresses, emails, or phone numbers.",
    ],
  };

  writeJson(path.join(reportDir, DESKTOP_PUBLISH_CANDIDATE_JSON), report);
  writeText(path.join(reportDir, DESKTOP_PUBLISH_CANDIDATE_MARKDOWN), formatDesktopPublishCandidateMarkdown(report));

  return {
    valid: status !== "BLOCKED",
    report,
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
  };
}

export function formatDesktopPublishCandidateMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Publish Candidate",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Platform: ${report.platform}`,
    `- Package version: ${report.summary.packageVersion || "MISSING"}`,
    `- Release tag: ${report.summary.releaseTag || "MISSING"}`,
    `- Update metadata: ${report.summary.updateMetadata || "MISSING"}`,
    `- Update version: ${report.summary.updateVersion || "MISSING"}`,
    `- Publish assets: ${report.summary.publishArtifactCount}`,
    `- Release evidence digest: ${report.summary.releaseEvidenceDigestStatus}`,
    `- Release evidence files: ${report.summary.releaseEvidenceReadyFileCount}/${report.summary.releaseEvidenceFileCount}`,
    `- Release evidence aggregate: ${report.summary.releaseEvidenceAggregateDigest || "MISSING"}`,
    `- Technical errors: ${report.summary.technicalErrorCount}`,
    `- Approval/upload warnings: ${report.summary.approvalOrUploadWarningCount}`,
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
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "## Next Actions",
    ...report.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function writeDesktopPublishCandidateOutput({ root = repoRoot, report, outputPath = "", format = "markdown" } = {}) {
  if (!outputPath) {
    return { outputPath: "", outputPathRelative: "" };
  }
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(resolvedRoot, outputPath);
  if (!isPathInside(resolvedRoot, resolvedOutput)) {
    throw new Error("output path must stay inside the repository");
  }
  writeText(
    resolvedOutput,
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatDesktopPublishCandidateMarkdown(report),
  );
  return {
    outputPath: resolvedOutput,
    outputPathRelative: relativePath(resolvedRoot, resolvedOutput),
  };
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    feedDir: "",
    platform: process.platform,
    outputPath: "",
    format: "text",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--feed-dir") {
      args.feedDir = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--feed-dir=")) {
      args.feedDir = arg.slice("--feed-dir=".length);
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg.startsWith("--platform=")) {
      args.platform = arg.slice("--platform=".length);
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
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

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    if (args.outputPath && !isPathInside(args.root, path.resolve(args.root, args.outputPath))) {
      throw new Error("output path must stay inside the repository");
    }
    const result = await buildDesktopPublishCandidate({
      root: args.root,
      feedDir: args.feedDir ? path.resolve(args.feedDir) : path.join(args.root, "dist", "desktop"),
      platform: args.platform,
    });
    writeDesktopPublishCandidateOutput({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(result.report, null, 2));
    } else {
      console.log(formatDesktopPublishCandidateMarkdown(result.report));
    }
    console.log(`Desktop publish candidate report written: ${args.outputPath || result.reportDirRelative}`);
    if (!result.valid) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
