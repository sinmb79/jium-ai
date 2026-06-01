#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";
import {
  buildOperationalApprovalRecordsReport,
  resolveOperationalApprovalRecordsPath,
  validateOperationalApprovalRecords,
} from "./check-operational-approval-records.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_GO_LIVE_ENV_APPLY_BUNDLE_DIR = "dist/operational-go-live-env";

const APPROVAL_ENV_KEYS = [
  "JIUM_GO_LIVE_APPROVAL",
  "JIUM_LEGAL_REVIEW_APPROVAL",
  "JIUM_RELEASE_EVIDENCE_REVIEW",
  "JIUM_DATA_RETENTION_POLICY_ACK",
];

const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
const PLACEHOLDER_PATTERN = /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL|CHANGE[-_ ]?ME)\b/i;
const URL_OR_CONTACT_PATTERN =
  /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite\/)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/i;
const SECRET_PATTERN =
  /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i;

function present(value) {
  return Boolean(String(value || "").trim());
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "").trim()).digest("hex")}`;
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function parseEnvLines(content) {
  const lines = content ? content.replace(/\r\n/g, "\n").split("\n") : [];
  return lines.length ? lines : ["# JiumAI private go-live env"];
}

function upsertEnvLine(lines, key, value) {
  const lineIndex = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (lineIndex < 0) {
    lines.push(`${key}=${value}`);
    return "ADDED";
  }
  const currentValue = lines[lineIndex].slice(lines[lineIndex].indexOf("=") + 1);
  if (currentValue === value) {
    return "UNCHANGED";
  }
  lines[lineIndex] = `${key}=${value}`;
  return "UPDATED";
}

function safeRefErrors(value, label) {
  const text = String(value || "").trim();
  const errors = [];
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

function planOperationalGoLiveEnvApply({
  root = repoRoot,
  env = process.env,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  incidentOwnerRef = "",
  now = Date.now(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedEnvPath = path.resolve(resolvedRoot, envPath);
  const errors = [];
  const warnings = [];
  const ownerErrors = safeRefErrors(incidentOwnerRef, "incidentOwnerRef");
  const approvalRecords = validateOperationalApprovalRecords({ root: resolvedRoot, env, now });
  const approvalRecordsReport = buildOperationalApprovalRecordsReport(approvalRecords);
  const source = resolveOperationalApprovalRecordsPath({ root: resolvedRoot, env });

  if (!approvalRecords.valid) {
    errors.push("approval records readiness must be READY before applying go-live env");
    errors.push(...approvalRecords.errors);
  }
  errors.push(...ownerErrors);

  if (!isPathInside(resolvedRoot, resolvedEnvPath)) {
    errors.push("go-live env path must stay inside the repository");
  }
  if (!existsSync(resolvedEnvPath)) {
    errors.push("go-live env file missing; run npm run server:env:init and npm run ops:public-env:init first");
  }

  const approvalRecordsDigest = sha256Text(
    JSON.stringify({
      packageVersion: approvalRecords.packageVersion,
      expectedReleaseTag: approvalRecords.expectedReleaseTag,
      requiredRecordStatus: approvalRecords.requiredRecordStatus,
      source: source.sourceStatus,
    }),
  );

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    root: resolvedRoot,
    envPath,
    resolvedEnvPath,
    env,
    source,
    approvalRecords,
    approvalRecordsReport,
    incidentOwnerRef: String(incidentOwnerRef || "").trim(),
    incidentOwnerRefErrors: ownerErrors,
    evidence: {
      incidentOwnerRefStatus: ownerErrors.length ? "BLOCKED" : "SET_REDACTED",
      incidentOwnerRefDigest: ownerErrors.length ? "" : sha256Text(incidentOwnerRef),
      approvalRecordsDigest,
    },
  };
}

export function validateOperationalGoLiveEnvApply(options = {}) {
  const plan = planOperationalGoLiveEnvApply(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    evidence: { ...plan.evidence },
    summary: {
      approvalRecordsStatus: plan.approvalRecordsReport.status,
      approvalFlagCount: APPROVAL_ENV_KEYS.length,
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
      incidentOwnerRefStatus: plan.evidence.incidentOwnerRefStatus,
    },
  };
}

function buildReport(plan, { generatedAt, applied, envUpdateStatus }) {
  return {
    schema: "jium-operational-go-live-env-apply-v1",
    generatedAt,
    status: plan.valid && applied ? "APPLIED" : "BLOCKED",
    summary: {
      approvalRecordsStatus: plan.approvalRecordsReport.status,
      approvalFlagCount: APPROVAL_ENV_KEYS.length,
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
      envUpdateStatus,
      incidentOwnerStatus: plan.valid && applied ? "SET_REDACTED" : "BLOCKED",
      approvalRecordsSourceStatus: plan.source.sourceStatus,
      approvalRecordsFileStatus: plan.approvalRecords.sourceSummary.fileStatus,
    },
    evidence: { ...plan.evidence },
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions: plan.valid && applied
      ? [
          "Run npm run ops:go-live:check after hosted security header, server, desktop, and onboarding gates are ready.",
          "Archive this redacted go-live env report with the private release evidence packet.",
        ]
      : ["Resolve go-live env apply blockers before writing approval flags to the private env file."],
    safetyNotes: [
      "This report stores approval states, env key update status, and SHA-256 digests only.",
      "The private env file stores the pseudonymous incident owner reference and must stay ignored and out of public reports.",
      "Do not store raw URLs, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets in go-live env references.",
    ],
  };
}

export async function applyOperationalGoLiveEnv({
  root = repoRoot,
  env = process.env,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  incidentOwnerRef = "",
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  const plan = planOperationalGoLiveEnvApply({ root, env, envPath, incidentOwnerRef, now });
  let applied = false;
  let envUpdateStatus = "SKIPPED";

  if (plan.valid) {
    const lines = parseEnvLines(readFileSync(plan.resolvedEnvPath, "utf8"));
    const updates = [
      ...APPROVAL_ENV_KEYS.map((key) => upsertEnvLine(lines, key, "APPROVED")),
      upsertEnvLine(lines, "JIUM_INCIDENT_RESPONSE_OWNER", plan.incidentOwnerRef),
    ];
    if (present(plan.env.JIUM_OPERATIONAL_APPROVAL_RECORDS)) {
      updates.push(upsertEnvLine(lines, "JIUM_OPERATIONAL_APPROVAL_RECORDS", String(plan.env.JIUM_OPERATIONAL_APPROVAL_RECORDS).trim()));
    }
    envUpdateStatus = updates.some((status) => status === "ADDED" || status === "UPDATED") ? "UPDATED" : "UNCHANGED";
    writeText(plan.resolvedEnvPath, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n")}\n`);
    applied = true;
  }

  const report = buildReport(plan, { generatedAt, applied, envUpdateStatus });
  const bundleDir = path.join(plan.root, OPERATIONAL_GO_LIVE_ENV_APPLY_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "operational-go-live-env-apply-report.json"), report);
  writeText(path.join(bundleDir, "operational-go-live-env-apply-report.md"), formatOperationalGoLiveEnvApplyMarkdown(report));

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatOperationalGoLiveEnvApplyMarkdown(report) {
  const lines = [
    "# JiumAI Operational Go-Live Env Apply",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Approval records: ${report.summary.approvalRecordsStatus}`,
    `- Approval flags: ${report.summary.approvalFlagCount}`,
    `- Env path: ${report.summary.envPath}`,
    `- Env update: ${report.summary.envUpdateStatus}`,
    `- Incident owner: ${report.summary.incidentOwnerStatus}`,
    `- Approval records source: ${report.summary.approvalRecordsSourceStatus}`,
    `- Approval records file: ${report.summary.approvalRecordsFileStatus}`,
    `- Incident owner ref: ${report.evidence.incidentOwnerRefStatus}`,
    `- Incident owner digest: ${report.evidence.incidentOwnerRefDigest || "MISSING"}`,
    `- Approval records digest: ${report.evidence.approvalRecordsDigest || "MISSING"}`,
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
    envPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
    approvalRecordsPath: "",
    incidentOwnerRef: "",
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
    } else if (arg === "--env") {
      args.envPath = argv[index + 1] || args.envPath;
      index += 1;
    } else if (arg.startsWith("--env=")) {
      args.envPath = arg.slice("--env=".length);
    } else if (arg === "--approval-records") {
      args.approvalRecordsPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--approval-records=")) {
      args.approvalRecordsPath = arg.slice("--approval-records=".length);
    } else if (arg === "--incident-owner-ref") {
      args.incidentOwnerRef = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--incident-owner-ref=")) {
      args.incidentOwnerRef = arg.slice("--incident-owner-ref=".length);
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
    const env = { ...process.env };
    if (args.approvalRecordsPath) {
      env.JIUM_OPERATIONAL_APPROVAL_RECORDS = args.approvalRecordsPath;
    }
    const result = await applyOperationalGoLiveEnv({
      root: args.root,
      env,
      envPath: args.envPath,
      incidentOwnerRef: args.incidentOwnerRef,
    });
    const content = args.format === "json" ? JSON.stringify(result.report, null, 2) : formatOperationalGoLiveEnvApplyMarkdown(result.report);

    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Operational go-live env apply report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Operational go-live env apply report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
