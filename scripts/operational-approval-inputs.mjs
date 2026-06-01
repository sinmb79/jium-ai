#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
  validateOperationalApprovalRecords,
} from "./check-operational-approval-records.mjs";
import {
  REQUIRED_OPERATOR_CHECKLIST_RECORDS,
  validateProductionOnboarding,
} from "./check-production-onboarding.mjs";
import {
  writeProductionOnboardingScaffold,
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
} from "./init-production-onboarding.mjs";
import {
  approveOperationalApprovalRecord,
  validateOperationalApprovalRecordApproval,
} from "./approve-operational-approval-record.mjs";
import {
  approveProductionOnboardingChecklistRecord,
  validateProductionOnboardingChecklistApproval,
} from "./approve-production-onboarding-checklist.mjs";
import {
  REQUIRED_STORAGE_DECISION_SECTIONS,
  approveProductionOnboardingStorageDecisionSection,
  validateProductionOnboardingStorageDecisionApproval,
} from "./approve-production-onboarding-storage-decision.mjs";
import {
  REQUIRED_PUBLIC_OPERATIONS_SECTIONS,
  approveProductionOnboardingPublicOperationsSection,
  validateProductionOnboardingPublicOperationsApproval,
} from "./approve-production-onboarding-public-operations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_APPROVAL_INPUTS_SCHEMA = "jium-operational-approval-inputs-v1";
export const OPERATIONAL_APPROVAL_INPUTS_DIR = "dist/operational-approval-inputs";
export const OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_JSON = "operational-approval-inputs-template.json";
export const OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_MARKDOWN = "operational-approval-inputs-template.md";
export const OPERATIONAL_APPROVAL_INPUTS_APPLY_REPORT_JSON = "operational-approval-inputs-apply-report.json";
export const OPERATIONAL_APPROVAL_INPUTS_APPLY_REPORT_MARKDOWN = "operational-approval-inputs-apply-report.md";

const STORAGE_SECTION_CLI = {
  auditLedgerStorage: "audit-ledger",
  accountRegistryStorage: "account-registry",
};

const PUBLIC_OPERATIONS_SECTION_CLI = {
  publicApp: "public-app",
  privacyNotice: "privacy-notice",
  supportRoute: "support-route",
};

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
];

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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function assertSafeFixedDir(root, target, expectedRelative) {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== expectedRelative) {
    throw new Error(`Refusing to clean unsafe operational approval inputs directory: ${resolved}`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = assertSafeFixedDir(root, OPERATIONAL_APPROVAL_INPUTS_DIR, OPERATIONAL_APPROVAL_INPUTS_DIR);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function resolveInsideRepo(root, target, label) {
  const resolved = path.resolve(root, target || "");
  if (!isPathInside(root, resolved)) {
    throw new Error(`${label} path must stay inside the repository`);
  }
  return resolved;
}

function scanForLeaks(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const findings = UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
  }));
  return {
    status: findings.length ? "BLOCKED" : "PASS",
    checkedPatternCount: UNSAFE_PATTERNS.length,
    findings,
  };
}

function approvalRecordTemplate(type, index) {
  return {
    type,
    approvedByRef: `<pseudonymous-approver-ref-${String(index + 1).padStart(2, "0")}>`,
    referenceId: `<pseudonymous-approval-reference-${String(index + 1).padStart(2, "0")}>`,
    scope: `<approval-scope-${String(index + 1).padStart(2, "0")}>`,
    evidenceDigest: "<sha256-evidence-digest>",
    approvedAt: "<iso-approved-at>",
    expiresAt: "",
  };
}

function checklistTemplate(recordId) {
  return {
    recordId,
    evidenceRef: "<pseudonymous-onboarding-evidence-reference>",
  };
}

function storageTemplate(section) {
  return {
    section: STORAGE_SECTION_CLI[section],
    evidenceRef: "<pseudonymous-storage-evidence-reference>",
  };
}

function publicOperationsTemplate(section) {
  return {
    section: PUBLIC_OPERATIONS_SECTION_CLI[section],
    evidenceRef: "<pseudonymous-public-operations-evidence-reference>",
  };
}

export function buildOperationalApprovalInputsTemplate({
  root = repoRoot,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const report = {
    schema: OPERATIONAL_APPROVAL_INPUTS_SCHEMA,
    generatedAt,
    status: "READY_FOR_PRIVATE_FILL",
    version: readPackageVersion(resolvedRoot),
    summary: {
      operationalApprovalRecordCount: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.length,
      onboardingChecklistRecordCount: REQUIRED_OPERATOR_CHECKLIST_RECORDS.length,
      storageDecisionCount: REQUIRED_STORAGE_DECISION_SECTIONS.length,
      publicOperationsCount: REQUIRED_PUBLIC_OPERATIONS_SECTIONS.length,
      totalInputCount:
        REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.length +
        REQUIRED_OPERATOR_CHECKLIST_RECORDS.length +
        REQUIRED_STORAGE_DECISION_SECTIONS.length +
        REQUIRED_PUBLIC_OPERATIONS_SECTIONS.length,
    },
    input: {
      schema: OPERATIONAL_APPROVAL_INPUTS_SCHEMA,
      packageVersion: readPackageVersion(resolvedRoot),
      operationalApprovalRecords: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map(approvalRecordTemplate),
      onboardingChecklist: REQUIRED_OPERATOR_CHECKLIST_RECORDS.map(checklistTemplate),
      storageDecisions: REQUIRED_STORAGE_DECISION_SECTIONS.map(storageTemplate),
      publicOperations: REQUIRED_PUBLIC_OPERATIONS_SECTIONS.map(publicOperationsTemplate),
    },
    applyCommand:
      "npm run ops:approvals:apply-inputs -- --input ops/private/production-onboarding/approved-operational-inputs.json --init",
    safetyNotes: [
      "This template is safe to review, but the filled input file is private and must not be committed.",
      "Replace placeholders only after real external approval.",
      "Use pseudonymous references and sha256-* evidence digests only.",
      "Do not store raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private paths in the filled input file.",
    ],
  };
  const leakScan = scanForLeaks({
    ...report,
    input: {
      ...report.input,
      operationalApprovalRecords: report.input.operationalApprovalRecords.map((record) => ({ type: record.type })),
      onboardingChecklist: report.input.onboardingChecklist.map((record) => ({ recordId: record.recordId })),
      storageDecisions: report.input.storageDecisions.map((record) => ({ section: record.section })),
      publicOperations: report.input.publicOperations.map((record) => ({ section: record.section })),
    },
  });
  return {
    ...report,
    leakScan,
    errors: leakScan.findings.map((finding) => `approval input template contains unsafe ${finding.label}`),
    warnings: [],
  };
}

export function writeOperationalApprovalInputsTemplateFiles({
  root = repoRoot,
  template,
  outputPath = "",
  format = "markdown",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const jsonPath = path.join(reportDir, OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_JSON);
  const markdownPath = path.join(reportDir, OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_MARKDOWN);
  writeJson(jsonPath, template);
  writeText(markdownPath, formatOperationalApprovalInputsTemplateMarkdown(template));

  if (outputPath) {
    const resolvedOutput = resolveInsideRepo(resolvedRoot, outputPath, "output");
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(template, null, 2)}\n` : formatOperationalApprovalInputsTemplateMarkdown(template),
    );
  }
  return {
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
    jsonPath,
    markdownPath,
    jsonPathRelative: relativePath(resolvedRoot, jsonPath),
    markdownPathRelative: relativePath(resolvedRoot, markdownPath),
  };
}

function inputArray(value, key, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${key} must be an array`);
    return [];
  }
  return value;
}

function validateInputSchema(input) {
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["approval inputs file must be a JSON object"] };
  }
  if (input.schema !== OPERATIONAL_APPROVAL_INPUTS_SCHEMA) {
    errors.push(`approval inputs schema must be ${OPERATIONAL_APPROVAL_INPUTS_SCHEMA}`);
  }
  return { valid: errors.length === 0, errors };
}

function validationItem({ group, id, status, errors, evidence }) {
  return {
    group,
    id,
    status,
    errorCount: errors.length,
    errors,
    evidence,
  };
}

function validateAllInputs({ root, env, input, onboardingDir, now }) {
  const schema = validateInputSchema(input);
  const errors = [...schema.errors];
  const operationalApprovalRecords = inputArray(input?.operationalApprovalRecords, "operationalApprovalRecords", errors);
  const onboardingChecklist = inputArray(input?.onboardingChecklist, "onboardingChecklist", errors);
  const storageDecisions = inputArray(input?.storageDecisions, "storageDecisions", errors);
  const publicOperations = inputArray(input?.publicOperations, "publicOperations", errors);
  const items = [];

  for (const record of operationalApprovalRecords) {
    const result = validateOperationalApprovalRecordApproval({
      root,
      env,
      type: record?.type,
      approvedByRef: record?.approvedByRef,
      referenceId: record?.referenceId,
      scope: record?.scope,
      evidenceDigest: record?.evidenceDigest,
      approvedAt: record?.approvedAt,
      expiresAt: record?.expiresAt,
      now,
    });
    items.push(
      validationItem({
        group: "operational-approval-records",
        id: String(record?.type || "MISSING"),
        status: result.valid ? "READY_TO_APPLY" : "BLOCKED",
        errors: result.errors,
        evidence: result.evidence,
      }),
    );
  }

  for (const record of onboardingChecklist) {
    const result = validateProductionOnboardingChecklistApproval({
      root,
      onboardingDir,
      recordId: record?.recordId,
      evidenceRef: record?.evidenceRef,
    });
    items.push(
      validationItem({
        group: "production-onboarding-checklist",
        id: String(record?.recordId || "MISSING"),
        status: result.valid ? "READY_TO_APPLY" : "BLOCKED",
        errors: result.errors,
        evidence: result.evidence,
      }),
    );
  }

  for (const record of storageDecisions) {
    const result = validateProductionOnboardingStorageDecisionApproval({
      root,
      onboardingDir,
      section: record?.section,
      evidenceRef: record?.evidenceRef,
    });
    items.push(
      validationItem({
        group: "production-onboarding-storage-decision",
        id: String(record?.section || "MISSING"),
        status: result.valid ? "READY_TO_APPLY" : "BLOCKED",
        errors: result.errors,
        evidence: result.evidence,
      }),
    );
  }

  for (const record of publicOperations) {
    const result = validateProductionOnboardingPublicOperationsApproval({
      root,
      onboardingDir,
      section: record?.section,
      evidenceRef: record?.evidenceRef,
    });
    items.push(
      validationItem({
        group: "production-onboarding-public-operations",
        id: String(record?.section || "MISSING"),
        status: result.valid ? "READY_TO_APPLY" : "BLOCKED",
        errors: result.errors,
        evidence: result.evidence,
      }),
    );
  }

  const itemErrors = items.flatMap((item) => item.errors.map((error) => `${item.group}/${item.id}: ${error}`));
  return {
    valid: errors.length === 0 && itemErrors.length === 0,
    errors: [...errors, ...itemErrors],
    items,
    groups: {
      operationalApprovalRecords,
      onboardingChecklist,
      storageDecisions,
      publicOperations,
    },
  };
}

async function applyValidatedInputs({ root, env, groups, onboardingDir, generatedAt, now }) {
  const applied = [];
  for (const record of groups.operationalApprovalRecords) {
    const result = await approveOperationalApprovalRecord({
      root,
      env,
      type: record.type,
      approvedByRef: record.approvedByRef,
      referenceId: record.referenceId,
      scope: record.scope,
      evidenceDigest: record.evidenceDigest,
      approvedAt: record.approvedAt,
      expiresAt: record.expiresAt,
      generatedAt,
      now,
    });
    applied.push({ group: "operational-approval-records", id: record.type, status: result.report.status });
  }
  for (const record of groups.onboardingChecklist) {
    const result = await approveProductionOnboardingChecklistRecord({
      root,
      onboardingDir,
      recordId: record.recordId,
      evidenceRef: record.evidenceRef,
      generatedAt,
    });
    applied.push({ group: "production-onboarding-checklist", id: record.recordId, status: result.report.status });
  }
  for (const record of groups.storageDecisions) {
    const result = await approveProductionOnboardingStorageDecisionSection({
      root,
      onboardingDir,
      section: record.section,
      evidenceRef: record.evidenceRef,
      generatedAt,
    });
    applied.push({ group: "production-onboarding-storage-decision", id: record.section, status: result.report.status });
  }
  for (const record of groups.publicOperations) {
    const result = await approveProductionOnboardingPublicOperationsSection({
      root,
      onboardingDir,
      section: record.section,
      evidenceRef: record.evidenceRef,
      generatedAt,
    });
    applied.push({ group: "production-onboarding-public-operations", id: record.section, status: result.report.status });
  }
  const approvalRecords = validateOperationalApprovalRecords({ root, env, now });
  const onboarding = validateProductionOnboarding({ root, env });
  return {
    applied,
    readiness: {
      approvalRecordsStatus: approvalRecords.valid ? "READY" : "BLOCKED",
      productionOnboardingStatus: onboarding.valid ? "READY" : "BLOCKED",
      approvalRecordsErrorCount: approvalRecords.errors.length,
      productionOnboardingErrorCount: onboarding.errors.length,
    },
  };
}

export async function applyOperationalApprovalInputs({
  root = repoRoot,
  env = process.env,
  inputPath = "",
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  init = false,
  forceInit = false,
  dryRun = false,
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  if (!inputPath) {
    throw new Error("approval inputs --input is required");
  }
  const resolvedInput = resolveInsideRepo(resolvedRoot, inputPath, "input");
  if (!existsSync(resolvedInput)) {
    throw new Error("approval inputs file is missing");
  }
  let scaffold = null;
  if (init) {
    scaffold = writeProductionOnboardingScaffold({
      root: resolvedRoot,
      env,
      onboardingDir,
      force: forceInit,
      generatedAt,
    });
  }
  const input = readJson(resolvedInput);
  const inputDigest = sha256Text(readFileSync(resolvedInput));
  const validation = validateAllInputs({ root: resolvedRoot, env, input, onboardingDir, now });
  const appliedResult = validation.valid && !dryRun
    ? await applyValidatedInputs({ root: resolvedRoot, env, groups: validation.groups, onboardingDir, generatedAt, now })
    : {
        applied: [],
        readiness: {
          approvalRecordsStatus: "NOT_APPLIED",
          productionOnboardingStatus: "NOT_APPLIED",
          approvalRecordsErrorCount: 0,
          productionOnboardingErrorCount: 0,
        },
      };
  const baseReport = {
    schema: "jium-operational-approval-inputs-apply-report-v1",
    generatedAt,
    status: validation.valid ? (dryRun ? "READY_TO_APPLY" : "APPLIED") : "BLOCKED",
    version: readPackageVersion(resolvedRoot),
    summary: {
      dryRun,
      init,
      inputDigest,
      totalInputCount: validation.items.length,
      readyInputCount: validation.items.filter((item) => item.status === "READY_TO_APPLY").length,
      blockedInputCount: validation.items.filter((item) => item.status === "BLOCKED").length,
      appliedCount: appliedResult.applied.length,
      approvalRecordsStatus: appliedResult.readiness.approvalRecordsStatus,
      productionOnboardingStatus: appliedResult.readiness.productionOnboardingStatus,
      approvalRecordsErrorCount: appliedResult.readiness.approvalRecordsErrorCount,
      productionOnboardingErrorCount: appliedResult.readiness.productionOnboardingErrorCount,
    },
    scaffold: scaffold
      ? {
          status: "PREPARED",
          artifactCount: scaffold.artifacts.length,
          createdCount: scaffold.artifacts.filter((artifact) => artifact.status === "CREATED").length,
          existingCount: scaffold.artifacts.filter((artifact) => artifact.status === "EXISTS").length,
        }
      : {
          status: "SKIPPED",
          artifactCount: 0,
          createdCount: 0,
          existingCount: 0,
        },
    validations: validation.items,
    applied: appliedResult.applied,
    errors: validation.errors,
    warnings: dryRun ? ["Dry run only; private approval and onboarding files were not changed."] : [],
    nextActions: validation.valid
      ? [
          "Run npm run ops:approvals:check.",
          "Run npm run ops:onboarding:check.",
          "Run npm run ops:go-live:check after server runtime, signed desktop release, and go-live env approvals are complete.",
        ]
      : ["Fix the blocked private approval input file and run this command again."],
    safetyNotes: [
      "This report stores only counts, statuses, input digest, and digests of pseudonymous references.",
      "The filled input file is private and must stay under an ignored private path or approved private storage.",
      "Do not store raw URLs, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or private paths in the input file.",
    ],
  };
  const leakScan = scanForLeaks(baseReport);
  const report = {
    ...baseReport,
    status: leakScan.status === "PASS" ? baseReport.status : "BLOCKED",
    leakScan,
    errors: [
      ...baseReport.errors,
      ...leakScan.findings.map((finding) => `approval inputs report contains unsafe ${finding.label}`),
    ],
  };
  const reportDir = safePrepareReportDir(resolvedRoot);
  writeJson(path.join(reportDir, OPERATIONAL_APPROVAL_INPUTS_APPLY_REPORT_JSON), report);
  writeText(path.join(reportDir, OPERATIONAL_APPROVAL_INPUTS_APPLY_REPORT_MARKDOWN), formatOperationalApprovalInputsApplyMarkdown(report));

  return {
    valid: report.status !== "BLOCKED",
    report,
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
  };
}

export function formatOperationalApprovalInputsTemplateMarkdown(template) {
  const lines = [
    "# JiumAI Operational Approval Inputs Template",
    "",
    `- Generated at: ${template.generatedAt}`,
    `- Status: ${template.status}`,
    `- Version: ${template.version || "MISSING"}`,
    `- Total inputs: ${template.summary.totalInputCount}`,
    `- Operational approval records: ${template.summary.operationalApprovalRecordCount}`,
    `- Onboarding checklist records: ${template.summary.onboardingChecklistRecordCount}`,
    `- Storage decisions: ${template.summary.storageDecisionCount}`,
    `- Public operations approvals: ${template.summary.publicOperationsCount}`,
    `- Leak scan: ${template.leakScan.status}`,
    "",
    "## Apply Command",
    `- \`${template.applyCommand}\``,
    "",
    "## Required Groups",
    "- operationalApprovalRecords: type, approvedByRef, referenceId, scope, evidenceDigest, approvedAt, expiresAt",
    "- onboardingChecklist: recordId, evidenceRef",
    "- storageDecisions: section, evidenceRef",
    "- publicOperations: section, evidenceRef",
    "",
    "## Safety Notes",
    ...template.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatOperationalApprovalInputsApplyMarkdown(report) {
  const lines = [
    "# JiumAI Operational Approval Inputs Apply Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Dry run: ${report.summary.dryRun ? "YES" : "NO"}`,
    `- Init scaffold: ${report.summary.init ? "YES" : "NO"}`,
    `- Input digest: ${report.summary.inputDigest}`,
    `- Ready inputs: ${report.summary.readyInputCount}/${report.summary.totalInputCount}`,
    `- Applied inputs: ${report.summary.appliedCount}`,
    `- Approval records readiness: ${report.summary.approvalRecordsStatus}`,
    `- Production onboarding readiness: ${report.summary.productionOnboardingStatus}`,
    `- Leak scan: ${report.leakScan.status}`,
    "",
    "## Validations",
    ...report.validations.map((item) => `- ${item.status} ${item.group}/${item.id}: ${item.errorCount} error(s)`),
    "",
    "## Applied",
    ...(report.applied.length ? report.applied.map((item) => `- ${item.group}/${item.id}: ${item.status}`) : ["- None"]),
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
    mode: "template",
    root: repoRoot,
    inputPath: "",
    outputPath: "",
    format: "text",
    onboardingDir: DEFAULT_PRODUCTION_ONBOARDING_DIR,
    init: false,
    forceInit: false,
    dryRun: false,
  };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("-")) {
      positional.push(arg);
    } else if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--input") {
      args.inputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--input=")) {
      args.inputPath = arg.slice("--input=".length);
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--dir") {
      args.onboardingDir = argv[index + 1] || args.onboardingDir;
      index += 1;
    } else if (arg.startsWith("--dir=")) {
      args.onboardingDir = arg.slice("--dir=".length);
    } else if (arg === "--init") {
      args.init = true;
    } else if (arg === "--force-init") {
      args.forceInit = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }
  if (positional[0] === "apply" || positional[0] === "template") {
    args.mode = positional[0];
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    if (args.outputPath) {
      resolveInsideRepo(args.root, args.outputPath, "output");
    }
    if (args.mode === "apply") {
      const result = await applyOperationalApprovalInputs({
        root: args.root,
        inputPath: args.inputPath,
        onboardingDir: args.onboardingDir,
        init: args.init,
        forceInit: args.forceInit,
        dryRun: args.dryRun,
      });
      if (args.outputPath) {
        const resolvedOutput = resolveInsideRepo(args.root, args.outputPath, "output");
        writeText(
          resolvedOutput,
          args.format === "json"
            ? `${JSON.stringify(result.report, null, 2)}\n`
            : formatOperationalApprovalInputsApplyMarkdown(result.report),
        );
        console.log(`Operational approval inputs apply report written: ${args.outputPath}`);
      } else if (args.format === "json") {
        console.log(JSON.stringify(result.report, null, 2));
        console.log(`Operational approval inputs apply report written: ${result.reportDirRelative}`);
      } else {
        console.log(formatOperationalApprovalInputsApplyMarkdown(result.report));
        console.log(`Operational approval inputs apply report written: ${result.reportDirRelative}`);
      }
      if (!result.valid) {
        process.exit(1);
      }
    } else {
      const template = buildOperationalApprovalInputsTemplate({ root: args.root });
      const written = writeOperationalApprovalInputsTemplateFiles({
        root: args.root,
        template,
        outputPath: args.outputPath,
        format: args.format === "json" ? "json" : "markdown",
      });
      if (args.format === "json") {
        console.log(JSON.stringify(template, null, 2));
      } else {
        console.log(formatOperationalApprovalInputsTemplateMarkdown(template));
      }
      console.log(`Operational approval inputs template written: ${args.outputPath || written.reportDirRelative}`);
      if (template.leakScan.status !== "PASS") {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
