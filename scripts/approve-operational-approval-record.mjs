#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATIONAL_APPROVAL_RECORDS_SCHEMA,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
  resolveOperationalApprovalRecordsPath,
  validateOperationalApprovalRecords,
} from "./check-operational-approval-records.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_APPROVAL_RECORD_APPROVAL_BUNDLE_DIR = "dist/operational-approval-record";

const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
const SHA256_DIGEST_PATTERN = /^sha256-[a-f0-9]{64}$/;
const PLACEHOLDER_PATTERN = /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL)\b/i;
const URL_OR_CONTACT_PATTERN =
  /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite\/)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/i;
const SECRET_PATTERN =
  /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i;

function present(value) {
  return Boolean(String(value || "").trim());
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "").trim()).digest("hex")}`;
}

function parseIso(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function slugType(type) {
  return String(type || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function readPacket(filePath, errors) {
  if (!existsSync(filePath)) {
    errors.push("operational approval records file missing");
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    errors.push("operational approval records file is not valid JSON");
    return null;
  }
}

function safeRefErrors(value, label) {
  const errors = [];
  const text = String(value || "").trim();
  if (!text) {
    errors.push(`${label} is required`);
    return errors;
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    errors.push(`${label} contains placeholder`);
  }
  if (!SAFE_REF_PATTERN.test(text)) {
    errors.push(`${label} must be a short pseudonymous reference`);
  }
  if (URL_OR_CONTACT_PATTERN.test(text)) {
    errors.push(`${label} contains raw URL or contact value`);
  }
  if (SECRET_PATTERN.test(text)) {
    errors.push(`${label} contains secret-like value`);
  }
  return errors;
}

function fieldDigest(value, errors) {
  return errors.length ? "" : sha256Text(value);
}

function planOperationalApprovalRecordApproval({
  root = repoRoot,
  env = process.env,
  type = "",
  approvedByRef = "",
  referenceId = "",
  scope = "",
  evidenceDigest = "",
  approvedAt = new Date().toISOString(),
  expiresAt = "",
  now = Date.now(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const errors = [];
  const warnings = [];
  const source = resolveOperationalApprovalRecordsPath({ root: resolvedRoot, env });
  const packet = readPacket(source.filePath, errors);
  const packageVersion = readPackageVersion(resolvedRoot);
  const expectedReleaseTag = present(env.JIUM_DESKTOP_RELEASE_TAG)
    ? String(env.JIUM_DESKTOP_RELEASE_TAG).trim()
    : packageVersion
      ? `v${packageVersion}`
      : "";

  if (!REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.includes(type)) {
    errors.push("approval record type is not supported");
  }
  errors.push(...safeRefErrors(approvedByRef, "approvedByRef"));
  errors.push(...safeRefErrors(referenceId, "referenceId"));
  errors.push(...safeRefErrors(scope, "scope"));

  if (!SHA256_DIGEST_PATTERN.test(String(evidenceDigest || ""))) {
    errors.push("evidenceDigest must be sha256-hex");
  }
  if (!Number.isFinite(parseIso(approvedAt))) {
    errors.push("approvedAt must be an ISO date");
  }
  if (present(expiresAt)) {
    const parsedExpiresAt = parseIso(expiresAt);
    if (!Number.isFinite(parsedExpiresAt)) {
      errors.push("expiresAt must be an ISO date");
    } else if (parsedExpiresAt <= now) {
      errors.push("expiresAt must be in the future");
    }
  }

  let recordIndex = -1;
  let approvedRecordCountBefore = 0;
  if (packet) {
    if (!isPlainObject(packet)) {
      errors.push("operational approval records packet must be a JSON object");
    } else {
      if (packet.schema !== OPERATIONAL_APPROVAL_RECORDS_SCHEMA) {
        errors.push(`approval records packet schema must be ${OPERATIONAL_APPROVAL_RECORDS_SCHEMA}`);
      }
      if (packet.packageVersion !== packageVersion) {
        errors.push("approval records packet packageVersion must match package.json version");
      }
      if (packet.releaseTag !== expectedReleaseTag) {
        errors.push("approval records packet releaseTag must match the approved release tag");
      }
      if (packet.publicAppUrlStatus !== "SET_HTTPS") {
        errors.push("approval records packet publicAppUrlStatus must be SET_HTTPS");
      }
      if (packet.privacyNoticeUrlStatus !== "SET_HTTPS") {
        errors.push("approval records packet privacyNoticeUrlStatus must be SET_HTTPS");
      }
      if (!Array.isArray(packet.records)) {
        errors.push("approval records packet records must be an array");
      } else {
        recordIndex = packet.records.findIndex((record) => isPlainObject(record) && record.type === type);
        if (recordIndex < 0 && present(type)) {
          errors.push(`approval record not found: ${type}`);
        }
        approvedRecordCountBefore = packet.records.filter((record) => isPlainObject(record) && record.status === "APPROVED").length;
      }
    }
  }

  const validationErrors = [...errors];
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    root: resolvedRoot,
    source,
    packet,
    type: String(type || ""),
    approvedByRef: String(approvedByRef || "").trim(),
    referenceId: String(referenceId || "").trim(),
    scope: String(scope || "").trim(),
    evidenceDigest: String(evidenceDigest || "").trim(),
    approvedAt,
    expiresAt: String(expiresAt || "").trim(),
    recordIndex,
    approvedRecordCountBefore,
    requiredRecordCount: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.length,
    evidence: {
      approverRefDigest: fieldDigest(approvedByRef, validationErrors),
      referenceIdDigest: fieldDigest(referenceId, validationErrors),
      scopeDigest: fieldDigest(scope, validationErrors),
      evidenceDigestStatus: SHA256_DIGEST_PATTERN.test(String(evidenceDigest || "")) ? "SET_SHA256" : "BLOCKED",
    },
  };
}

export function validateOperationalApprovalRecordApproval(options = {}) {
  const plan = planOperationalApprovalRecordApproval(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    evidence: { ...plan.evidence },
    summary: {
      type: plan.type,
      approvedRecordCountBefore: plan.approvedRecordCountBefore,
      requiredRecordCount: plan.requiredRecordCount,
    },
  };
}

function buildReport(plan, { generatedAt, applied, approvedRecordCountAfter, readinessStatus }) {
  return {
    schema: "jium-operational-approval-record-approval-v1",
    generatedAt,
    status: plan.valid && applied ? "RECORD_APPROVED" : "BLOCKED",
    version: readPackageVersion(plan.root),
    summary: {
      type: plan.type,
      approvedRecordCount: approvedRecordCountAfter,
      requiredRecordCount: plan.requiredRecordCount,
      readinessStatus,
    },
    evidence: { ...plan.evidence },
    target: {
      sourceStatus: plan.source.sourceStatus,
      fileStatus: existsSync(plan.source.filePath) ? "FOUND" : "MISSING",
    },
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions: plan.valid && applied
      ? [
          "Repeat this command for each remaining externally approved operating approval type.",
          "Run npm run ops:approvals:check after all private approval records are recorded.",
        ]
      : ["Resolve approval record blockers before writing operational-approval-records.json."],
    safetyNotes: [
      "This report stores only the approval type, counts, readiness status, and SHA-256 digests of pseudonymous approval references.",
      "The private operational approval records packet stores the pseudonymous approval values and must stay under the ignored private path or approved private storage.",
      "Do not store raw URLs, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets in approval references.",
    ],
  };
}

export async function approveOperationalApprovalRecord({
  root = repoRoot,
  env = process.env,
  type = "",
  approvedByRef = "",
  referenceId = "",
  scope = "",
  evidenceDigest = "",
  approvedAt = new Date().toISOString(),
  expiresAt = "",
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  const plan = planOperationalApprovalRecordApproval({
    root,
    env,
    type,
    approvedByRef,
    referenceId,
    scope,
    evidenceDigest,
    approvedAt,
    expiresAt,
    now,
  });
  let applied = false;
  let approvedRecordCountAfter = plan.approvedRecordCountBefore;
  let readinessStatus = "BLOCKED";

  if (plan.valid) {
    const nextPacket = {
      ...plan.packet,
      records: plan.packet.records.map((record, index) =>
        index === plan.recordIndex
          ? {
              ...record,
              id: `approval-${slugType(plan.type)}`,
              status: "APPROVED",
              approvedAt: plan.approvedAt,
              approvedByRef: plan.approvedByRef,
              referenceId: plan.referenceId,
              scope: plan.scope,
              evidenceDigest: plan.evidenceDigest,
              expiresAt: plan.expiresAt,
            }
          : record,
      ),
    };
    writeJson(plan.source.filePath, nextPacket);
    applied = true;
    const readiness = validateOperationalApprovalRecords({ root: plan.root, env, now });
    readinessStatus = readiness.valid ? "READY" : "BLOCKED";
    approvedRecordCountAfter = Object.values(readiness.requiredRecordStatus).filter((status) => status === "APPROVED").length;
  }

  const report = buildReport(plan, { generatedAt, applied, approvedRecordCountAfter, readinessStatus });
  const bundleDir = path.join(plan.root, OPERATIONAL_APPROVAL_RECORD_APPROVAL_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "operational-approval-record-approval-report.json"), report);
  writeText(path.join(bundleDir, "operational-approval-record-approval-report.md"), formatOperationalApprovalRecordApprovalMarkdown(report));

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatOperationalApprovalRecordApprovalMarkdown(report) {
  const lines = [
    "# JiumAI Operational Approval Record Approval",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Type: ${report.summary.type || "MISSING"}`,
    `- Approved records: ${report.summary.approvedRecordCount}/${report.summary.requiredRecordCount}`,
    `- Readiness: ${report.summary.readinessStatus}`,
    `- Approver ref digest: ${report.evidence.approverRefDigest || "MISSING"}`,
    `- Reference ID digest: ${report.evidence.referenceIdDigest || "MISSING"}`,
    `- Scope digest: ${report.evidence.scopeDigest || "MISSING"}`,
    `- Evidence digest: ${report.evidence.evidenceDigestStatus}`,
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

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    type: "",
    approvedByRef: "",
    referenceId: "",
    scope: "",
    evidenceDigest: "",
    approvedAt: new Date().toISOString(),
    expiresAt: "",
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
    } else if (arg === "--type" || arg === "--record-type") {
      args.type = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--type=")) {
      args.type = arg.slice("--type=".length);
    } else if (arg.startsWith("--record-type=")) {
      args.type = arg.slice("--record-type=".length);
    } else if (arg === "--approved-by-ref") {
      args.approvedByRef = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--approved-by-ref=")) {
      args.approvedByRef = arg.slice("--approved-by-ref=".length);
    } else if (arg === "--reference-id") {
      args.referenceId = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--reference-id=")) {
      args.referenceId = arg.slice("--reference-id=".length);
    } else if (arg === "--scope") {
      args.scope = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--scope=")) {
      args.scope = arg.slice("--scope=".length);
    } else if (arg === "--evidence-digest") {
      args.evidenceDigest = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--evidence-digest=")) {
      args.evidenceDigest = arg.slice("--evidence-digest=".length);
    } else if (arg === "--approved-at") {
      args.approvedAt = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--approved-at=")) {
      args.approvedAt = arg.slice("--approved-at=".length);
    } else if (arg === "--expires-at") {
      args.expiresAt = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--expires-at=")) {
      args.expiresAt = arg.slice("--expires-at=".length);
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
    if (args.outputPath) {
      const resolvedOutput = path.resolve(args.root, args.outputPath);
      if (!isPathInside(args.root, resolvedOutput)) {
        throw new Error("output path must stay inside the repository");
      }
    }
    const result = await approveOperationalApprovalRecord({
      root: args.root,
      type: args.type,
      approvedByRef: args.approvedByRef,
      referenceId: args.referenceId,
      scope: args.scope,
      evidenceDigest: args.evidenceDigest,
      approvedAt: args.approvedAt,
      expiresAt: args.expiresAt,
    });
    const content =
      args.format === "json" ? JSON.stringify(result.report, null, 2) : formatOperationalApprovalRecordApprovalMarkdown(result.report);

    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Operational approval record approval report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Operational approval record approval report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
