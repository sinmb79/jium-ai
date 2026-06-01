#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  PRODUCTION_ONBOARDING_SCHEMA,
} from "./init-production-onboarding.mjs";
import {
  DEFAULT_SERVER_RUNTIME_ENV_PATH,
} from "./init-server-runtime-env.mjs";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  buildOperationalApprovalRecordsReport,
  validateOperationalApprovalRecords,
} from "./check-operational-approval-records.mjs";
import {
  summarizeServerRuntimeEnv,
} from "./check-server-readiness.mjs";
import {
  validateServerStorageReadiness,
} from "./check-server-storage-readiness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const REQUIRED_ONBOARDING_FILE_NAMES = [
  "README.md",
  "operator-checklist.json",
  "storage-decision.template.json",
  "public-operations.template.json",
  "trusted-key-candidate.example.json",
];

export const REQUIRED_OPERATOR_CHECKLIST_RECORDS = [
  "server-origin-approval",
  "trusted-public-key-approval",
  "server-storage-decision",
  "desktop-signing-evidence",
  "public-operations-routes",
  "legal-go-live-approval",
];

const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
const PLACEHOLDER_PATTERN = /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL)\b/i;
const URL_OR_CONTACT_PATTERN = /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|discord\.gg\/)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/i;
const SECRET_PATTERN = /(gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i;
const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth", "k"]);

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function parseJsonFile(filePath, errors, label) {
  if (!existsSync(filePath)) {
    errors.push(`${label} file missing`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    errors.push(`${label} file is not valid JSON`);
    return null;
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseIso(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function safeRefErrors(value, label) {
  const text = String(value || "").trim();
  if (!text) {
    return [`${label} missing`];
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    return [`${label} contains placeholder`];
  }
  if (!SAFE_REF_PATTERN.test(text)) {
    return [`${label} must be a short pseudonymous reference`];
  }
  return [];
}

function scanSensitiveStrings(value, label, errors, { allowPlaceholders = false } = {}) {
  if (typeof value === "string") {
    if (!allowPlaceholders && PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`${label} contains placeholder`);
    }
    if (URL_OR_CONTACT_PATTERN.test(value)) {
      errors.push(`${label} contains raw URL or contact value`);
    }
    if (SECRET_PATTERN.test(value)) {
      errors.push(`${label} contains secret-like value`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSensitiveStrings(entry, `${label}[${index}]`, errors, { allowPlaceholders }));
    return;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => scanSensitiveStrings(entry, `${label}.${key}`, errors, { allowPlaceholders }));
  }
}

function validateOperatorChecklist(value, packageVersion) {
  const errors = [];
  const presentRecordIds = [];
  if (!isPlainObject(value)) {
    return { valid: false, errors: ["operator checklist must be a JSON object"], presentRecordIds, approvedRecordCount: 0 };
  }
  scanSensitiveStrings(value, "operator checklist", errors);
  if (value.schema !== PRODUCTION_ONBOARDING_SCHEMA) {
    errors.push(`operator checklist schema must be ${PRODUCTION_ONBOARDING_SCHEMA}`);
  }
  if (value.packageVersion !== packageVersion) {
    errors.push("operator checklist packageVersion must match package.json version");
  }
  if (!Number.isFinite(parseIso(value.generatedAt))) {
    errors.push("operator checklist generatedAt must be an ISO date");
  }
  if (value.status !== "APPROVED") {
    errors.push("operator checklist status must be APPROVED");
  }
  if (!Array.isArray(value.records)) {
    errors.push("operator checklist records must be an array");
  } else {
    const seen = new Set();
    for (const record of value.records) {
      if (!isPlainObject(record)) {
        errors.push("operator checklist record must be a JSON object");
        continue;
      }
      if (!REQUIRED_OPERATOR_CHECKLIST_RECORDS.includes(record.id)) {
        errors.push("operator checklist contains unsupported record id");
      } else {
        presentRecordIds.push(record.id);
      }
      if (seen.has(record.id)) {
        errors.push("operator checklist contains duplicated record id");
      }
      seen.add(record.id);
      if (record.status !== "APPROVED") {
        errors.push(`operator checklist record ${record.id || "UNKNOWN"} must be APPROVED`);
      }
      errors.push(...safeRefErrors(record.evidenceRef, `operator checklist record ${record.id || "UNKNOWN"} evidenceRef`));
    }
  }
  for (const requiredId of REQUIRED_OPERATOR_CHECKLIST_RECORDS) {
    if (!presentRecordIds.includes(requiredId)) {
      errors.push(`operator checklist missing required record: ${requiredId}`);
    }
  }
  const approvedRecordCount = Array.isArray(value.records)
    ? value.records.filter((record) => isPlainObject(record) && record.status === "APPROVED").length
    : 0;
  return {
    valid: errors.length === 0,
    errors,
    presentRecordIds: Array.from(new Set(presentRecordIds)).sort(),
    approvedRecordCount,
  };
}

function validateStorageDecision(value, packageVersion) {
  const errors = [];
  if (!isPlainObject(value)) {
    return { valid: false, errors: ["storage decision must be a JSON object"], approvedSectionCount: 0 };
  }
  scanSensitiveStrings(value, "storage decision", errors);
  if (value.schema !== PRODUCTION_ONBOARDING_SCHEMA) {
    errors.push(`storage decision schema must be ${PRODUCTION_ONBOARDING_SCHEMA}`);
  }
  if (value.packageVersion !== packageVersion) {
    errors.push("storage decision packageVersion must match package.json version");
  }
  if (!Number.isFinite(parseIso(value.generatedAt))) {
    errors.push("storage decision generatedAt must be an ISO date");
  }
  if (value.status !== "APPROVED") {
    errors.push("storage decision status must be APPROVED");
  }
  for (const sectionName of ["auditLedgerStorage", "accountRegistryStorage"]) {
    const section = value[sectionName];
    if (!isPlainObject(section)) {
      errors.push(`storage decision ${sectionName} must be a JSON object`);
      continue;
    }
    if (section.status !== "APPROVED") {
      errors.push(`storage decision ${sectionName} status must be APPROVED`);
    }
    errors.push(...safeRefErrors(section.evidenceRef, `storage decision ${sectionName} evidenceRef`));
    if (!Array.isArray(section.requiredProperties) || section.requiredProperties.length < 4) {
      errors.push(`storage decision ${sectionName} requiredProperties must be preserved`);
    }
  }
  const approvedSectionCount = ["auditLedgerStorage", "accountRegistryStorage"].filter(
    (sectionName) => isPlainObject(value[sectionName]) && value[sectionName].status === "APPROVED",
  ).length;
  return { valid: errors.length === 0, errors, approvedSectionCount };
}

function httpsUrlStatus(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "MISSING";
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    return "PLACEHOLDER";
  }
  try {
    return new URL(text).protocol === "https:" ? "SET_HTTPS" : "SET_NOT_HTTPS";
  } catch {
    return "SET_INVALID";
  }
}

function validatePublicOperationsTemplate(value, packageVersion) {
  const errors = [];
  if (!isPlainObject(value)) {
    return { valid: false, errors: ["public operations template must be a JSON object"], approvedSectionCount: 0 };
  }
  scanSensitiveStrings(value, "public operations template", errors);
  if (value.schema !== PRODUCTION_ONBOARDING_SCHEMA) {
    errors.push(`public operations template schema must be ${PRODUCTION_ONBOARDING_SCHEMA}`);
  }
  if (value.packageVersion !== packageVersion) {
    errors.push("public operations template packageVersion must match package.json version");
  }
  if (!Number.isFinite(parseIso(value.generatedAt))) {
    errors.push("public operations template generatedAt must be an ISO date");
  }
  if (value.status !== "APPROVED") {
    errors.push("public operations template status must be APPROVED");
  }
  for (const sectionName of ["publicApp", "privacyNotice", "supportRoute"]) {
    const section = value[sectionName];
    if (!isPlainObject(section)) {
      errors.push(`public operations template ${sectionName} must be a JSON object`);
      continue;
    }
    if (section.status !== "APPROVED") {
      errors.push(`public operations template ${sectionName} status must be APPROVED`);
    }
    errors.push(...safeRefErrors(section.evidenceRef, `public operations template ${sectionName} evidenceRef`));
  }
  const approvedSectionCount = ["publicApp", "privacyNotice", "supportRoute"].filter(
    (sectionName) => isPlainObject(value[sectionName]) && value[sectionName].status === "APPROVED",
  ).length;
  return { valid: errors.length === 0, errors, approvedSectionCount };
}

function validatePublicOperationsEnv(envFilePath) {
  const env = parseEnvFile(envFilePath);
  const keyStatuses = {
    JIUM_PUBLIC_APP_URL: httpsUrlStatus(env.JIUM_PUBLIC_APP_URL),
    JIUM_PRIVACY_NOTICE_URL: httpsUrlStatus(env.JIUM_PRIVACY_NOTICE_URL),
    JIUM_SUPPORT_CONTACT_ROUTE: httpsUrlStatus(env.JIUM_SUPPORT_CONTACT_ROUTE),
  };
  const errors = Object.entries(keyStatuses)
    .filter(([, status]) => status !== "SET_HTTPS")
    .map(([key, status]) => `public operations env ${key} must be HTTPS (status: ${status})`);
  return {
    valid: errors.length === 0,
    errors,
    keyStatuses,
    httpsRouteCount: Object.values(keyStatuses).filter((status) => status === "SET_HTTPS").length,
    requiredRouteCount: Object.keys(keyStatuses).length,
  };
}

function validateTrustedKeyExample(value) {
  const errors = [];
  if (!isPlainObject(value)) {
    return { valid: false, errors: ["trusted key candidate example must be a JSON object"] };
  }
  scanSensitiveStrings(value, "trusted key candidate example", errors, { allowPlaceholders: true });
  const jwk = value.publicKeyJwk;
  if (!isPlainObject(jwk)) {
    errors.push("trusted key candidate example publicKeyJwk must be a JSON object");
  } else {
    Object.keys(jwk)
      .filter((key) => PRIVATE_JWK_FIELDS.has(key))
      .forEach((key) => errors.push(`trusted key candidate example must not contain private JWK field: ${key}`));
  }
  return { valid: errors.length === 0, errors };
}

function validateServerEnvFile(envFilePath, root) {
  const errors = [];
  if (!existsSync(envFilePath)) {
    errors.push("server runtime env file missing");
    return {
      valid: false,
      errors,
      summary: {
        fileStatus: "MISSING",
        JIUM_SERVER_ROUTES: "MISSING_OR_FALSE",
        INSTITUTION_SESSION_SECRET: "MISSING",
        INSTITUTION_ALLOWED_ORIGINS: "MISSING",
        storageStatus: "BLOCKED",
      },
    };
  }
  const env = parseEnvFile(envFilePath);
  const envSummary = summarizeServerRuntimeEnv(env);
  const storage = validateServerStorageReadiness({ root, env, writeProbe: false });
  if (envSummary.JIUM_SERVER_ROUTES !== "TRUE") {
    errors.push("server runtime env must set JIUM_SERVER_ROUTES=true");
  }
  if (envSummary.INSTITUTION_SESSION_SECRET !== "SET") {
    errors.push("server runtime env must contain a strong server-only session secret");
  }
  if (envSummary.INSTITUTION_ALLOWED_ORIGINS !== "SET" || PLACEHOLDER_PATTERN.test(String(env.INSTITUTION_ALLOWED_ORIGINS || ""))) {
    errors.push("server runtime env must contain approved institution origins without placeholders");
  }
  if (envSummary.NEXT_PUBLIC_INSTITUTION_SESSION_SECRET !== "NOT_SET") {
    errors.push("server runtime env must not expose NEXT_PUBLIC_INSTITUTION_SESSION_SECRET");
  }
  storage.errors.forEach((error) => errors.push(error));
  return {
    valid: errors.length === 0,
    errors,
    summary: {
      fileStatus: "FOUND",
      JIUM_SERVER_ROUTES: envSummary.JIUM_SERVER_ROUTES,
      INSTITUTION_SESSION_SECRET: envSummary.INSTITUTION_SESSION_SECRET,
      INSTITUTION_ALLOWED_ORIGINS:
        envSummary.INSTITUTION_ALLOWED_ORIGINS === "SET" && !PLACEHOLDER_PATTERN.test(String(env.INSTITUTION_ALLOWED_ORIGINS || ""))
          ? "SET"
          : "MISSING_OR_PLACEHOLDER",
      storageStatus: storage.valid ? "READY" : "BLOCKED",
    },
  };
}

function nextActionFor(error) {
  if (error.includes("file missing")) {
    return "Run npm run ops:onboarding:init and keep the generated files under the private ignored path.";
  }
  if (error.includes("server runtime env")) {
    return "Replace server env placeholders with approved deployment values, then rerun onboarding and server readiness checks.";
  }
  if (error.includes("operator checklist")) {
    return "Complete every operator checklist record with APPROVED status and pseudonymous evidence references.";
  }
  if (error.includes("storage decision") || error.includes("INSTITUTION_AUDIT_LEDGER_DIR") || error.includes("INSTITUTION_ACCOUNT_REGISTRY_DIR")) {
    return "Complete the storage decision record and configure repo-external approved storage directories.";
  }
  if (error.includes("public operations")) {
    return "Prepare approved HTTPS public, privacy, and support routes with npm run ops:public-env:init, then approve public-operations.template.json.";
  }
  if (error.includes("approval records")) {
    return "Complete the private operational approval records packet and run npm run ops:approvals:check.";
  }
  if (error.includes("trusted key")) {
    return "Keep the trusted-key example free of private key material and use security:trusted-key:review for the real approved public key.";
  }
  return "Resolve this onboarding blocker before go-live.";
}

export function validateProductionOnboarding({
  root = repoRoot,
  env = process.env,
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  now = Date.now(),
} = {}) {
  const packageVersion = readPackageVersion(root);
  const errors = [];
  const resolvedOnboardingDir = path.resolve(root, onboardingDir);
  const requiredFiles = REQUIRED_ONBOARDING_FILE_NAMES.map((fileName) => {
    const filePath = path.join(resolvedOnboardingDir, fileName);
    const status = existsSync(filePath) ? "FOUND" : "MISSING";
    if (status === "MISSING") {
      errors.push(`onboarding ${fileName} file missing`);
    }
    return { fileName, status };
  });

  const serverEnv = validateServerEnvFile(path.resolve(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), root);
  errors.push(...serverEnv.errors);

  const approvalRecords = validateOperationalApprovalRecords({ root, env, now });
  errors.push(...approvalRecords.errors.map((error) => `approval records: ${error}`));

  const checklistErrors = [];
  const checklistValue = parseJsonFile(path.join(resolvedOnboardingDir, "operator-checklist.json"), checklistErrors, "operator checklist");
  const checklist = checklistValue
    ? validateOperatorChecklist(checklistValue, packageVersion)
    : { valid: false, errors: checklistErrors, presentRecordIds: [], approvedRecordCount: 0 };
  errors.push(...checklistErrors, ...checklist.errors);

  const storageErrors = [];
  const storageValue = parseJsonFile(path.join(resolvedOnboardingDir, "storage-decision.template.json"), storageErrors, "storage decision");
  const storageDecision = storageValue
    ? validateStorageDecision(storageValue, packageVersion)
    : { valid: false, errors: storageErrors, approvedSectionCount: 0 };
  errors.push(...storageErrors, ...storageDecision.errors);

  const publicOperationsErrors = [];
  const publicOperationsValue = parseJsonFile(
    path.join(resolvedOnboardingDir, "public-operations.template.json"),
    publicOperationsErrors,
    "public operations template",
  );
  const publicOperationsTemplate = publicOperationsValue
    ? validatePublicOperationsTemplate(publicOperationsValue, packageVersion)
    : { valid: false, errors: publicOperationsErrors, approvedSectionCount: 0 };
  const publicOperationsEnv = validatePublicOperationsEnv(path.resolve(root, DEFAULT_SERVER_RUNTIME_ENV_PATH));
  errors.push(...publicOperationsErrors, ...publicOperationsTemplate.errors, ...publicOperationsEnv.errors);

  const trustedKeyErrors = [];
  const trustedKeyValue = parseJsonFile(path.join(resolvedOnboardingDir, "trusted-key-candidate.example.json"), trustedKeyErrors, "trusted key candidate example");
  const trustedKeyExample = trustedKeyValue ? validateTrustedKeyExample(trustedKeyValue) : { valid: false, errors: trustedKeyErrors };
  errors.push(...trustedKeyErrors, ...trustedKeyExample.errors);

  return {
    valid: errors.length === 0,
    errors,
    packageVersion,
    onboardingDir: relativePath(root, resolvedOnboardingDir),
    requiredFiles,
    serverEnv: serverEnv.summary,
    approvalRecords,
    checklist: {
      valid: checklist.valid,
      approvedRecordCount: checklist.approvedRecordCount,
      requiredRecordCount: REQUIRED_OPERATOR_CHECKLIST_RECORDS.length,
      presentRecordIds: checklist.presentRecordIds,
    },
    storageDecision: {
      valid: storageDecision.valid,
      approvedSectionCount: storageDecision.approvedSectionCount,
      requiredSectionCount: 2,
    },
    publicOperations: {
      valid: publicOperationsTemplate.valid && publicOperationsEnv.valid,
      approvedSectionCount: publicOperationsTemplate.approvedSectionCount,
      requiredSectionCount: 3,
      httpsRouteCount: publicOperationsEnv.httpsRouteCount,
      requiredRouteCount: publicOperationsEnv.requiredRouteCount,
      envKeyStatuses: publicOperationsEnv.keyStatuses,
    },
    trustedKeyExample: {
      valid: trustedKeyExample.valid,
    },
  };
}

export function buildProductionOnboardingReport(readiness, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const approvalReport = buildOperationalApprovalRecordsReport(readiness.approvalRecords, { generatedAt });
  const checks = [
    {
      id: "private-files",
      label: "Required private onboarding files are present",
      status: readiness.requiredFiles.every((file) => file.status === "FOUND") ? "PASS" : "BLOCKED",
    },
    {
      id: "server-env",
      label: "Server env scaffold has approved runtime values",
      status:
        readiness.serverEnv.fileStatus === "FOUND" &&
        readiness.serverEnv.JIUM_SERVER_ROUTES === "TRUE" &&
        readiness.serverEnv.INSTITUTION_SESSION_SECRET === "SET" &&
        readiness.serverEnv.INSTITUTION_ALLOWED_ORIGINS === "SET" &&
        readiness.serverEnv.storageStatus === "READY"
          ? "PASS"
          : "BLOCKED",
    },
    {
      id: "operator-checklist",
      label: "Operator checklist records are approved with pseudonymous evidence references",
      status: readiness.checklist.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "storage-decision",
      label: "Storage decision records are approved",
      status: readiness.storageDecision.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "public-operations",
      label: "Public app, privacy notice, and support route are approved HTTPS routes",
      status: readiness.publicOperations?.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "approval-records",
      label: "Operational approval records packet is complete",
      status: approvalReport.status === "READY" ? "PASS" : "BLOCKED",
    },
    {
      id: "trusted-key-example",
      label: "Trusted-key candidate example contains no private key material",
      status: readiness.trustedKeyExample.valid ? "PASS" : "BLOCKED",
    },
  ];

  return {
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    summary: {
      errorCount: readiness.errors.length,
      packageVersion: readiness.packageVersion,
      onboardingDir: readiness.onboardingDir,
      requiredFileCount: readiness.requiredFiles.length,
      foundFileCount: readiness.requiredFiles.filter((file) => file.status === "FOUND").length,
      checklistApprovedRecordCount: readiness.checklist.approvedRecordCount,
      checklistRequiredRecordCount: readiness.checklist.requiredRecordCount,
      storageApprovedSectionCount: readiness.storageDecision.approvedSectionCount,
      storageRequiredSectionCount: readiness.storageDecision.requiredSectionCount,
      publicOperationsApprovedSectionCount: readiness.publicOperations?.approvedSectionCount || 0,
      publicOperationsRequiredSectionCount: readiness.publicOperations?.requiredSectionCount || 3,
      publicOperationsHttpsRouteCount: readiness.publicOperations?.httpsRouteCount || 0,
      publicOperationsRequiredRouteCount: readiness.publicOperations?.requiredRouteCount || 3,
      approvalRecordsStatus: approvalReport.status,
      serverStorageStatus: readiness.serverEnv.storageStatus,
    },
    checks,
    errors: [...readiness.errors],
    nextActions: readiness.errors.length
      ? Array.from(new Set(readiness.errors.map(nextActionFor)))
      : ["Run server deployment, desktop publish, go-live, and operational handoff gates with the approved private records."],
    safetyNotes: [
      "This report stores readiness states, counts, package version, and relative onboarding directory only.",
      "It does not store generated session secrets, trusted origin values, storage directory paths, support contacts, incident owner names, victim indicators, raw URLs, invite links, onion addresses, emails, phone numbers, passwords, tokens, or certificate material.",
      "A READY result means private onboarding files are structurally complete; legal, institution, hosting, and release approvals must still be archived externally.",
    ],
  };
}

export function formatProductionOnboardingMarkdown(report) {
  const lines = [
    "# JiumAI Production Onboarding Readiness Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Package version: ${report.summary.packageVersion || "MISSING"}`,
    `- Onboarding dir: ${report.summary.onboardingDir}`,
    `- Required files: ${report.summary.foundFileCount}/${report.summary.requiredFileCount}`,
    `- Operator checklist: ${report.summary.checklistApprovedRecordCount}/${report.summary.checklistRequiredRecordCount}`,
    `- Storage decision: ${report.summary.storageApprovedSectionCount}/${report.summary.storageRequiredSectionCount}`,
    `- Public operations: ${report.summary.publicOperationsApprovedSectionCount}/${report.summary.publicOperationsRequiredSectionCount} approved, ${report.summary.publicOperationsHttpsRouteCount}/${report.summary.publicOperationsRequiredRouteCount} HTTPS routes`,
    `- Approval records: ${report.summary.approvalRecordsStatus}`,
    `- Server storage: ${report.summary.serverStorageStatus}`,
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
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
  const args = { format: "text", outputPath: "", onboardingDir: DEFAULT_PRODUCTION_ONBOARDING_DIR, root: repoRoot };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--dir") {
      args.onboardingDir = argv[index + 1] || args.onboardingDir;
      index += 1;
    } else if (arg.startsWith("--dir=")) {
      args.onboardingDir = arg.slice("--dir=".length);
    } else if (arg === "--root") {
      args.root = argv[index + 1] || args.root;
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = arg.slice("--root=".length);
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
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
  console.log(`Production onboarding readiness report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const readiness = validateProductionOnboarding({ root: path.resolve(args.root), onboardingDir: args.onboardingDir });
    const report = buildProductionOnboardingReport(readiness);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatProductionOnboardingMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!readiness.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
