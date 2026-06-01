#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TRUSTED_KEY_ONBOARDING_BUNDLE_DIR } from "./init-trusted-key-onboarding.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA = "jium-trusted-key-approval-candidate-v1";
export const TRUSTED_KEY_APPROVAL_CANDIDATE_DIR = "dist/trusted-key-approval-candidate";
export const TRUSTED_KEY_APPROVAL_CANDIDATE_JSON = "trusted-key-approval-candidate-report.json";
export const TRUSTED_KEY_APPROVAL_CANDIDATE_MARKDOWN = "trusted-key-approval-candidate-report.md";

const DEFAULT_ONBOARDING_REPORT = `${TRUSTED_KEY_ONBOARDING_BUNDLE_DIR}/trusted-key-onboarding-report.json`;
const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);
const PRIVATE_KEY_USAGES = new Set(["sign", "decrypt", "deriveBits", "deriveKey", "unwrapKey"]);
const SENSITIVE_VALUE_PATTERNS = [
  { id: "raw-url", label: "Raw URL", regex: /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite\/)/i },
  { id: "raw-email", label: "Raw email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { id: "raw-phone", label: "Raw phone number", regex: /(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/ },
  {
    id: "raw-token",
    label: "Raw token or private key",
    regex: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,}|AKIA[0-9A-Z]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/i,
  },
];

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function present(value) {
  return Boolean(String(value || "").trim());
}

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

function sha256Buffer(buffer) {
  return `sha256-${createHash("sha256").update(buffer).digest("hex")}`;
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
    throw new Error(`Refusing to clean unsafe trusted key approval candidate directory: ${resolved}`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = assertSafeFixedDir(root, TRUSTED_KEY_APPROVAL_CANDIDATE_DIR, TRUSTED_KEY_APPROVAL_CANDIDATE_DIR);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function resolveRepoPath(root, value) {
  if (!present(value)) {
    return "";
  }
  return path.resolve(root, value);
}

function safePathForReport(root, value) {
  if (!present(value)) {
    return "";
  }
  const resolved = path.resolve(root, value);
  return isPathInside(root, resolved) ? relativePath(root, resolved) : "[REDACTED_OUTSIDE_REPOSITORY]";
}

function scanJsonForUnsafeValues(value, location = "$", findings = []) {
  if (typeof value === "string") {
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.regex.test(value)) {
        findings.push({ id: pattern.id, label: pattern.label, location });
      }
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanJsonForUnsafeValues(entry, `${location}[${index}]`, findings));
    return findings;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      const nextLocation = `${location}.${key}`;
      if (PRIVATE_JWK_FIELDS.has(key)) {
        findings.push({ id: "private-jwk-field", label: "Private JWK field", location: nextLocation });
      }
      if (key === "key_ops" && Array.isArray(entry)) {
        entry.forEach((usage, index) => {
          if (PRIVATE_KEY_USAGES.has(String(usage))) {
            findings.push({ id: "private-key-usage", label: "Private key usage", location: `${nextLocation}[${index}]` });
          }
        });
      }
      scanJsonForUnsafeValues(entry, nextLocation, findings);
    }
  }
  return findings;
}

function artifactReport({ root, relative, label, errors }) {
  const empty = {
    label,
    path: String(relative || ""),
    fileStatus: "MISSING",
    bytes: 0,
    digest: "",
    unsafeFindingCount: 0,
    unsafeFindings: [],
  };
  if (!present(relative)) {
    errors.push(`${label}: artifact path is missing`);
    return empty;
  }
  const resolved = resolveRepoPath(root, relative);
  if (!isPathInside(root, resolved)) {
    errors.push(`${label}: artifact path must stay inside the repository`);
    return {
      ...empty,
      path: String(relative || ""),
      unsafeFindingCount: 1,
      unsafeFindings: [{ id: "unsafe-path", label: "Unsafe path", location: "$path" }],
    };
  }
  if (!existsSync(resolved)) {
    errors.push(`${label}: artifact file is missing`);
    return {
      ...empty,
      path: relativePath(root, resolved),
    };
  }
  const buffer = readFileSync(resolved);
  let parsed = null;
  try {
    parsed = JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    errors.push(`${label}: artifact must be valid JSON`);
  }
  const unsafeFindings = parsed ? scanJsonForUnsafeValues(parsed) : [{ id: "invalid-json", label: "Invalid JSON", location: "$" }];
  if (unsafeFindings.length) {
    errors.push(`${label}: artifact contains unsafe key material or sensitive strings`);
  }
  return {
    label,
    path: relativePath(root, resolved),
    fileStatus: "PRESENT",
    bytes: buffer.byteLength,
    digest: unsafeFindings.length ? "" : sha256Buffer(buffer),
    unsafeFindingCount: unsafeFindings.length,
    unsafeFindings,
  };
}

function normalizeStatus(errors, warnings) {
  if (errors.length) {
    return "BLOCKED";
  }
  if (warnings.length) {
    return "NEEDS_TRUSTED_KEY_REVIEW";
  }
  return "READY_FOR_TRUSTED_KEY_APPROVAL";
}

function nextActionsFor(status) {
  if (status === "READY_FOR_TRUSTED_KEY_APPROVAL") {
    return [
      "Compare the fingerprint through a separate trusted channel before approval.",
      "Record the trusted-key approval as a pseudonymous private approval reference.",
      "Apply the registry patch with npm run server:trusted-key:apply only after institution/legal approval.",
      "Run npm run security:feed-keys and npm run security:server-readiness after the approved patch is applied.",
    ];
  }
  if (status === "NEEDS_TRUSTED_KEY_REVIEW") {
    return [
      "Resolve or document trusted-key warnings before asking for final approval.",
      "Regenerate this report after the institution reviewer accepts the warning disposition.",
    ];
  }
  return [
    "Run npm run server:trusted-key:init with an approved repo-external private key directory, key id, and issuer.",
    "Review the generated public candidate and registry patch before external approval.",
    "Regenerate this redacted approval candidate report before release evidence digesting.",
  ];
}

function blockedSourceReport(root, onboardingReportPath, generatedAt, errors, warnings) {
  const status = normalizeStatus(errors, warnings);
  return {
    schema: TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA,
    generatedAt,
    status,
    version: readPackageVersion(root),
    key: {
      keyId: "",
      fingerprint: "",
      algorithm: "UNKNOWN",
      validFromStatus: "UNKNOWN",
      validUntilStatus: "UNKNOWN",
    },
    source: {
      onboardingReportPath: safePathForReport(root, onboardingReportPath),
      onboardingReportStatus: "MISSING_OR_INVALID",
      sourceReportDigest: "",
    },
    review: {
      status: "BLOCKED",
      validationStatus: "BLOCKED",
      patchWritten: false,
      warningCount: warnings.length,
      errorCount: errors.length,
    },
    privateKey: {
      pathState: "UNKNOWN",
      fileStatus: "UNKNOWN",
    },
    artifacts: [],
    summary: {
      artifactCount: 0,
      readyArtifactCount: 0,
      unsafeFindingCount: 0,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    errors,
    warnings,
    nextActions: nextActionsFor(status),
    safetyNotes: [
      "This report stores statuses, counts, fingerprints, artifact names, and SHA-256 digests only.",
      "It does not store raw public-key modulus values, private keys, raw approval references, private filesystem paths, contacts, URLs, victim indicators, invite links, onion addresses, emails, phone numbers, or tokens.",
      "This command does not approve or apply trusted keys; it prepares a redacted review candidate for external approval.",
    ],
  };
}

export async function buildTrustedKeyApprovalCandidate({
  root = repoRoot,
  onboardingReportPath = DEFAULT_ONBOARDING_REPORT,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const errors = [];
  const warnings = [];
  const resolvedOnboardingReport = resolveRepoPath(resolvedRoot, onboardingReportPath);

  if (!present(onboardingReportPath)) {
    errors.push("trusted key onboarding report path is required");
  } else if (!isPathInside(resolvedRoot, resolvedOnboardingReport)) {
    errors.push("trusted key onboarding report path must stay inside the repository");
  } else if (!existsSync(resolvedOnboardingReport)) {
    errors.push("trusted key onboarding report is missing");
  }

  if (errors.length) {
    const report = blockedSourceReport(resolvedRoot, onboardingReportPath, generatedAt, errors, warnings);
    writeJson(path.join(reportDir, TRUSTED_KEY_APPROVAL_CANDIDATE_JSON), report);
    writeText(path.join(reportDir, TRUSTED_KEY_APPROVAL_CANDIDATE_MARKDOWN), formatTrustedKeyApprovalCandidateMarkdown(report));
    return { valid: false, report, reportDir, reportDirRelative: relativePath(resolvedRoot, reportDir) };
  }

  let onboarding = null;
  let sourceBuffer = Buffer.alloc(0);
  try {
    sourceBuffer = readFileSync(resolvedOnboardingReport);
    onboarding = readJsonFile(resolvedOnboardingReport);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`trusted key onboarding report could not be parsed: ${message}`);
  }

  if (!isPlainObject(onboarding) || onboarding?.schema !== "jium-trusted-key-onboarding-v1") {
    errors.push("trusted key onboarding report has unsupported schema");
  }

  if (errors.length || !onboarding) {
    const report = blockedSourceReport(resolvedRoot, relativePath(resolvedRoot, resolvedOnboardingReport), generatedAt, errors, warnings);
    writeJson(path.join(reportDir, TRUSTED_KEY_APPROVAL_CANDIDATE_JSON), report);
    writeText(path.join(reportDir, TRUSTED_KEY_APPROVAL_CANDIDATE_MARKDOWN), formatTrustedKeyApprovalCandidateMarkdown(report));
    return { valid: false, report, reportDir, reportDirRelative: relativePath(resolvedRoot, reportDir) };
  }

  if (onboarding.status !== "READY_FOR_APPROVAL") {
    errors.push(`trusted key onboarding status must be READY_FOR_APPROVAL, got ${onboarding.status || "MISSING"}`);
  }
  if (onboarding.privateKey?.pathState !== "REPO_EXTERNAL") {
    errors.push("trusted key private key must be generated in a repo-external directory");
  }
  if (onboarding.privateKey?.fileStatus !== "WRITTEN") {
    errors.push("trusted key private key file must be written before approval review");
  }
  if (onboarding.review?.validationStatus !== "PASS") {
    errors.push("trusted key review validation must pass before approval");
  }
  if (onboarding.review?.patchWritten !== true) {
    errors.push("trusted key registry patch must be written before approval");
  }
  if ((onboarding.review?.errorCount || 0) > 0) {
    errors.push("trusted key review must have zero errors before approval");
  }
  if (!present(onboarding.key?.fingerprint)) {
    errors.push("trusted key fingerprint is required before approval");
  }
  if ((onboarding.review?.warningCount || 0) > 0 || onboarding.review?.status === "NEEDS_REVIEW") {
    warnings.push("trusted key candidate has warnings that must be resolved or documented before approval");
  }

  const artifacts = [
    artifactReport({ root: resolvedRoot, relative: onboarding.candidate?.relativePath || "", label: "public candidate", errors }),
    artifactReport({ root: resolvedRoot, relative: onboarding.patch?.relativePath || "", label: "registry patch", errors }),
  ];
  const unsafeFindingCount = artifacts.reduce((total, artifact) => total + artifact.unsafeFindingCount, 0);
  const status = normalizeStatus(errors, warnings);
  const report = {
    schema: TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA,
    generatedAt,
    status,
    version: readPackageVersion(resolvedRoot),
    key: {
      keyId: String(onboarding.key?.keyId || ""),
      fingerprint: String(onboarding.key?.fingerprint || ""),
      algorithm: String(onboarding.key?.algorithm || "UNKNOWN"),
      validFromStatus: String(onboarding.key?.validFromStatus || "UNKNOWN"),
      validUntilStatus: String(onboarding.key?.validUntilStatus || "UNKNOWN"),
    },
    source: {
      onboardingReportPath: relativePath(resolvedRoot, resolvedOnboardingReport),
      onboardingReportStatus: String(onboarding.status || "UNKNOWN"),
      sourceReportDigest: errors.length ? "" : sha256Buffer(sourceBuffer),
    },
    review: {
      status: String(onboarding.review?.status || "UNKNOWN"),
      validationStatus: String(onboarding.review?.validationStatus || "UNKNOWN"),
      patchWritten: Boolean(onboarding.review?.patchWritten),
      warningCount: Number(onboarding.review?.warningCount || 0),
      errorCount: Number(onboarding.review?.errorCount || 0),
    },
    privateKey: {
      pathState: String(onboarding.privateKey?.pathState || "UNKNOWN"),
      fileStatus: String(onboarding.privateKey?.fileStatus || "UNKNOWN"),
    },
    artifacts,
    summary: {
      artifactCount: artifacts.length,
      readyArtifactCount: artifacts.filter((artifact) => artifact.fileStatus === "PRESENT" && artifact.digest).length,
      unsafeFindingCount,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    errors,
    warnings,
    nextActions: nextActionsFor(status),
    safetyNotes: [
      "This report stores statuses, counts, fingerprints, artifact names, and SHA-256 digests only.",
      "It does not store raw public-key modulus values, private keys, raw approval references, private filesystem paths, contacts, URLs, victim indicators, invite links, onion addresses, emails, phone numbers, or tokens.",
      "This command does not approve or apply trusted keys; it prepares a redacted review candidate for external approval.",
    ],
  };

  writeJson(path.join(reportDir, TRUSTED_KEY_APPROVAL_CANDIDATE_JSON), report);
  writeText(path.join(reportDir, TRUSTED_KEY_APPROVAL_CANDIDATE_MARKDOWN), formatTrustedKeyApprovalCandidateMarkdown(report));

  return {
    valid: status === "READY_FOR_TRUSTED_KEY_APPROVAL",
    report,
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
  };
}

export function formatTrustedKeyApprovalCandidateMarkdown(report) {
  const lines = [
    "# JiumAI Trusted Key Approval Candidate",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Key ID: ${report.key.keyId || "MISSING"}`,
    `- Fingerprint: ${report.key.fingerprint || "MISSING"}`,
    `- Algorithm: ${report.key.algorithm}`,
    `- Source report: ${report.source.onboardingReportPath}`,
    `- Source digest: ${report.source.sourceReportDigest || "MISSING"}`,
    `- Private key: ${report.privateKey.fileStatus} (${report.privateKey.pathState})`,
    `- Review: ${report.review.status}, validation=${report.review.validationStatus}, patchWritten=${report.review.patchWritten ? "YES" : "NO"}`,
    `- Artifacts: ${report.summary.readyArtifactCount}/${report.summary.artifactCount}`,
    `- Unsafe findings: ${report.summary.unsafeFindingCount}`,
    "",
    "## Artifacts",
    ...(report.artifacts.length
      ? report.artifacts.map(
          (artifact) =>
            `- ${artifact.fileStatus} ${artifact.label}: ${artifact.path || "MISSING"}, ${artifact.bytes} bytes, ${artifact.digest || "digest blocked"}`,
        )
      : ["- None"]),
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

export function writeTrustedKeyApprovalCandidateOutput({ root = repoRoot, report, outputPath = "", format = "markdown" } = {}) {
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
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatTrustedKeyApprovalCandidateMarkdown(report),
  );
  return {
    outputPath: resolvedOutput,
    outputPathRelative: relativePath(resolvedRoot, resolvedOutput),
  };
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    onboardingReportPath: DEFAULT_ONBOARDING_REPORT,
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
    } else if (arg === "--onboarding-report") {
      args.onboardingReportPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--onboarding-report=")) {
      args.onboardingReportPath = arg.slice("--onboarding-report=".length);
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
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
    const result = await buildTrustedKeyApprovalCandidate(args);
    writeTrustedKeyApprovalCandidateOutput({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(result.report, null, 2));
    } else {
      console.log(formatTrustedKeyApprovalCandidateMarkdown(result.report));
    }
    console.log(`Trusted key approval candidate report written: ${args.outputPath || result.reportDirRelative}`);
    if (!result.valid) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
