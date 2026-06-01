#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDesktopPublishReadinessReport,
  validateDesktopPublishReadiness,
} from "./check-desktop-publish-readiness.mjs";
import {
  buildOperationalApprovalRecordsReport,
  validateOperationalApprovalRecords,
} from "./check-operational-approval-records.mjs";
import {
  buildProductionOnboardingReport,
  validateProductionOnboarding,
} from "./check-production-onboarding.mjs";
import {
  buildServerRuntimeReadinessReport,
  validateServerRuntimeReadiness,
} from "./check-server-readiness.mjs";
import {
  validateHostedSecurityHeaderAuditEvidence,
} from "./hosted-security-header-audit-evidence.mjs";
import { loadServerRuntimeEnvFile } from "./server-runtime-env-file.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function present(value) {
  return Boolean(String(value || "").trim());
}

function approvalStatus(value) {
  return String(value || "") === "APPROVED" ? "APPROVED" : "MISSING_OR_NOT_APPROVED";
}

function httpsUrlStatus(value) {
  if (!present(value)) {
    return "MISSING";
  }
  try {
    return new URL(String(value)).protocol === "https:" ? "SET_HTTPS" : "SET_NOT_HTTPS";
  } catch {
    return "SET_INVALID";
  }
}

function filePresenceStatus(value) {
  return present(value) ? "SET" : "MISSING";
}

export function summarizeOperationalGoLiveEnv(env = process.env) {
  return {
    JIUM_GO_LIVE_APPROVAL: approvalStatus(env.JIUM_GO_LIVE_APPROVAL),
    JIUM_LEGAL_REVIEW_APPROVAL: approvalStatus(env.JIUM_LEGAL_REVIEW_APPROVAL),
    JIUM_RELEASE_EVIDENCE_REVIEW: approvalStatus(env.JIUM_RELEASE_EVIDENCE_REVIEW),
    JIUM_DATA_RETENTION_POLICY_ACK: approvalStatus(env.JIUM_DATA_RETENTION_POLICY_ACK),
    JIUM_PUBLIC_APP_URL: httpsUrlStatus(env.JIUM_PUBLIC_APP_URL),
    JIUM_PRIVACY_NOTICE_URL: httpsUrlStatus(env.JIUM_PRIVACY_NOTICE_URL),
    JIUM_SUPPORT_CONTACT_ROUTE: httpsUrlStatus(env.JIUM_SUPPORT_CONTACT_ROUTE),
    JIUM_INCIDENT_RESPONSE_OWNER: present(env.JIUM_INCIDENT_RESPONSE_OWNER) ? "SET" : "MISSING",
    JIUM_OPERATIONAL_APPROVAL_RECORDS: present(env.JIUM_OPERATIONAL_APPROVAL_RECORDS) ? "SET" : "DEFAULT_PRIVATE_PATH",
    JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: filePresenceStatus(env.JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT),
  };
}

function goLiveNextActionFor(error) {
  if (error.includes("JIUM_GO_LIVE_APPROVAL")) {
    return "Apply approved go-live approval flags with npm run ops:go-live:env:apply.";
  }
  if (error.includes("JIUM_LEGAL_REVIEW_APPROVAL")) {
    return "Apply approved go-live approval flags with npm run ops:go-live:env:apply.";
  }
  if (error.includes("JIUM_RELEASE_EVIDENCE_REVIEW")) {
    return "Build npm run ops:release-dossier and npm run ops:approvals:digest-evidence before approving release evidence.";
  }
  if (error.includes("JIUM_DATA_RETENTION_POLICY_ACK")) {
    return "Apply approved go-live approval flags with npm run ops:go-live:env:apply.";
  }
  if (error.includes("JIUM_PUBLIC_APP_URL")) {
    return "Prepare approved HTTPS public, privacy, and support routes with npm run ops:public-env:init before final go-live review.";
  }
  if (error.includes("JIUM_PRIVACY_NOTICE_URL")) {
    return "Prepare approved HTTPS public, privacy, and support routes with npm run ops:public-env:init before final go-live review.";
  }
  if (error.includes("JIUM_SUPPORT_CONTACT_ROUTE")) {
    return "Prepare approved HTTPS public, privacy, and support routes with npm run ops:public-env:init before final go-live review.";
  }
  if (error.includes("JIUM_INCIDENT_RESPONSE_OWNER")) {
    return "Apply the approved pseudonymous incident owner reference with npm run ops:go-live:env:apply.";
  }
  if (error.includes("hosted security header audit")) {
    return "Run npm run security:headers:check against the approved HTTPS public app URL, then apply the READY redacted report with npm run ops:hosted-audit:apply.";
  }
  if (error.includes("server runtime")) {
    return "Resolve server runtime readiness blockers, including trusted keys and server-only env.";
  }
  if (error.includes("desktop publish")) {
    return "Resolve desktop publish blockers, including signed artifacts, update feed, and release upload approval.";
  }
  if (error.includes("production onboarding")) {
    return "Complete the private production onboarding checklist and run npm run ops:onboarding:check.";
  }
  if (error.includes("approval records")) {
    return "Create approval evidence digests, then validate the private operational approval records packet before go-live.";
  }
  return "Resolve this go-live blocker before production launch.";
}

function envErrors(envSummary) {
  const errors = [];
  if (envSummary.JIUM_GO_LIVE_APPROVAL !== "APPROVED") {
    errors.push("operational go-live approval missing: JIUM_GO_LIVE_APPROVAL=APPROVED");
  }
  if (envSummary.JIUM_LEGAL_REVIEW_APPROVAL !== "APPROVED") {
    errors.push("operational legal review approval missing: JIUM_LEGAL_REVIEW_APPROVAL=APPROVED");
  }
  if (envSummary.JIUM_RELEASE_EVIDENCE_REVIEW !== "APPROVED") {
    errors.push("operational release evidence review missing: JIUM_RELEASE_EVIDENCE_REVIEW=APPROVED");
  }
  if (envSummary.JIUM_DATA_RETENTION_POLICY_ACK !== "APPROVED") {
    errors.push("operational data retention policy acknowledgement missing: JIUM_DATA_RETENTION_POLICY_ACK=APPROVED");
  }
  if (envSummary.JIUM_PUBLIC_APP_URL !== "SET_HTTPS") {
    errors.push("operational public app URL must be HTTPS: JIUM_PUBLIC_APP_URL");
  }
  if (envSummary.JIUM_PRIVACY_NOTICE_URL !== "SET_HTTPS") {
    errors.push("operational privacy notice URL must be HTTPS: JIUM_PRIVACY_NOTICE_URL");
  }
  if (envSummary.JIUM_SUPPORT_CONTACT_ROUTE !== "SET_HTTPS") {
    errors.push("operational support contact route must be HTTPS: JIUM_SUPPORT_CONTACT_ROUTE");
  }
  if (envSummary.JIUM_INCIDENT_RESPONSE_OWNER !== "SET") {
    errors.push("operational incident response owner missing: JIUM_INCIDENT_RESPONSE_OWNER");
  }
  return errors;
}

export async function validateOperationalGoLive({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  validations,
} = {}) {
  const effectiveEnv = loadServerRuntimeEnvFile({ root, env });
  const envSummary = summarizeOperationalGoLiveEnv(effectiveEnv);
  const errors = envErrors(envSummary);
  const serverRuntime = validations?.serverRuntime || validateServerRuntimeReadiness({ root, env: effectiveEnv });
  const desktopPublish =
    validations?.desktopPublish ||
    (await validateDesktopPublishReadiness({ root, env: effectiveEnv, platform, feedDir: path.join(root, "dist", "desktop") }));
  const approvalRecords = validations?.approvalRecords || validateOperationalApprovalRecords({ root, env: effectiveEnv });
  const productionOnboarding = validations?.productionOnboarding || validateProductionOnboarding({ root, env: effectiveEnv });
  const hostedSecurityHeaderAudit =
    validations?.hostedSecurityHeaderAudit || validateHostedSecurityHeaderAuditEvidence({ root, env: effectiveEnv });

  if (!serverRuntime.valid) {
    serverRuntime.errors.forEach((error) => errors.push(`operational server runtime: ${error}`));
  }
  if (!desktopPublish.valid) {
    desktopPublish.errors.forEach((error) => errors.push(`operational desktop publish: ${error}`));
  }
  if (!approvalRecords.valid) {
    approvalRecords.errors.forEach((error) => errors.push(`operational approval records: ${error}`));
  }
  if (!productionOnboarding.valid) {
    errors.push(`operational production onboarding readiness failed: ${productionOnboarding.errors.length} error(s)`);
  }
  if (!hostedSecurityHeaderAudit.valid) {
    hostedSecurityHeaderAudit.errors.forEach((error) => errors.push(`operational ${error}`));
  }

  return {
    valid: errors.length === 0,
    errors,
    envSummary,
    serverRuntime,
    desktopPublish,
    approvalRecords,
    productionOnboarding,
    hostedSecurityHeaderAudit,
  };
}

export function buildOperationalGoLiveReport(readiness, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const serverReport = buildServerRuntimeReadinessReport(readiness.serverRuntime, { generatedAt });
  const desktopReport = buildDesktopPublishReadinessReport(readiness.desktopPublish, { generatedAt });
  const approvalRecordsReport = buildOperationalApprovalRecordsReport(readiness.approvalRecords, { generatedAt });
  const productionOnboardingReport = buildProductionOnboardingReport(readiness.productionOnboarding, { generatedAt });
  const hostedSecurityHeaderAuditStatus = readiness.hostedSecurityHeaderAudit.valid ? "READY" : "BLOCKED";
  const checks = [
    {
      id: "human-go-live-approval",
      label: "Human production go-live approval is explicit",
      status: readiness.envSummary.JIUM_GO_LIVE_APPROVAL === "APPROVED" ? "PASS" : "BLOCKED",
    },
    {
      id: "legal-review",
      label: "Legal and institution operating review is approved",
      status: readiness.envSummary.JIUM_LEGAL_REVIEW_APPROVAL === "APPROVED" ? "PASS" : "BLOCKED",
    },
    {
      id: "release-evidence-review",
      label: "Redacted release evidence bundle has been reviewed",
      status: readiness.envSummary.JIUM_RELEASE_EVIDENCE_REVIEW === "APPROVED" ? "PASS" : "BLOCKED",
    },
    {
      id: "data-retention-policy",
      label: "Data retention and deletion policy has been acknowledged",
      status: readiness.envSummary.JIUM_DATA_RETENTION_POLICY_ACK === "APPROVED" ? "PASS" : "BLOCKED",
    },
    {
      id: "public-urls",
      label: "Public app and privacy notice URLs are HTTPS",
      status:
        readiness.envSummary.JIUM_PUBLIC_APP_URL === "SET_HTTPS" &&
        readiness.envSummary.JIUM_PRIVACY_NOTICE_URL === "SET_HTTPS"
          ? "PASS"
          : "BLOCKED",
    },
    {
      id: "support-operations",
      label: "Support contact route and incident response owner are assigned",
      status:
        readiness.envSummary.JIUM_SUPPORT_CONTACT_ROUTE === "SET_HTTPS" &&
        readiness.envSummary.JIUM_INCIDENT_RESPONSE_OWNER === "SET"
          ? "PASS"
          : "BLOCKED",
    },
    {
      id: "hosted-security-headers",
      label: "Hosted public app response security headers are verified by redacted evidence",
      status: readiness.hostedSecurityHeaderAudit.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "approval-records",
      label: "Private operational approval records packet is complete and redacted",
      status: readiness.approvalRecords.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "production-onboarding",
      label: "Private production onboarding checklist is complete and redacted",
      status: readiness.productionOnboarding.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "server-runtime",
      label: "Institution server runtime readiness passes",
      status: readiness.serverRuntime.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "desktop-publish",
      label: "Signed desktop publish readiness passes",
      status: readiness.desktopPublish.valid ? "PASS" : "BLOCKED",
    },
  ];

  return {
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    summary: {
      errorCount: readiness.errors.length,
      serverStatus: serverReport.status,
      desktopPublishStatus: desktopReport.status,
      approvalRecordsStatus: approvalRecordsReport.status,
      productionOnboardingStatus: productionOnboardingReport.status,
      hostedSecurityHeaderAuditStatus,
      approvedApprovalRecordCount: approvalRecordsReport.summary.approvedRecordCount,
      requiredApprovalRecordCount: approvalRecordsReport.summary.requiredRecordCount,
      onboardingErrorCount: productionOnboardingReport.summary.errorCount,
      onboardingChecklistApprovedRecordCount: productionOnboardingReport.summary.checklistApprovedRecordCount,
      onboardingChecklistRequiredRecordCount: productionOnboardingReport.summary.checklistRequiredRecordCount,
      activeTrustedKeyCount: serverReport.summary.activeKeyCount,
      desktopReleaseTag: desktopReport.summary.releaseTag,
      desktopPackageVersion: desktopReport.summary.packageVersion,
      desktopPublishArtifactCount: desktopReport.summary.publishArtifactCount,
      hostedSecurityHeaderFailureCount: readiness.hostedSecurityHeaderAudit.sourceSummary.failureCount,
    },
    envSummary: readiness.envSummary,
    checks,
    errors: [...readiness.errors],
    nextActions: readiness.errors.length
      ? Array.from(new Set(readiness.errors.map(goLiveNextActionFor)))
      : ["Proceed with production launch using the approved release runbook."],
    safetyNotes: [
      "This report stores approval states, URL validity states, counts, release tag, and package version only.",
      "It does not store public URL values, hosted audit report paths, support contact details, incident owner names, secrets, tokens, certificate material, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.",
      "A READY result is a technical and operating gate summary; it must still be archived with the private human approval records for the release.",
    ],
  };
}

export function formatOperationalGoLiveMarkdown(report) {
  const lines = [
    "# JiumAI Operational Go-Live Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Server status: ${report.summary.serverStatus}`,
    `- Desktop publish status: ${report.summary.desktopPublishStatus}`,
    `- Approval records status: ${report.summary.approvalRecordsStatus}`,
    `- Production onboarding status: ${report.summary.productionOnboardingStatus}`,
    `- Hosted security header audit status: ${report.summary.hostedSecurityHeaderAuditStatus}`,
    `- Approval records: ${report.summary.approvedApprovalRecordCount}/${report.summary.requiredApprovalRecordCount}`,
    `- Onboarding checklist: ${report.summary.onboardingChecklistApprovedRecordCount}/${report.summary.onboardingChecklistRequiredRecordCount}`,
    `- Active trusted keys: ${report.summary.activeTrustedKeyCount}`,
    `- Desktop package version: ${report.summary.desktopPackageVersion || "MISSING"}`,
    `- Desktop release tag: ${report.summary.desktopReleaseTag || "MISSING"}`,
    `- Desktop publish assets: ${report.summary.desktopPublishArtifactCount}`,
    `- Hosted security header failures: ${report.summary.hostedSecurityHeaderFailureCount}`,
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
    "",
    "## Environment Summary",
    ...Object.entries(report.envSummary).map(([key, value]) => `- ${key}: ${value}`),
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
  const args = { format: "text", outputPath: "", platform: process.platform };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
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
  console.log(`Operational go-live report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const readiness = await validateOperationalGoLive({ platform: args.platform });
    const report = buildOperationalGoLiveReport(readiness);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatOperationalGoLiveMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!readiness.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
