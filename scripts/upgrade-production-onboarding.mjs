#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
} from "./check-operational-approval-records.mjs";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  PRODUCTION_ONBOARDING_SCHEMA,
} from "./init-production-onboarding.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const PLACEHOLDER_PATTERN = /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL|PENDING_EXTERNAL_APPROVALS|PENDING_STORAGE_APPROVAL)\b/i;
const SENSITIVE_PATTERN = /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|discord\.gg\/)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b|gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16}/i;

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

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function containsPlaceholder(value) {
  if (typeof value === "string") {
    return PLACEHOLDER_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsPlaceholder);
  }
  if (isPlainObject(value)) {
    return Object.values(value).some(containsPlaceholder);
  }
  return false;
}

function containsApprovedRecord(packet) {
  return Array.isArray(packet?.records) && packet.records.some((record) => isPlainObject(record) && record.status === "APPROVED");
}

function readTextSafely(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function writeJson(filePath, value, dryRun) {
  if (dryRun) {
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value, dryRun) {
  if (dryRun) {
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function artifact(root, filePath, label, status, detail = {}) {
  return {
    label,
    path: relativePath(root, filePath),
    status,
    ...detail,
  };
}

function updateJsonPackageVersion({ root, filePath, label, packageVersion, dryRun, schemaRequired = PRODUCTION_ONBOARDING_SCHEMA }) {
  if (!existsSync(filePath)) {
    return artifact(root, filePath, label, "MISSING");
  }
  let value;
  try {
    value = readJsonFile(filePath);
  } catch {
    return artifact(root, filePath, label, "INVALID_JSON");
  }
  if (!isPlainObject(value)) {
    return artifact(root, filePath, label, "INVALID_JSON_OBJECT");
  }
  if (schemaRequired && value.schema !== schemaRequired) {
    return artifact(root, filePath, label, "SKIPPED_SCHEMA_MISMATCH");
  }
  const previousPackageVersion = String(value.packageVersion || "");
  if (previousPackageVersion === packageVersion) {
    return artifact(root, filePath, label, "UNCHANGED", { previousPackageVersion, packageVersion });
  }
  value.packageVersion = packageVersion;
  writeJson(filePath, value, dryRun);
  return artifact(root, filePath, label, dryRun ? "WOULD_UPDATE" : "UPDATED", { previousPackageVersion, packageVersion });
}

function hostedSecurityHeaderAuditRecord() {
  return {
    id: "hosted-security-header-audit",
    status: "PENDING_APPROVAL",
    evidenceRef: "REPLACE-ME-HOSTED-SECURITY-HEADER-AUDIT-REF",
    requiredCheck:
      "Approved public app route has a READY redacted security header audit report and JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT points to it.",
  };
}

function updateOperatorChecklist({ root, filePath, packageVersion, dryRun }) {
  if (!existsSync(filePath)) {
    return artifact(root, filePath, "operator-checklist", "MISSING");
  }
  let value;
  try {
    value = readJsonFile(filePath);
  } catch {
    return artifact(root, filePath, "operator-checklist", "INVALID_JSON");
  }
  if (!isPlainObject(value)) {
    return artifact(root, filePath, "operator-checklist", "INVALID_JSON_OBJECT");
  }
  if (value.schema !== PRODUCTION_ONBOARDING_SCHEMA) {
    return artifact(root, filePath, "operator-checklist", "SKIPPED_SCHEMA_MISMATCH");
  }

  const previousPackageVersion = String(value.packageVersion || "");
  let changed = false;
  if (previousPackageVersion !== packageVersion) {
    value.packageVersion = packageVersion;
    changed = true;
  }

  if (!Array.isArray(value.records)) {
    value.records = [];
    changed = true;
  }

  if (!value.records.some((record) => isPlainObject(record) && record.id === "hosted-security-header-audit")) {
    value.records.push(hostedSecurityHeaderAuditRecord());
    changed = true;
  }

  if (!changed) {
    return artifact(root, filePath, "operator-checklist", "UNCHANGED", { previousPackageVersion, packageVersion });
  }

  writeJson(filePath, value, dryRun);
  return artifact(root, filePath, "operator-checklist", dryRun ? "WOULD_UPDATE" : "UPDATED", {
    previousPackageVersion,
    packageVersion,
  });
}

function publicOperationsTemplate({ generatedAt, packageVersion }) {
  return {
    schema: PRODUCTION_ONBOARDING_SCHEMA,
    generatedAt,
    packageVersion,
    status: "PENDING_PUBLIC_OPERATIONS_APPROVAL",
    publicApp: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-PUBLIC-APP-REF",
      requiredCheck: "JIUM_PUBLIC_APP_URL points to the approved HTTPS public app route.",
    },
    privacyNotice: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-PRIVACY-NOTICE-REF",
      requiredCheck: "JIUM_PRIVACY_NOTICE_URL points to the approved HTTPS privacy notice route.",
    },
    supportRoute: {
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-SUPPORT-ROUTE-REF",
      requiredCheck: "JIUM_SUPPORT_CONTACT_ROUTE points to the approved HTTPS support route without exposing case details.",
    },
    verificationCommand: "npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env",
  };
}

function updatePublicOperationsTemplate({ root, filePath, packageVersion, dryRun }) {
  if (!existsSync(filePath)) {
    writeJson(filePath, publicOperationsTemplate({ generatedAt: new Date().toISOString(), packageVersion }), dryRun);
    return artifact(root, filePath, "public-operations", dryRun ? "WOULD_CREATE" : "CREATED", { packageVersion });
  }
  return updateJsonPackageVersion({
    root,
    filePath,
    label: "public-operations",
    packageVersion,
    dryRun,
  });
}

function updateReadme({ root, filePath, packageVersion, dryRun }) {
  const text = readTextSafely(filePath);
  if (!text) {
    return artifact(root, filePath, "onboarding-readme", "MISSING");
  }
  const nextText = text.replace(/- Package version: .*/u, `- Package version: ${packageVersion || "MISSING"}`);
  if (nextText === text) {
    return artifact(root, filePath, "onboarding-readme", "UNCHANGED", { packageVersion });
  }
  writeText(filePath, nextText, dryRun);
  return artifact(root, filePath, "onboarding-readme", dryRun ? "WOULD_UPDATE" : "UPDATED", { packageVersion });
}

function updateApprovalPacket({ root, filePath, packageVersion, releaseTag, dryRun }) {
  if (!existsSync(filePath)) {
    return artifact(root, filePath, "operational-approval-records", "MISSING");
  }
  let packet;
  try {
    packet = readJsonFile(filePath);
  } catch {
    return artifact(root, filePath, "operational-approval-records", "INVALID_JSON");
  }
  if (!isPlainObject(packet)) {
    return artifact(root, filePath, "operational-approval-records", "INVALID_JSON_OBJECT");
  }
  const previousPackageVersion = String(packet.packageVersion || "");
  const previousReleaseTag = String(packet.releaseTag || "");
  if (previousPackageVersion === packageVersion && previousReleaseTag === releaseTag) {
    return artifact(root, filePath, "operational-approval-records", "UNCHANGED", { packageVersion, releaseTag });
  }
  if (containsApprovedRecord(packet) && !containsPlaceholder(packet)) {
    return artifact(root, filePath, "operational-approval-records", "SKIPPED_APPROVED_RELEASE_RECORDS", {
      previousPackageVersion,
      previousReleaseTag,
      packageVersion,
      releaseTag,
    });
  }
  packet.packageVersion = packageVersion;
  packet.releaseTag = releaseTag;
  writeJson(filePath, packet, dryRun);
  return artifact(root, filePath, "operational-approval-records", dryRun ? "WOULD_UPDATE" : "UPDATED", {
    previousPackageVersion,
    previousReleaseTag,
    packageVersion,
    releaseTag,
  });
}

function statusForArtifacts(artifacts) {
  if (artifacts.some((entry) => entry.status === "INVALID_JSON" || entry.status === "INVALID_JSON_OBJECT")) {
    return "BLOCKED";
  }
  if (artifacts.some((entry) => entry.status === "SKIPPED_APPROVED_RELEASE_RECORDS" || entry.status === "SKIPPED_SCHEMA_MISMATCH")) {
    return "REVIEW";
  }
  if (artifacts.some((entry) => entry.status === "UPDATED" || entry.status === "WOULD_UPDATE")) {
    return "UPDATED";
  }
  return "UNCHANGED";
}

export function upgradeProductionOnboarding({
  root = repoRoot,
  env = process.env,
  onboardingDir = DEFAULT_PRODUCTION_ONBOARDING_DIR,
  dryRun = false,
} = {}) {
  const packageVersion = readPackageVersion(root);
  const releaseTag = String(env.JIUM_DESKTOP_RELEASE_TAG || "").trim() || (packageVersion ? `v${packageVersion}` : "");
  const resolvedOnboardingDir = path.resolve(root, onboardingDir);
  const artifacts = [
    updateReadme({
      root,
      filePath: path.join(resolvedOnboardingDir, "README.md"),
      packageVersion,
      dryRun,
    }),
    updateOperatorChecklist({
      root,
      filePath: path.join(resolvedOnboardingDir, "operator-checklist.json"),
      packageVersion,
      dryRun,
    }),
    updateJsonPackageVersion({
      root,
      filePath: path.join(resolvedOnboardingDir, "storage-decision.template.json"),
      label: "storage-decision",
      packageVersion,
      dryRun,
    }),
    updatePublicOperationsTemplate({
      root,
      filePath: path.join(resolvedOnboardingDir, "public-operations.template.json"),
      packageVersion,
      dryRun,
    }),
    updateApprovalPacket({
      root,
      filePath: path.resolve(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH),
      packageVersion,
      releaseTag,
      dryRun,
    }),
  ];

  return {
    schema: "jium-production-onboarding-upgrade-v1",
    generatedAt: new Date().toISOString(),
    status: statusForArtifacts(artifacts),
    dryRun,
    packageVersion,
    releaseTag,
    onboardingDir: relativePath(root, resolvedOnboardingDir),
    artifacts,
    nextActions: [
      "Run npm run ops:onboarding:check after upgrade.",
      "If operational approval records were skipped because they were already approved, create a new approved packet for the current release instead of rewriting old approvals.",
      "Replace placeholders only after real external approvals are available.",
    ],
    safetyNotes: [
      "This upgrade adjusts release metadata only; it never marks approvals as APPROVED.",
      "Approved release records are not rewritten automatically.",
      "The report stores relative paths, package version, release tag, and status only; it does not store secrets, raw URLs, contacts, victim indicators, storage paths, tokens, or certificate material.",
    ],
  };
}

export function formatProductionOnboardingUpgradeMarkdown(summary) {
  const lines = [
    "# JiumAI Production Onboarding Upgrade Report",
    "",
    `- Generated at: ${summary.generatedAt}`,
    `- Status: ${summary.status}`,
    `- Dry run: ${summary.dryRun ? "YES" : "NO"}`,
    `- Package version: ${summary.packageVersion || "MISSING"}`,
    `- Release tag: ${summary.releaseTag || "MISSING"}`,
    `- Onboarding dir: ${summary.onboardingDir}`,
    "",
    "## Artifacts",
    ...summary.artifacts.map((entry) => `- ${entry.status} ${entry.label}: ${entry.path}`),
    "",
    "## Next Actions",
    ...summary.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...summary.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = {
    format: "text",
    root: repoRoot,
    onboardingDir: DEFAULT_PRODUCTION_ONBOARDING_DIR,
    outputPath: "",
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--root") {
      args.root = argv[index + 1] || args.root;
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = arg.slice("--root=".length);
    } else if (arg === "--dir") {
      args.onboardingDir = argv[index + 1] || args.onboardingDir;
      index += 1;
    } else if (arg.startsWith("--dir=")) {
      args.onboardingDir = arg.slice("--dir=".length);
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
  if (SENSITIVE_PATTERN.test(outputPath)) {
    throw new Error("Refusing to write report to a sensitive-looking output path.");
  }
  mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, content, "utf8");
  console.log(`Production onboarding upgrade report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const summary = upgradeProductionOnboarding({
      root: path.resolve(args.root),
      onboardingDir: args.onboardingDir,
      dryRun: args.dryRun,
    });
    const content = args.format === "json" ? JSON.stringify(summary, null, 2) : formatProductionOnboardingUpgradeMarkdown(summary);
    writeOutput(content, args.outputPath);
    if (summary.status === "BLOCKED") {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
