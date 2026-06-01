#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH } from "./check-operational-approval-records.mjs";
import { DEFAULT_PRODUCTION_ONBOARDING_DIR } from "./init-production-onboarding.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_SCHEMA = "jium-production-onboarding-evidence-digests-v1";
export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_DIR = "dist/production-onboarding-evidence-digests";
export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_JSON = "production-onboarding-evidence-digests.json";
export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_MARKDOWN = "production-onboarding-evidence-digests.md";

const DEFAULT_EVIDENCE_FILES = [
  {
    role: "operator-checklist",
    file: `${DEFAULT_PRODUCTION_ONBOARDING_DIR}/operator-checklist.json`,
  },
  {
    role: "storage-decision",
    file: `${DEFAULT_PRODUCTION_ONBOARDING_DIR}/storage-decision.template.json`,
  },
  {
    role: "public-operations",
    file: `${DEFAULT_PRODUCTION_ONBOARDING_DIR}/public-operations.template.json`,
  },
  {
    role: "hosted-security-header-audit",
    file: `${DEFAULT_PRODUCTION_ONBOARDING_DIR}/hosted-security-header-audit.json`,
  },
  {
    role: "operational-approval-records",
    file: DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  },
];

const UNSAFE_PATTERNS = [
  { id: "placeholder", label: "Placeholder value", regex: /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL)\b/i },
  { id: "raw-url", label: "Raw URL", regex: /https?:\/\/[^\s")]+/i },
  { id: "raw-invite", label: "Raw invite route", regex: /\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/i },
  { id: "raw-onion", label: "Raw onion address", regex: /\b[a-z2-7]{16,56}\.onion\b/i },
  { id: "raw-email", label: "Raw email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  {
    id: "raw-token",
    label: "Raw token",
    regex: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/i,
  },
  {
    id: "raw-phone",
    label: "Raw phone number",
    regex: /\b(?:(?:\+82[\s.-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4})\b/,
  },
  {
    id: "raw-path",
    label: "Raw filesystem path",
    regex: /(?:[A-Za-z]:\\|\/(?:Users|home|var|etc|tmp|mnt|opt)\/)[^\s")]+/i,
  },
  {
    id: "private-key",
    label: "Private key material",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|\b"(?:d|p|q|dp|dq|qi|oth|k)"\s*:/i,
  },
  {
    id: "server-secret",
    label: "Server secret",
    regex: /\bINSTITUTION_SESSION_SECRET\s*=/i,
  },
];

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePrepareDigestDir(root, digestDir) {
  const resolved = path.resolve(root, digestDir);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_DIR) {
    throw new Error(`Refusing to clean unsafe production onboarding evidence digest directory: ${resolved}`);
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

function normalizeCustomFiles(files) {
  return Array.from(new Set((files || []).map((file) => String(file || "").trim()).filter(Boolean))).map((file, index) => ({
    role: `custom-evidence-${index + 1}`,
    file,
  }));
}

function selectedEvidenceFiles(files) {
  const custom = normalizeCustomFiles(files);
  return custom.length ? custom : DEFAULT_EVIDENCE_FILES;
}

function slugFileId(role, fileName) {
  return `${role}-${fileName}`
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 96) || "onboarding-evidence-file";
}

function resolveEvidenceFile(root, descriptor) {
  const resolved = path.resolve(root, descriptor.file);
  const fileName = path.basename(descriptor.file || "onboarding-evidence-file");
  if (!isPathInside(root, resolved)) {
    return {
      ...descriptor,
      resolved,
      fileName,
      error: "evidence file path must stay inside the repository",
    };
  }
  return {
    ...descriptor,
    resolved,
    fileName,
    error: "",
  };
}

function scanUnsafeContent(text, fileName) {
  return UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    fileName,
    id: pattern.id,
    label: pattern.label,
  }));
}

export function getProductionOnboardingEvidenceSources(files = []) {
  return selectedEvidenceFiles(files).map((entry) => ({
    role: entry.role,
    fileName: path.basename(entry.file),
  }));
}

export async function buildProductionOnboardingEvidenceDigests({
  root = repoRoot,
  generatedAt = new Date().toISOString(),
  files = [],
} = {}) {
  const resolvedRoot = path.resolve(root);
  const errors = [];
  const unsafeFindings = [];
  const fileReports = [];

  for (const descriptor of selectedEvidenceFiles(files)) {
    const target = resolveEvidenceFile(resolvedRoot, descriptor);
    if (target.error) {
      errors.push(`${target.fileName}: ${target.error}`);
      fileReports.push({
        id: slugFileId(target.role, target.fileName),
        role: target.role,
        fileName: target.fileName,
        status: "BLOCKED",
        bytes: 0,
        digest: "",
        unsafeFindings: [{ fileName: target.fileName, id: "unsafe-path", label: "Unsafe path" }],
      });
      continue;
    }
    if (!existsSync(target.resolved)) {
      errors.push(`${target.fileName}: onboarding evidence file missing`);
      fileReports.push({
        id: slugFileId(target.role, target.fileName),
        role: target.role,
        fileName: target.fileName,
        status: "BLOCKED",
        bytes: 0,
        digest: "",
        unsafeFindings: [{ fileName: target.fileName, id: "missing-file", label: "Missing file" }],
      });
      continue;
    }

    const buffer = readFileSync(target.resolved);
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const findings = scanUnsafeContent(text, target.fileName);
    unsafeFindings.push(...findings);
    fileReports.push({
      id: slugFileId(target.role, target.fileName),
      role: target.role,
      fileName: target.fileName,
      status: findings.length ? "BLOCKED" : "READY",
      bytes: buffer.byteLength,
      digest: findings.length ? "" : sha256Buffer(buffer),
      unsafeFindings: findings,
    });
  }

  const safeFileDigests = fileReports
    .filter((file) => file.status === "READY")
    .map((file) => `${file.role}:${file.fileName}:${file.bytes}:${file.digest}`)
    .sort();
  const aggregateDigest = errors.length || unsafeFindings.length || safeFileDigests.length !== fileReports.length
    ? ""
    : sha256Text(safeFileDigests.join("\n"));

  const report = {
    schema: PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_SCHEMA,
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
    excludedSources: [
      {
        id: "server-runtime-env",
        fileName: ".env.server.local",
        reason: "Excluded because it may contain approved raw URLs, origins, storage paths, and server-only secrets.",
      },
    ],
    errors,
    nextActions: aggregateDigest
      ? [
          "Archive this aggregateDigest with the reviewed private onboarding evidence packet.",
          "Run npm run ops:onboarding:check after approval references, storage decisions, public operations, hosted audit, and approval records are complete.",
          "Run npm run ops:go-live:check only after this digest and the private onboarding check are both ready.",
        ]
      : [
          "Remove placeholders, missing files, raw URLs, contacts, secrets, private key material, or raw filesystem paths from onboarding evidence files.",
          "Regenerate private onboarding files with npm run ops:onboarding:init only when a missing scaffold is expected.",
          "Rebuild this digest manifest after the private onboarding packet has been reviewed.",
        ],
    safetyNotes: [
      "This manifest stores file names, roles, byte counts, SHA-256 digests, unsafe pattern IDs, and counts only.",
      "It does not store file contents, private paths, pseudonymous evidence references, raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or storage paths.",
      "The aggregate digest proves the exact reviewed private onboarding files; it is not legal, institution, or production go-live approval.",
    ],
  };

  return {
    valid: report.status === "READY",
    report,
  };
}

export function formatProductionOnboardingEvidenceDigestsMarkdown(report) {
  const lines = [
    "# JiumAI Production Onboarding Evidence Digests",
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
      (file) => `- ${file.status} ${file.role}/${file.fileName}: ${file.bytes} bytes, ${file.digest || "digest blocked"}, findings=${file.unsafeFindings.length}`,
    ),
    "",
    "## Excluded Sources",
    ...report.excludedSources.map((source) => `- ${source.id}/${source.fileName}: ${source.reason}`),
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

export function writeProductionOnboardingEvidenceDigestFiles({
  root = repoRoot,
  report,
  outputPath = "",
  format = "markdown",
} = {}) {
  if (!report) {
    throw new Error("Production onboarding evidence digest report is required.");
  }
  if (outputPath) {
    const resolvedOutput = path.resolve(root, outputPath);
    if (!isPathInside(root, resolvedOutput)) {
      throw new Error("output path must stay inside the repository");
    }
  }

  const digestDir = safePrepareDigestDir(root, PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_DIR);
  const jsonPath = path.join(digestDir, PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_JSON);
  const markdownPath = path.join(digestDir, PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_MARKDOWN);
  writeJson(jsonPath, report);
  writeText(markdownPath, formatProductionOnboardingEvidenceDigestsMarkdown(report));

  if (outputPath) {
    writeText(
      path.resolve(root, outputPath),
      format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatProductionOnboardingEvidenceDigestsMarkdown(report),
    );
  }

  return {
    digestDir,
    digestDirRelative: path.relative(root, digestDir).replace(/\\/g, "/"),
    jsonPath,
    markdownPath,
    jsonPathRelative: path.relative(root, jsonPath).replace(/\\/g, "/"),
    markdownPathRelative: path.relative(root, markdownPath).replace(/\\/g, "/"),
  };
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    format: "text",
    outputPath: "",
    files: [],
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
    const result = await buildProductionOnboardingEvidenceDigests({
      root: args.root,
      files: args.files,
    });
    const written = writeProductionOnboardingEvidenceDigestFiles({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (!args.outputPath) {
      if (args.format === "json") {
        console.log(JSON.stringify(result.report, null, 2));
      } else {
        console.log(formatProductionOnboardingEvidenceDigestsMarkdown(result.report));
        console.log(`Production onboarding evidence digests written: ${written.markdownPathRelative}`);
      }
    } else {
      console.log(`Production onboarding evidence digests written: ${args.outputPath}`);
    }
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
