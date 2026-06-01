#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_OPERATOR_CHECKLIST_RECORDS,
} from "./check-production-onboarding.mjs";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  PRODUCTION_ONBOARDING_SCHEMA,
} from "./init-production-onboarding.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const PRODUCTION_ONBOARDING_CHECKLIST_APPROVAL_BUNDLE_DIR = "dist/production-onboarding-checklist";

const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
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

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
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

function checklistPath(root, onboardingDir) {
  return path.resolve(root, onboardingDir, "operator-checklist.json");
}

function readChecklist(filePath, errors) {
  if (!existsSync(filePath)) {
    errors.push("operator checklist file missing");
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    errors.push("operator checklist file is not valid JSON");
    return null;
  }
}

function validateEvidenceRef(evidenceRef) {
  const errors = [];
  const normalized = String(evidenceRef || "").trim();
  if (!normalized) {
    errors.push("evidenceRef is required");
    return { valid: false, errors, status: "MISSING", digest: "" };
  }
  if (PLACEHOLDER_PATTERN.test(normalized)) {
    errors.push("evidenceRef contains placeholder");
  }
  if (!SAFE_REF_PATTERN.test(normalized)) {
    errors.push("evidenceRef must be a short pseudonymous reference");
  }
  if (URL_OR_CONTACT_PATTERN.test(normalized)) {
    errors.push("evidenceRef contains raw URL or contact value");
  }
  if (SECRET_PATTERN.test(normalized)) {
    errors.push("evidenceRef contains secret-like value");
  }
  return {
    valid: errors.length === 0,
    errors,
    status: errors.length ? "BLOCKED" : "SET_REDACTED",
    digest: errors.length ? "" : sha256Text(normalized),
  };
}

function planChecklistApproval({
  root = repoRoot,
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  recordId = "",
  evidenceRef = "",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedChecklistPath = checklistPath(resolvedRoot, onboardingDir);
  const errors = [];
  const warnings = [];
  const evidence = validateEvidenceRef(evidenceRef);
  errors.push(...evidence.errors);

  if (!present(recordId)) {
    errors.push("operator checklist record id is required");
  } else if (!REQUIRED_OPERATOR_CHECKLIST_RECORDS.includes(recordId)) {
    errors.push("operator checklist record id is not supported");
  }

  if (!isPathInside(resolvedRoot, resolvedChecklistPath)) {
    errors.push("operator checklist path must stay inside the repository");
  }

  const checklist = readChecklist(resolvedChecklistPath, errors);
  let recordIndex = -1;
  let records = [];
  if (checklist) {
    if (!isPlainObject(checklist)) {
      errors.push("operator checklist must be a JSON object");
    } else {
      if (checklist.schema !== PRODUCTION_ONBOARDING_SCHEMA) {
        errors.push(`operator checklist schema must be ${PRODUCTION_ONBOARDING_SCHEMA}`);
      }
      if (checklist.packageVersion !== readPackageVersion(resolvedRoot)) {
        errors.push("operator checklist packageVersion must match package.json version");
      }
      if (!Array.isArray(checklist.records)) {
        errors.push("operator checklist records must be an array");
      } else {
        records = checklist.records;
        recordIndex = records.findIndex((record) => isPlainObject(record) && record.id === recordId);
        if (recordIndex < 0 && present(recordId)) {
          errors.push(`operator checklist record not found: ${recordId}`);
        }
      }
    }
  }

  const approvedRecordCountBefore = records.filter((record) => isPlainObject(record) && record.status === "APPROVED").length;
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    root: resolvedRoot,
    onboardingDir,
    checklistPath: resolvedChecklistPath,
    checklist,
    recordId: String(recordId || ""),
    evidence,
    recordIndex,
    approvedRecordCountBefore,
    requiredRecordCount: REQUIRED_OPERATOR_CHECKLIST_RECORDS.length,
  };
}

export function validateProductionOnboardingChecklistApproval(options = {}) {
  const plan = planChecklistApproval(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    evidence: {
      evidenceRefStatus: plan.evidence.status,
      evidenceRefDigest: plan.evidence.digest,
    },
    summary: {
      recordId: plan.recordId,
      approvedRecordCountBefore: plan.approvedRecordCountBefore,
      requiredRecordCount: plan.requiredRecordCount,
    },
  };
}

function buildReport(plan, { generatedAt, applied, approvedRecordCountAfter, checklistStatus }) {
  return {
    schema: "jium-production-onboarding-checklist-approval-v1",
    generatedAt,
    status: plan.valid && applied ? "RECORD_APPROVED" : "BLOCKED",
    version: readPackageVersion(plan.root),
    summary: {
      recordId: plan.recordId,
      approvedRecordCount: approvedRecordCountAfter,
      requiredRecordCount: plan.requiredRecordCount,
      checklistStatus,
    },
    evidence: {
      evidenceRefStatus: plan.evidence.status,
      evidenceRefDigest: plan.evidence.digest,
    },
    target: {
      onboardingDir: relativePath(plan.root, path.resolve(plan.root, plan.onboardingDir)),
      file: "operator-checklist.json",
    },
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions: plan.valid && applied
      ? [
          "Repeat this command for each remaining externally approved checklist record.",
          "Run npm run ops:onboarding:check after all private onboarding evidence references are recorded.",
        ]
      : ["Resolve checklist approval blockers before writing operator-checklist.json."],
    safetyNotes: [
      "This report stores only the record id, counts, checklist status, and a SHA-256 digest of the evidence reference.",
      "The private operator-checklist.json stores the pseudonymous evidence reference and must stay under the ignored private onboarding path.",
      "Do not store raw URLs, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets in evidence references.",
    ],
  };
}

export async function approveProductionOnboardingChecklistRecord({
  root = repoRoot,
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  recordId = "",
  evidenceRef = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const plan = planChecklistApproval({ root, onboardingDir, recordId, evidenceRef });
  let approvedRecordCountAfter = plan.approvedRecordCountBefore;
  let checklistStatus = plan.checklist?.status || "UNKNOWN";
  let applied = false;

  if (plan.valid) {
    const nextChecklist = {
      ...plan.checklist,
      records: plan.checklist.records.map((record, index) =>
        index === plan.recordIndex ? { ...record, status: "APPROVED", evidenceRef: String(evidenceRef || "").trim() } : record,
      ),
    };
    approvedRecordCountAfter = nextChecklist.records.filter((record) => isPlainObject(record) && record.status === "APPROVED").length;
    checklistStatus = approvedRecordCountAfter === REQUIRED_OPERATOR_CHECKLIST_RECORDS.length ? "APPROVED" : "PENDING_EXTERNAL_APPROVALS";
    nextChecklist.status = checklistStatus;
    writeJson(plan.checklistPath, nextChecklist);
    applied = true;
  }

  const report = buildReport(plan, { generatedAt, applied, approvedRecordCountAfter, checklistStatus });
  const bundleDir = path.join(plan.root, PRODUCTION_ONBOARDING_CHECKLIST_APPROVAL_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "production-onboarding-checklist-approval-report.json"), report);
  writeText(
    path.join(bundleDir, "production-onboarding-checklist-approval-report.md"),
    formatProductionOnboardingChecklistApprovalMarkdown(report),
  );

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatProductionOnboardingChecklistApprovalMarkdown(report) {
  const lines = [
    "# JiumAI Production Onboarding Checklist Approval",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Record: ${report.summary.recordId || "MISSING"}`,
    `- Approved records: ${report.summary.approvedRecordCount}/${report.summary.requiredRecordCount}`,
    `- Checklist status: ${report.summary.checklistStatus}`,
    `- Evidence: ${report.evidence.evidenceRefStatus}`,
    `- Evidence digest: ${report.evidence.evidenceRefDigest || "MISSING"}`,
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
    onboardingDir: DEFAULT_PRODUCTION_ONBOARDING_DIR,
    recordId: "",
    evidenceRef: "",
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
    } else if (arg === "--dir") {
      args.onboardingDir = argv[index + 1] || args.onboardingDir;
      index += 1;
    } else if (arg.startsWith("--dir=")) {
      args.onboardingDir = arg.slice("--dir=".length);
    } else if (arg === "--record" || arg === "--record-id") {
      args.recordId = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--record=")) {
      args.recordId = arg.slice("--record=".length);
    } else if (arg.startsWith("--record-id=")) {
      args.recordId = arg.slice("--record-id=".length);
    } else if (arg === "--evidence-ref") {
      args.evidenceRef = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--evidence-ref=")) {
      args.evidenceRef = arg.slice("--evidence-ref=".length);
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
    const result = await approveProductionOnboardingChecklistRecord({
      root: args.root,
      onboardingDir: args.onboardingDir,
      recordId: args.recordId,
      evidenceRef: args.evidenceRef,
    });
    const content =
      args.format === "json" ? JSON.stringify(result.report, null, 2) : formatProductionOnboardingChecklistApprovalMarkdown(result.report);

    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Production onboarding checklist approval report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Production onboarding checklist approval report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
