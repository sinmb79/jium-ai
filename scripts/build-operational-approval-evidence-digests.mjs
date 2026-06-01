#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES } from "./check-operational-approval-records.mjs";
import {
  OPERATIONAL_RELEASE_DOSSIER_DIR,
  buildOperationalReleaseDossier,
  writeOperationalReleaseDossierFiles,
} from "./build-operational-release-dossier.mjs";
import { OPERATIONAL_HANDOFF_BUNDLE_DIR } from "./build-operational-handoff-bundle.mjs";
import { OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR } from "./run-operational-go-live-rehearsal.mjs";
import {
  SERVER_ORIGIN_CANDIDATE_DIR,
  SERVER_ORIGIN_CANDIDATE_JSON,
  SERVER_ORIGIN_CANDIDATE_MARKDOWN,
  buildServerOriginCandidate,
} from "./build-server-origin-candidate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA = "jium-operational-approval-evidence-digests-v1";
export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_DIR = "dist/operational-approval-evidence-digests";
export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_JSON = "operational-approval-evidence-digests.json";
export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_MARKDOWN = "operational-approval-evidence-digests.md";

const DEFAULT_EVIDENCE_FILES = [
  `${OPERATIONAL_RELEASE_DOSSIER_DIR}/operational-release-dossier.json`,
  `${OPERATIONAL_RELEASE_DOSSIER_DIR}/operational-release-dossier.md`,
  `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/operational-handoff-summary.json`,
  `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/operational-action-plan.json`,
  `${OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR}/operational-go-live-rehearsal-report.json`,
  `${SERVER_ORIGIN_CANDIDATE_DIR}/${SERVER_ORIGIN_CANDIDATE_JSON}`,
  `${SERVER_ORIGIN_CANDIDATE_DIR}/${SERVER_ORIGIN_CANDIDATE_MARKDOWN}`,
];

const UNSAFE_PATTERNS = [
  { id: "raw-url", label: "Raw URL", regex: /https?:\/\/[^\s")]+/i },
  { id: "raw-invite", label: "Raw invite route", regex: /\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/i },
  { id: "raw-onion", label: "Raw onion address", regex: /\b[a-z2-7]{16,56}\.onion\b/i },
  { id: "raw-email", label: "Raw email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  {
    id: "raw-token",
    label: "Raw token",
    regex: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/i,
  },
  { id: "raw-phone", label: "Raw phone number", regex: /\b(?:(?:\+?\d{1,3}[-.\s]?)?(?:0\d{1,2}[-.\s]?)?\d{3,4}[-.\s]?\d{4})\b/ },
];

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePrepareDigestDir(root, digestDir) {
  const resolved = path.resolve(root, digestDir);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_DIR) {
    throw new Error(`Refusing to clean unsafe operational approval evidence digest directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
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

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function slugFileId(relativeFile) {
  return path.basename(String(relativeFile || ""))
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 96) || "evidence-file";
}

function normalizeEvidenceFiles(files) {
  return Array.from(new Set((files || []).map((file) => String(file || "").trim()).filter(Boolean)));
}

function resolveEvidenceFile(root, file) {
  const resolved = path.resolve(root, file);
  if (!isPathInside(root, resolved)) {
    return {
      resolved,
      relative: String(file || ""),
      error: "evidence file path must stay inside the repository",
    };
  }
  return {
    resolved,
    relative: relativePath(root, resolved),
    error: "",
  };
}

function scanUnsafeContent(text, relativeFile) {
  return UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    file: relativeFile,
    id: pattern.id,
    label: pattern.label,
  }));
}

function approvalRecordCommands(aggregateDigest) {
  const digestArg = aggregateDigest || "<sha256-evidence-digest>";
  return REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type) => ({
    type,
    command:
      `npm run ops:approvals:approve-record -- --type ${type} ` +
      "--approved-by-ref <pseudonymous-approver-ref> " +
      "--reference-id <pseudonymous-approval-reference> " +
      "--scope <approval-scope> " +
      `--evidence-digest ${digestArg}`,
  }));
}

async function ensureDefaultEvidenceFiles({ root, env, platform, generatedAt, noBuild }) {
  if (noBuild) {
    return DEFAULT_EVIDENCE_FILES;
  }
  await buildServerOriginCandidate({ root, env, fromPublicEnv: true, generatedAt });
  const dossier = await buildOperationalReleaseDossier({ root, env, platform, generatedAt });
  writeOperationalReleaseDossierFiles({ root, dossier });
  return DEFAULT_EVIDENCE_FILES;
}

export async function buildOperationalApprovalEvidenceDigests({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
  files = [],
  noBuild = false,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const selectedFiles = normalizeEvidenceFiles(files).length
    ? normalizeEvidenceFiles(files)
    : await ensureDefaultEvidenceFiles({ root: resolvedRoot, env, platform, generatedAt, noBuild });
  const errors = [];
  const fileReports = [];
  const unsafeFindings = [];

  for (const file of selectedFiles) {
    const target = resolveEvidenceFile(resolvedRoot, file);
    if (target.error) {
      errors.push(`${target.relative}: ${target.error}`);
      fileReports.push({
        id: slugFileId(target.relative),
        path: target.relative,
        status: "BLOCKED",
        bytes: 0,
        digest: "",
        unsafeFindings: [{ file: target.relative, id: "unsafe-path", label: "Unsafe path" }],
      });
      continue;
    }
    if (!existsSync(target.resolved)) {
      errors.push(`${target.relative}: evidence file missing`);
      fileReports.push({
        id: slugFileId(target.relative),
        path: target.relative,
        status: "BLOCKED",
        bytes: 0,
        digest: "",
        unsafeFindings: [{ file: target.relative, id: "missing-file", label: "Missing file" }],
      });
      continue;
    }
    const buffer = readFileSync(target.resolved);
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const findings = scanUnsafeContent(text, target.relative);
    unsafeFindings.push(...findings);
    fileReports.push({
      id: slugFileId(target.relative),
      path: target.relative,
      status: findings.length ? "BLOCKED" : "READY",
      bytes: buffer.byteLength,
      digest: findings.length ? "" : sha256Buffer(buffer),
      unsafeFindings: findings,
    });
  }

  const safeFileDigests = fileReports
    .filter((file) => file.status === "READY")
    .map((file) => `${file.path}:${file.bytes}:${file.digest}`)
    .sort();
  const aggregateDigest = errors.length || unsafeFindings.length || safeFileDigests.length !== fileReports.length
    ? ""
    : sha256Text(safeFileDigests.join("\n"));

  const report = {
    schema: OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA,
    generatedAt,
    status: aggregateDigest ? "READY" : "BLOCKED",
    version: readPackageVersion(resolvedRoot),
    summary: {
      fileCount: fileReports.length,
      readyFileCount: fileReports.filter((file) => file.status === "READY").length,
      unsafeFindingCount: unsafeFindings.length,
      errorCount: errors.length,
    },
    aggregateDigest,
    files: fileReports,
    approvalRecordCommands: approvalRecordCommands(aggregateDigest),
    errors,
    nextActions: aggregateDigest
      ? [
          "Use the aggregateDigest as --evidence-digest only after the listed redacted evidence files have been reviewed.",
          "Record each externally approved operating approval with npm run ops:approvals:approve-record.",
          "Run npm run ops:approvals:check after all required approval records are approved.",
        ]
      : [
          "Remove unsafe raw values or missing files before using evidence digests for approval records.",
          "Regenerate the redacted release dossier with npm run ops:release-dossier, then rebuild this digest manifest.",
        ],
    safetyNotes: [
      "This manifest stores file names, byte counts, SHA-256 digests, unsafe pattern IDs, and approval command templates only.",
      "It does not store file contents, raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private storage paths.",
      "The aggregate digest proves the exact reviewed redacted evidence files; it is not legal, institution, or go-live approval.",
    ],
  };

  return {
    valid: report.status === "READY",
    report,
  };
}

export function formatOperationalApprovalEvidenceDigestsMarkdown(report) {
  const lines = [
    "# JiumAI Operational Approval Evidence Digests",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Files: ${report.summary.readyFileCount}/${report.summary.fileCount}`,
    `- Unsafe findings: ${report.summary.unsafeFindingCount}`,
    `- Aggregate digest: ${report.aggregateDigest || "BLOCKED"}`,
    "",
    "## Files",
    ...report.files.map(
      (file) =>
        `- ${file.status} ${file.path}: ${file.bytes} bytes, ${file.digest || "digest blocked"}, findings=${file.unsafeFindings.length}`,
    ),
    "",
    "## Approval Commands",
    ...report.approvalRecordCommands.map((entry) => `- ${entry.type}: \`${entry.command}\``),
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

export function writeOperationalApprovalEvidenceDigestFiles({
  root = repoRoot,
  report,
  outputPath = "",
  format = "markdown",
} = {}) {
  if (!report) {
    throw new Error("Operational approval evidence digest report is required.");
  }
  const digestDir = safePrepareDigestDir(root, OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_DIR);
  const jsonPath = path.join(digestDir, OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_JSON);
  const markdownPath = path.join(digestDir, OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_MARKDOWN);
  writeJson(jsonPath, report);
  writeText(markdownPath, formatOperationalApprovalEvidenceDigestsMarkdown(report));

  if (outputPath) {
    const resolvedOutput = path.resolve(root, outputPath);
    if (!isPathInside(root, resolvedOutput)) {
      throw new Error("output path must stay inside the repository");
    }
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatOperationalApprovalEvidenceDigestsMarkdown(report),
    );
  }

  return {
    digestDir,
    digestDirRelative: relativePath(root, digestDir),
    jsonPath,
    markdownPath,
    jsonPathRelative: relativePath(root, jsonPath),
    markdownPathRelative: relativePath(root, markdownPath),
  };
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    format: "text",
    outputPath: "",
    files: [],
    noBuild: false,
    platform: process.platform,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--file") {
      args.files.push(argv[index + 1] || "");
      index += 1;
    } else if (arg.startsWith("--file=")) {
      args.files.push(arg.slice("--file=".length));
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--no-build") {
      args.noBuild = true;
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg.startsWith("--platform=")) {
      args.platform = arg.slice("--platform=".length);
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const result = await buildOperationalApprovalEvidenceDigests({
      root: args.root,
      platform: args.platform,
      files: args.files,
      noBuild: args.noBuild,
    });
    const written = writeOperationalApprovalEvidenceDigestFiles({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (!args.outputPath) {
      if (args.format === "json") {
        console.log(JSON.stringify(result.report, null, 2));
      } else {
        console.log(formatOperationalApprovalEvidenceDigestsMarkdown(result.report));
        console.log(`Operational approval evidence digests written: ${written.markdownPathRelative}`);
      }
    } else {
      console.log(`Operational approval evidence digests written: ${args.outputPath}`);
    }
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
