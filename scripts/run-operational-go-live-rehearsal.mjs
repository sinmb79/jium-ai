#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOperationalGoLiveReport,
  validateOperationalGoLive,
} from "./check-operational-go-live.mjs";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
} from "./check-operational-approval-records.mjs";
import {
  REQUIRED_OPERATOR_CHECKLIST_RECORDS,
} from "./check-production-onboarding.mjs";
import {
  REQUIRED_STORAGE_DECISION_SECTIONS,
} from "./approve-production-onboarding-storage-decision.mjs";
import {
  REQUIRED_PUBLIC_OPERATIONS_SECTIONS,
} from "./approve-production-onboarding-public-operations.mjs";
import {
  REQUIRED_SERVER_ROUTE_TEMPLATES,
} from "./check-server-readiness.mjs";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  TRUSTED_KEY_REGISTRY_PATH,
  TRUSTED_KEY_REGISTRY_VERSION,
} from "./check-authorized-feed-keys.mjs";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
} from "./init-production-onboarding.mjs";
import {
  HOSTED_SECURITY_HEADER_AUDIT_SCHEMA,
  HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY,
} from "./hosted-security-header-audit-evidence.mjs";
import {
  OPERATIONAL_APPROVAL_INPUTS_SCHEMA,
  applyOperationalApprovalInputs,
} from "./operational-approval-inputs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_GO_LIVE_REHEARSAL_SCHEMA = "jium-operational-go-live-rehearsal-v1";
export const OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR = "dist/operational-go-live-rehearsal";

const SYNTHETIC_SECRET = "0123456789abcdef0123456789abcdef";
const SYNTHETIC_ORIGIN = "https://ops.example.test";
const SYNTHETIC_PUBLIC_BASE_URL = "https://prod.example.test/jium";
const SYNTHETIC_INCIDENT_OWNER = "incident-owner-ref";
const SYNTHETIC_APPROVAL_INPUT_PATH = "ops/private/production-onboarding/approved-operational-inputs.rehearsal.json";

const STORAGE_SECTION_CLI = {
  auditLedgerStorage: "audit-ledger",
  accountRegistryStorage: "account-registry",
};

const PUBLIC_OPERATIONS_SECTION_CLI = {
  publicApp: "public-app",
  privacyNotice: "privacy-notice",
  supportRoute: "support-route",
};

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
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

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeRemoveTempDir(target) {
  const resolvedTarget = path.resolve(target);
  const resolvedTemp = path.resolve(os.tmpdir());
  if (!isPathInside(resolvedTemp, resolvedTarget)) {
    throw new Error("refusing to remove rehearsal path outside the system temporary directory");
  }
  rmSync(resolvedTarget, { recursive: true, force: true });
}

function hostedSecurityHeaderAudit(generatedAt) {
  return {
    schema: HOSTED_SECURITY_HEADER_AUDIT_SCHEMA,
    generatedAt,
    status: "READY",
    summary: {
      targetUrlState: "HTTPS",
      fetchState: "COMPLETED",
      httpStatus: 200,
      checkedHeaderCount: 6,
      passCount: 6,
      failureCount: 0,
      missingCount: 0,
      mismatchCount: 0,
    },
    checks: [],
    errors: [],
    safetyNotes: ["Synthetic rehearsal audit; do not use as production hosted evidence."],
  };
}

function writeRouteTemplates(root) {
  for (const relativeRoute of REQUIRED_SERVER_ROUTE_TEMPLATES) {
    writeText(
      path.join(root, "server-route-templates", "app", relativeRoute),
      "export async function POST() { return new Response(); }\n",
    );
  }
}

function writeTrustedKeyRegistry(root, generatedAt) {
  writeJson(path.join(root, TRUSTED_KEY_REGISTRY_PATH), {
    version: TRUSTED_KEY_REGISTRY_VERSION,
    keys: [
      {
        keyId: "institution-key-rehearsal",
        issuerName: "Rehearsal Institution",
        algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
        publicKeyJwk: {
          kty: "RSA",
          n: "public-modulus-for-go-live-rehearsal",
          e: "AQAB",
          use: "sig",
        },
        validFrom: generatedAt,
        validUntil: "2036-06-01T00:00:00.000Z",
      },
    ],
  });
}

function writeServerEnv(root, storageRoot, generatedAt) {
  const auditDir = path.join(storageRoot, "audit-ledger");
  const accountDir = path.join(storageRoot, "account-registry");
  const hostedAuditPath = path.join(DEFAULT_PRODUCTION_ONBOARDING_DIR, "hosted-security-header-audit.json").replace(/\\/g, "/");
  writeText(
    path.join(root, ".env.server.local"),
    [
      "# JiumAI synthetic go-live rehearsal env",
      "NODE_ENV=production",
      "JIUM_SERVER_ROUTES=true",
      `INSTITUTION_SESSION_SECRET=${SYNTHETIC_SECRET}`,
      "INSTITUTION_SESSION_KEY_ID=rehearsal-key",
      `INSTITUTION_SESSION_SECRET_VALID_FROM=${generatedAt}`,
      "INSTITUTION_SESSION_SECRET_VALID_UNTIL=2036-06-01T00:00:00.000Z",
      `INSTITUTION_ALLOWED_ORIGINS=${SYNTHETIC_ORIGIN}`,
      "INSTITUTION_SECURE_COOKIES=true",
      `INSTITUTION_AUDIT_LEDGER_DIR=${auditDir}`,
      "INSTITUTION_AUDIT_LEDGER_FILE=institution-auth-audit-ledger.jsonl",
      `INSTITUTION_ACCOUNT_REGISTRY_DIR=${accountDir}`,
      "JIUM_GO_LIVE_APPROVAL=APPROVED",
      "JIUM_LEGAL_REVIEW_APPROVAL=APPROVED",
      "JIUM_RELEASE_EVIDENCE_REVIEW=APPROVED",
      "JIUM_DATA_RETENTION_POLICY_ACK=APPROVED",
      `JIUM_PUBLIC_APP_URL=${SYNTHETIC_PUBLIC_BASE_URL}`,
      `${HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY}=${hostedAuditPath}`,
      `JIUM_PRIVACY_NOTICE_URL=${SYNTHETIC_PUBLIC_BASE_URL}/privacy`,
      `JIUM_SUPPORT_CONTACT_ROUTE=${SYNTHETIC_PUBLIC_BASE_URL}/support`,
      `JIUM_INCIDENT_RESPONSE_OWNER=${SYNTHETIC_INCIDENT_OWNER}`,
      `JIUM_OPERATIONAL_APPROVAL_RECORDS=${DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH}`,
      "",
    ].join("\n"),
  );
}

function syntheticApprovalInputs(version, generatedAt) {
  return {
    schema: OPERATIONAL_APPROVAL_INPUTS_SCHEMA,
    packageVersion: version,
    operationalApprovalRecords: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type, index) => ({
      type,
      approvedByRef: `approver-ref-${String(index + 1).padStart(2, "0")}`,
      referenceId: `OPS-REHEARSAL-${String(index + 1).padStart(2, "0")}`,
      scope: `release-v${version}`,
      evidenceDigest: sha256Text(`${type}:${version}:rehearsal`),
      approvedAt: generatedAt,
      expiresAt: "",
    })),
    onboardingChecklist: REQUIRED_OPERATOR_CHECKLIST_RECORDS.map((recordId, index) => ({
      recordId,
      evidenceRef: `evidence-ref-${String(index + 1).padStart(2, "0")}`,
    })),
    storageDecisions: REQUIRED_STORAGE_DECISION_SECTIONS.map((section, index) => ({
      section: STORAGE_SECTION_CLI[section],
      evidenceRef: `storage-ref-${String(index + 1).padStart(2, "0")}`,
    })),
    publicOperations: REQUIRED_PUBLIC_OPERATIONS_SECTIONS.map((section, index) => ({
      section: PUBLIC_OPERATIONS_SECTION_CLI[section],
      evidenceRef: `public-ref-${String(index + 1).padStart(2, "0")}`,
    })),
  };
}

function writeSyntheticApprovalInputs(root, version, generatedAt) {
  writeJson(path.join(root, SYNTHETIC_APPROVAL_INPUT_PATH), syntheticApprovalInputs(version, generatedAt));
  return SYNTHETIC_APPROVAL_INPUT_PATH;
}

function simulatedDesktopPublish(version, generatedAt, platform = process.platform) {
  const metadataFile = platform === "darwin" ? "latest-mac.yml" : platform === "linux" ? "latest-linux.yml" : "latest.yml";
  const installerName = platform === "darwin"
    ? `JiumAI-${version}-mac.zip`
    : platform === "linux"
      ? `JiumAI-${version}.AppImage`
      : `JiumAI-${version}-win-x64.exe`;
  const publishFiles = platform === "win32" ? [installerName, `${installerName}.blockmap`, metadataFile] : [installerName, metadataFile];
  return {
    valid: true,
    errors: [],
    packageVersion: version,
    releaseTag: `v${version}`,
    releaseTagVersion: version,
    envSummary: {
      JIUM_DESKTOP_RELEASE_TAG: "SET",
      JIUM_DESKTOP_PUBLISH_APPROVAL: "APPROVED",
      GITHUB_REPOSITORY: "SET",
      GITHUB_TOKEN: "SET",
    },
    distribution: {
      valid: true,
      errors: [],
      platform,
    },
    releaseReadiness: {
      valid: true,
      errors: [],
      envSummary: {
        JIUM_DESKTOP_RELEASE_CHANNEL: "SET",
        JIUM_DESKTOP_UPDATE_URL: "SET_HTTPS",
        SIGNING_PROFILE_COUNT: 1,
      },
      staticExport: { valid: true, errors: [] },
    },
    updateFeed: {
      valid: true,
      errors: [],
      platform,
      metadata: {
        file: metadataFile,
        version,
        path: installerName,
        releaseDate: generatedAt,
        fileCount: 1,
      },
      artifacts: [{ path: installerName, bytes: 128, sha512Status: "MATCH", sizeStatus: "MATCH" }],
    },
    publishArtifacts: {
      valid: true,
      errors: [],
      files: publishFiles,
    },
  };
}

async function prepareRehearsalWorkspace({ version, generatedAt, now }) {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), "jium-go-live-rehearsal-"));
  const storageRoot = mkdtempSync(path.join(os.tmpdir(), "jium-go-live-storage-"));
  writeJson(path.join(workspaceRoot, "package.json"), { version });
  writeRouteTemplates(workspaceRoot);
  writeTrustedKeyRegistry(workspaceRoot, generatedAt);
  writeServerEnv(workspaceRoot, storageRoot, generatedAt);
  writeJson(path.join(workspaceRoot, DEFAULT_PRODUCTION_ONBOARDING_DIR, "hosted-security-header-audit.json"), hostedSecurityHeaderAudit(generatedAt));
  const inputPath = writeSyntheticApprovalInputs(workspaceRoot, version, generatedAt);
  const approvalInputs = await applyOperationalApprovalInputs({
    root: workspaceRoot,
    inputPath,
    init: true,
    generatedAt,
    now,
  });
  return { workspaceRoot, storageRoot, approvalInputsReport: approvalInputs.report };
}

function buildOperationalGoLiveRehearsalReport({
  version,
  generatedAt,
  goLiveReport,
  approvalInputsReport,
  readiness,
  cleanedTemporaryWorkspace,
  cleanupWarnings,
}) {
  const checks = [
    {
      id: "temporary-workspace",
      label: "Synthetic private workspace was created outside the source repository",
      status: "PASS",
    },
    {
      id: "desktop-publish-simulation",
      label: "Desktop publish gate is explicitly simulated for rehearsal only",
      status: "PASS",
    },
    {
      id: "approval-inputs-apply",
      label: "Synthetic approval/onboarding records were applied through the batch approval input path",
      status:
        approvalInputsReport?.status === "APPLIED" &&
        approvalInputsReport?.summary?.readyInputCount === approvalInputsReport?.summary?.totalInputCount &&
        approvalInputsReport?.summary?.appliedCount === approvalInputsReport?.summary?.totalInputCount &&
        approvalInputsReport?.summary?.approvalRecordsStatus === "READY" &&
        approvalInputsReport?.summary?.productionOnboardingStatus === "READY" &&
        approvalInputsReport?.leakScan?.status === "PASS"
          ? "PASS"
          : "BLOCKED",
    },
    ...goLiveReport.checks,
    {
      id: "workspace-cleanup",
      label: "Synthetic workspace and storage were removed after rehearsal",
      status: cleanedTemporaryWorkspace ? "PASS" : "BLOCKED",
    },
  ];
  const errors = [
    ...(approvalInputsReport?.errors || []).map((error) => `approval inputs: ${error}`),
    ...(approvalInputsReport?.status === "APPLIED" ? [] : ["approval inputs batch apply did not complete"]),
    ...(approvalInputsReport?.summary?.appliedCount === approvalInputsReport?.summary?.totalInputCount
      ? []
      : ["approval inputs batch apply did not apply every required input"]),
    ...(approvalInputsReport?.summary?.approvalRecordsStatus === "READY" ? [] : ["approval inputs did not produce READY approval records"]),
    ...(approvalInputsReport?.summary?.productionOnboardingStatus === "READY" ? [] : ["approval inputs did not produce READY production onboarding"]),
    ...readiness.errors,
    ...(cleanedTemporaryWorkspace ? [] : ["temporary rehearsal workspace cleanup did not complete"]),
  ];

  return {
    schema: OPERATIONAL_GO_LIVE_REHEARSAL_SCHEMA,
    generatedAt,
    status: errors.length === 0 ? "READY" : "BLOCKED",
    version,
    summary: {
      goLiveStatus: goLiveReport.status,
      goLiveErrorCount: goLiveReport.summary.errorCount,
      serverStatus: goLiveReport.summary.serverStatus,
      productionOnboardingStatus: goLiveReport.summary.productionOnboardingStatus,
      approvalRecordsStatus: goLiveReport.summary.approvalRecordsStatus,
      hostedSecurityHeaderAuditStatus: goLiveReport.summary.hostedSecurityHeaderAuditStatus,
      activeTrustedKeyCount: goLiveReport.summary.activeTrustedKeyCount,
      approvedApprovalRecordCount: goLiveReport.summary.approvedApprovalRecordCount,
      requiredApprovalRecordCount: goLiveReport.summary.requiredApprovalRecordCount,
      approvalInputsStatus: approvalInputsReport?.status || "MISSING",
      approvalInputsReadyInputCount: approvalInputsReport?.summary?.readyInputCount || 0,
      approvalInputsTotalInputCount: approvalInputsReport?.summary?.totalInputCount || 0,
      approvalInputsAppliedCount: approvalInputsReport?.summary?.appliedCount || 0,
      approvalInputsApprovalRecordsStatus: approvalInputsReport?.summary?.approvalRecordsStatus || "MISSING",
      approvalInputsProductionOnboardingStatus: approvalInputsReport?.summary?.productionOnboardingStatus || "MISSING",
      approvalInputsLeakScanStatus: approvalInputsReport?.leakScan?.status || "MISSING",
      cleanedTemporaryWorkspace: cleanedTemporaryWorkspace ? "YES" : "NO",
    },
    simulation: {
      desktopPublishMode: "SIMULATED_SIGNED_ARTIFACTS",
      publicRoutesMode: "SYNTHETIC_HTTPS_URLS",
      approvalsMode: "SYNTHETIC_BATCH_INPUTS",
      workspaceMode: "TEMPORARY_REPO_EXTERNAL",
    },
    checks,
    errors,
    warnings: cleanupWarnings,
    nextActions: errors.length
      ? ["Resolve rehearsal blockers before relying on the production operating runbook."]
      : [
          "Use this rehearsal only as internal gate verification.",
          "Do not treat synthetic approvals, URLs, hosted audit evidence, or simulated desktop artifacts as production approval.",
          "Proceed to real institution, legal, hosting, signing, and incident-response approval collection.",
        ],
    safetyNotes: [
      "The rehearsal creates only synthetic private data in a temporary workspace and removes it after validation.",
      "Synthetic approvals are written only through the guarded operational approval inputs apply path.",
      "This report stores only statuses, counts, package version, and declared simulation modes.",
      "It does not store synthetic secrets, trusted origins, public URLs, hosted audit paths, storage paths, contacts, owner names, tokens, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "A READY rehearsal proves internal gate wiring only; it is not production go-live approval.",
    ],
  };
}

export async function runOperationalGoLiveRehearsal({
  root = repoRoot,
  generatedAt = new Date().toISOString(),
  now = Date.now(),
  platform = process.platform,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const version = readPackageVersion(resolvedRoot);
  const cleanupWarnings = [];
  const { workspaceRoot, storageRoot, approvalInputsReport } = await prepareRehearsalWorkspace({ version, generatedAt, now });
  let readiness;
  let goLiveReport;
  let cleanedTemporaryWorkspace = false;

  try {
    readiness = await validateOperationalGoLive({
      root: workspaceRoot,
      env: {},
      platform,
      validations: {
        desktopPublish: simulatedDesktopPublish(version, generatedAt, platform),
      },
    });
    goLiveReport = buildOperationalGoLiveReport(readiness, { generatedAt });
  } finally {
    try {
      safeRemoveTempDir(workspaceRoot);
      safeRemoveTempDir(storageRoot);
      cleanedTemporaryWorkspace = !existsSync(workspaceRoot) && !existsSync(storageRoot);
    } catch (error) {
      cleanupWarnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const report = buildOperationalGoLiveRehearsalReport({
    version,
    generatedAt,
    goLiveReport,
    approvalInputsReport,
    readiness,
    cleanedTemporaryWorkspace,
    cleanupWarnings,
  });
  const bundleDir = path.join(resolvedRoot, OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "operational-go-live-rehearsal-report.json"), report);
  writeText(path.join(bundleDir, "operational-go-live-rehearsal-report.md"), formatOperationalGoLiveRehearsalMarkdown(report));

  return {
    valid: report.status === "READY",
    bundleDir,
    bundleDirRelative: relativePath(resolvedRoot, bundleDir),
    report,
  };
}

export function formatOperationalGoLiveRehearsalMarkdown(report) {
  const lines = [
    "# JiumAI Operational Go-Live Rehearsal",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Go-live status: ${report.summary.goLiveStatus}`,
    `- Go-live errors: ${report.summary.goLiveErrorCount}`,
    `- Server status: ${report.summary.serverStatus}`,
    `- Production onboarding status: ${report.summary.productionOnboardingStatus}`,
    `- Approval records: ${report.summary.approvedApprovalRecordCount}/${report.summary.requiredApprovalRecordCount}`,
    `- Approval inputs: ${report.summary.approvalInputsAppliedCount}/${report.summary.approvalInputsTotalInputCount} (${report.summary.approvalInputsStatus})`,
    `- Approval inputs leak scan: ${report.summary.approvalInputsLeakScanStatus}`,
    `- Active trusted keys: ${report.summary.activeTrustedKeyCount}`,
    `- Workspace cleanup: ${report.summary.cleanedTemporaryWorkspace}`,
    "",
    "## Simulation Boundary",
    ...Object.entries(report.simulation).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
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
  const args = { root: repoRoot, format: "markdown", outputPath: "", platform: process.platform };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg.startsWith("--platform=")) {
      args.platform = arg.slice("--platform=".length);
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
    const result = await runOperationalGoLiveRehearsal({ root: args.root, platform: args.platform });
    const content = args.format === "json"
      ? JSON.stringify(result.report, null, 2)
      : formatOperationalGoLiveRehearsalMarkdown(result.report);
    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Operational go-live rehearsal report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Operational go-live rehearsal bundle written: ${result.bundleDirRelative}`);
    }
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
