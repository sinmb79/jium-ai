#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES } from "./check-operational-approval-records.mjs";
import { REQUIRED_OPERATOR_CHECKLIST_RECORDS } from "./check-production-onboarding.mjs";
import { REQUIRED_STORAGE_DECISION_SECTIONS } from "./approve-production-onboarding-storage-decision.mjs";
import { REQUIRED_PUBLIC_OPERATIONS_SECTIONS } from "./approve-production-onboarding-public-operations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA = "jium-operational-approval-command-packet-v1";
export const OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR = "dist/operational-approval-command-packet";
export const OPERATIONAL_APPROVAL_COMMAND_PACKET_JSON = "operational-approval-command-packet.json";
export const OPERATIONAL_APPROVAL_COMMAND_PACKET_MARKDOWN = "operational-approval-command-packet.md";

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

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function assertSafeFixedDir(root, target, expectedRelative) {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== expectedRelative) {
    throw new Error(`Refusing to clean unsafe operational approval command packet directory: ${resolved}`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = assertSafeFixedDir(root, OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR, OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function commandEntry({ id, group, ownerRole, phaseId, command, evidencePlaceholder, externalApprovalRequired }) {
  return {
    id,
    group,
    ownerRole,
    phaseId,
    command,
    evidencePlaceholder,
    externalApprovalRequired,
  };
}

function buildOperationalApprovalRecordCommands() {
  return REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type) =>
    commandEntry({
      id: `approval-record-${type.toLowerCase().replace(/_/g, "-")}`,
      group: "operational-approval-records",
      ownerRole: "LEGAL_REVIEWER",
      phaseId: "approval-records",
      command:
        `npm run ops:approvals:approve-record -- --type ${type} ` +
        "--approved-by-ref <pseudonymous-approver-ref> " +
        "--reference-id <pseudonymous-approval-reference> " +
        "--scope <approval-scope> " +
        "--evidence-digest <sha256-evidence-digest>",
      evidencePlaceholder: "<sha256-evidence-digest>",
      externalApprovalRequired: true,
    }),
  );
}

function buildOnboardingChecklistCommands() {
  return REQUIRED_OPERATOR_CHECKLIST_RECORDS.map((recordId) =>
    commandEntry({
      id: `onboarding-checklist-${recordId}`,
      group: "production-onboarding-checklist",
      ownerRole: "OPERATIONS_LEAD",
      phaseId: "production-onboarding",
      command: `npm run ops:onboarding:approve-checklist -- --record ${recordId} --evidence-ref <pseudonymous-onboarding-evidence-reference>`,
      evidencePlaceholder: "<pseudonymous-onboarding-evidence-reference>",
      externalApprovalRequired: true,
    }),
  );
}

function buildStorageDecisionCommands() {
  return REQUIRED_STORAGE_DECISION_SECTIONS.map((section) =>
    commandEntry({
      id: `storage-decision-${STORAGE_SECTION_CLI[section]}`,
      group: "production-onboarding-storage-decision",
      ownerRole: "DATA_PROTECTION_OFFICER",
      phaseId: "production-onboarding",
      command: `npm run ops:onboarding:approve-storage-decision -- --section ${STORAGE_SECTION_CLI[section]} --evidence-ref <pseudonymous-storage-evidence-reference>`,
      evidencePlaceholder: "<pseudonymous-storage-evidence-reference>",
      externalApprovalRequired: true,
    }),
  );
}

function buildPublicOperationsCommands() {
  return REQUIRED_PUBLIC_OPERATIONS_SECTIONS.map((section) =>
    commandEntry({
      id: `public-operations-${PUBLIC_OPERATIONS_SECTION_CLI[section]}`,
      group: "production-onboarding-public-operations",
      ownerRole: "OPERATIONS_LEAD",
      phaseId: "production-onboarding",
      command: `npm run ops:onboarding:approve-public-operations -- --section ${PUBLIC_OPERATIONS_SECTION_CLI[section]} --evidence-ref <pseudonymous-public-operations-evidence-reference>`,
      evidencePlaceholder: "<pseudonymous-public-operations-evidence-reference>",
      externalApprovalRequired: true,
    }),
  );
}

function buildFinalVerificationCommands() {
  return [
    commandEntry({
      id: "verify-onboarding-digest",
      group: "verification",
      ownerRole: "OPERATIONS_LEAD",
      phaseId: "production-onboarding",
      command: "npm run ops:onboarding:digest-evidence",
      evidencePlaceholder: "",
      externalApprovalRequired: false,
    }),
    commandEntry({
      id: "verify-onboarding-readiness",
      group: "verification",
      ownerRole: "OPERATIONS_LEAD",
      phaseId: "production-onboarding",
      command: "npm run ops:onboarding:check",
      evidencePlaceholder: "",
      externalApprovalRequired: false,
    }),
    commandEntry({
      id: "verify-approval-records",
      group: "verification",
      ownerRole: "LEGAL_REVIEWER",
      phaseId: "approval-records",
      command: "npm run ops:approvals:check",
      evidencePlaceholder: "",
      externalApprovalRequired: false,
    }),
    commandEntry({
      id: "verify-go-live",
      group: "verification",
      ownerRole: "PROGRAM_OWNER",
      phaseId: "go-live",
      command: "npm run ops:go-live:check",
      evidencePlaceholder: "",
      externalApprovalRequired: false,
    }),
  ];
}

function groupedCounts(commands) {
  return commands.reduce((counts, command) => {
    counts[command.group] = (counts[command.group] || 0) + 1;
    return counts;
  }, {});
}

function scanForLeaks(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
  }));
}

export async function buildOperationalApprovalCommandPacket({
  root = repoRoot,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const commands = [
    ...buildOperationalApprovalRecordCommands(),
    ...buildOnboardingChecklistCommands(),
    ...buildStorageDecisionCommands(),
    ...buildPublicOperationsCommands(),
    ...buildFinalVerificationCommands(),
  ];
  const baseReport = {
    schema: OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA,
    generatedAt,
    status: "READY_FOR_EXTERNAL_APPROVALS",
    version: readPackageVersion(resolvedRoot),
    summary: {
      commandCount: commands.length,
      externalApprovalCommandCount: commands.filter((command) => command.externalApprovalRequired).length,
      verificationCommandCount: commands.filter((command) => !command.externalApprovalRequired).length,
      groupCounts: groupedCounts(commands),
    },
    commands,
    runOrder: [
      "Review release dossier and evidence digests externally.",
      "Replace placeholders only with approved pseudonymous references and reviewed evidence digests.",
      "Run operational approval record commands after legal/program approvals.",
      "Run production onboarding commands after operator/storage/public-route approvals.",
      "Run verification commands and archive the redacted reports with the private release packet.",
    ],
    errors: [],
    warnings: [],
    safetyNotes: [
      "This packet contains command templates only; it does not grant or imply approval.",
      "Do not replace placeholders with raw public URLs, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, tokens, private paths, or certificate material.",
      "Use only pseudonymous references and SHA-256 evidence digests from reviewed redacted evidence packets.",
      "Keep private approval records and onboarding files under ignored private paths or approved private storage.",
    ],
  };
  const leakFindings = scanForLeaks(baseReport);
  const report = {
    ...baseReport,
    status: leakFindings.length ? "BLOCKED" : "READY_FOR_EXTERNAL_APPROVALS",
    leakScan: {
      status: leakFindings.length ? "BLOCKED" : "PASS",
      checkedPatternCount: UNSAFE_PATTERNS.length,
      findings: leakFindings,
    },
    errors: leakFindings.map((finding) => `approval command packet contains unsafe ${finding.label}`),
  };

  writeJson(path.join(reportDir, OPERATIONAL_APPROVAL_COMMAND_PACKET_JSON), report);
  writeText(path.join(reportDir, OPERATIONAL_APPROVAL_COMMAND_PACKET_MARKDOWN), formatOperationalApprovalCommandPacketMarkdown(report));

  return {
    valid: report.status === "READY_FOR_EXTERNAL_APPROVALS",
    report,
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
  };
}

export function formatOperationalApprovalCommandPacketMarkdown(report) {
  const lines = [
    "# JiumAI Operational Approval Command Packet",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Commands: ${report.summary.commandCount}`,
    `- External approval commands: ${report.summary.externalApprovalCommandCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    `- Leak scan: ${report.leakScan.status}`,
    "",
    "## Group Counts",
    ...Object.entries(report.summary.groupCounts).map(([group, count]) => `- ${group}: ${count}`),
    "",
    "## Commands",
    ...report.commands.map((command) => `- ${command.group}/${command.id} (${command.ownerRole}): \`${command.command}\``),
    "",
    "## Run Order",
    ...report.runOrder.map((step, index) => `- ${index + 1}. ${step}`),
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function writeOperationalApprovalCommandPacketOutput({ root = repoRoot, report, outputPath = "", format = "markdown" } = {}) {
  if (!outputPath) {
    return { outputPath: "", outputPathRelative: "" };
  }
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(resolvedRoot, outputPath);
  if (!isPathInside(resolvedRoot, resolvedOutput)) {
    throw new Error("output path must stay inside the repository");
  }
  writeText(
    resolvedOutput,
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatOperationalApprovalCommandPacketMarkdown(report),
  );
  return {
    outputPath: resolvedOutput,
    outputPathRelative: relativePath(resolvedRoot, resolvedOutput),
  };
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
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
    const result = await buildOperationalApprovalCommandPacket({ root: args.root });
    writeOperationalApprovalCommandPacketOutput({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(result.report, null, 2));
    } else {
      console.log(formatOperationalApprovalCommandPacketMarkdown(result.report));
    }
    console.log(`Operational approval command packet written: ${args.outputPath || result.reportDirRelative}`);
    if (!result.valid) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
