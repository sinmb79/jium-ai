#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  PRODUCTION_ONBOARDING_SCHEMA,
} from "./init-production-onboarding.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const PRODUCTION_ONBOARDING_STORAGE_DECISION_APPROVAL_BUNDLE_DIR = "dist/production-onboarding-storage-decision";
export const REQUIRED_STORAGE_DECISION_SECTIONS = ["auditLedgerStorage", "accountRegistryStorage"];

const SECTION_ALIASES = new Map([
  ["auditLedgerStorage", "auditLedgerStorage"],
  ["audit-ledger", "auditLedgerStorage"],
  ["audit-ledger-storage", "auditLedgerStorage"],
  ["audit", "auditLedgerStorage"],
  ["accountRegistryStorage", "accountRegistryStorage"],
  ["account-registry", "accountRegistryStorage"],
  ["account-registry-storage", "accountRegistryStorage"],
  ["account", "accountRegistryStorage"],
]);

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

function storageDecisionPath(root, onboardingDir) {
  return path.resolve(root, onboardingDir, "storage-decision.template.json");
}

function normalizeSection(section) {
  const value = String(section || "").trim();
  return SECTION_ALIASES.get(value) || SECTION_ALIASES.get(value.replace(/_/g, "-")) || "";
}

function readStorageDecision(filePath, errors) {
  if (!existsSync(filePath)) {
    errors.push("storage decision file missing");
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    errors.push("storage decision file is not valid JSON");
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

function approvedSectionCount(decision) {
  return REQUIRED_STORAGE_DECISION_SECTIONS.filter(
    (sectionName) => isPlainObject(decision?.[sectionName]) && decision[sectionName].status === "APPROVED",
  ).length;
}

function planStorageDecisionApproval({
  root = repoRoot,
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  section = "",
  evidenceRef = "",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedStorageDecisionPath = storageDecisionPath(resolvedRoot, onboardingDir);
  const errors = [];
  const warnings = [];
  const evidence = validateEvidenceRef(evidenceRef);
  const sectionName = normalizeSection(section);
  errors.push(...evidence.errors);

  if (!present(section)) {
    errors.push("storage decision section is required");
  } else if (!sectionName) {
    errors.push("storage decision section is not supported");
  }

  if (!isPathInside(resolvedRoot, resolvedStorageDecisionPath)) {
    errors.push("storage decision path must stay inside the repository");
  }

  const decision = readStorageDecision(resolvedStorageDecisionPath, errors);
  if (decision) {
    if (!isPlainObject(decision)) {
      errors.push("storage decision must be a JSON object");
    } else {
      if (decision.schema !== PRODUCTION_ONBOARDING_SCHEMA) {
        errors.push(`storage decision schema must be ${PRODUCTION_ONBOARDING_SCHEMA}`);
      }
      if (decision.packageVersion !== readPackageVersion(resolvedRoot)) {
        errors.push("storage decision packageVersion must match package.json version");
      }
      if (sectionName) {
        const targetSection = decision[sectionName];
        if (!isPlainObject(targetSection)) {
          errors.push(`storage decision ${sectionName} must be a JSON object`);
        } else if (!Array.isArray(targetSection.requiredProperties) || targetSection.requiredProperties.length < 4) {
          errors.push(`storage decision ${sectionName} requiredProperties must be preserved`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    root: resolvedRoot,
    onboardingDir,
    storageDecisionPath: resolvedStorageDecisionPath,
    decision,
    section: sectionName || String(section || ""),
    evidence,
    approvedSectionCountBefore: approvedSectionCount(decision),
    requiredSectionCount: REQUIRED_STORAGE_DECISION_SECTIONS.length,
  };
}

export function validateProductionOnboardingStorageDecisionApproval(options = {}) {
  const plan = planStorageDecisionApproval(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    evidence: {
      evidenceRefStatus: plan.evidence.status,
      evidenceRefDigest: plan.evidence.digest,
    },
    summary: {
      section: plan.section,
      approvedSectionCountBefore: plan.approvedSectionCountBefore,
      requiredSectionCount: plan.requiredSectionCount,
    },
  };
}

function buildReport(plan, { generatedAt, applied, approvedSectionCountAfter, decisionStatus }) {
  return {
    schema: "jium-production-onboarding-storage-decision-approval-v1",
    generatedAt,
    status: plan.valid && applied ? "SECTION_APPROVED" : "BLOCKED",
    version: readPackageVersion(plan.root),
    summary: {
      section: plan.section,
      approvedSectionCount: approvedSectionCountAfter,
      requiredSectionCount: plan.requiredSectionCount,
      decisionStatus,
    },
    evidence: {
      evidenceRefStatus: plan.evidence.status,
      evidenceRefDigest: plan.evidence.digest,
    },
    target: {
      onboardingDir: relativePath(plan.root, path.resolve(plan.root, plan.onboardingDir)),
      file: "storage-decision.template.json",
    },
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions: plan.valid && applied
      ? [
          "Repeat this command for each remaining externally approved storage decision section.",
          "Run npm run ops:onboarding:check after all private storage decision evidence references are recorded.",
        ]
      : ["Resolve storage decision approval blockers before writing storage-decision.template.json."],
    safetyNotes: [
      "This report stores only the section id, counts, storage decision status, and a SHA-256 digest of the evidence reference.",
      "The private storage-decision.template.json stores the pseudonymous evidence reference and must stay under the ignored private onboarding path.",
      "Do not store raw storage paths, URLs, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets in evidence references.",
    ],
  };
}

export async function approveProductionOnboardingStorageDecisionSection({
  root = repoRoot,
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  section = "",
  evidenceRef = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const plan = planStorageDecisionApproval({ root, onboardingDir, section, evidenceRef });
  let approvedSectionCountAfter = plan.approvedSectionCountBefore;
  let decisionStatus = plan.decision?.status || "UNKNOWN";
  let applied = false;

  if (plan.valid) {
    const nextDecision = {
      ...plan.decision,
      [plan.section]: {
        ...plan.decision[plan.section],
        status: "APPROVED",
        evidenceRef: String(evidenceRef || "").trim(),
      },
    };
    approvedSectionCountAfter = approvedSectionCount(nextDecision);
    decisionStatus = approvedSectionCountAfter === REQUIRED_STORAGE_DECISION_SECTIONS.length ? "APPROVED" : "PENDING_STORAGE_APPROVAL";
    nextDecision.status = decisionStatus;
    writeJson(plan.storageDecisionPath, nextDecision);
    applied = true;
  }

  const report = buildReport(plan, { generatedAt, applied, approvedSectionCountAfter, decisionStatus });
  const bundleDir = path.join(plan.root, PRODUCTION_ONBOARDING_STORAGE_DECISION_APPROVAL_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "production-onboarding-storage-decision-approval-report.json"), report);
  writeText(
    path.join(bundleDir, "production-onboarding-storage-decision-approval-report.md"),
    formatProductionOnboardingStorageDecisionApprovalMarkdown(report),
  );

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatProductionOnboardingStorageDecisionApprovalMarkdown(report) {
  const lines = [
    "# JiumAI Production Onboarding Storage Decision Approval",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Section: ${report.summary.section || "MISSING"}`,
    `- Approved sections: ${report.summary.approvedSectionCount}/${report.summary.requiredSectionCount}`,
    `- Storage decision status: ${report.summary.decisionStatus}`,
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
    section: "",
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
    } else if (arg === "--section") {
      args.section = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--section=")) {
      args.section = arg.slice("--section=".length);
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
    const result = await approveProductionOnboardingStorageDecisionSection({
      root: args.root,
      onboardingDir: args.onboardingDir,
      section: args.section,
      evidenceRef: args.evidenceRef,
    });
    const content =
      args.format === "json" ? JSON.stringify(result.report, null, 2) : formatProductionOnboardingStorageDecisionApprovalMarkdown(result.report);

    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Production onboarding storage decision approval report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Production onboarding storage decision approval report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
