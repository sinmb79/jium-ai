#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATIONAL_ACTION_PLAN_JSON,
  OPERATIONAL_ACTION_PLAN_MARKDOWN,
  buildOperationalActionPlan,
  loadOperationalHandoffSummary,
  redactOperationalText,
  writeOperationalActionPlanFiles,
} from "./build-operational-action-plan.mjs";
import { OPERATIONAL_HANDOFF_BUNDLE_DIR } from "./build-operational-handoff-bundle.mjs";
import {
  OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR,
  runOperationalGoLiveRehearsal,
} from "./run-operational-go-live-rehearsal.mjs";
import {
  SERVER_ORIGIN_CANDIDATE_DIR,
  SERVER_ORIGIN_CANDIDATE_JSON,
  SERVER_ORIGIN_CANDIDATE_MARKDOWN,
} from "./build-server-origin-candidate.mjs";
import {
  TRUSTED_KEY_APPROVAL_CANDIDATE_DIR,
  TRUSTED_KEY_APPROVAL_CANDIDATE_JSON,
  TRUSTED_KEY_APPROVAL_CANDIDATE_MARKDOWN,
} from "./build-trusted-key-approval-candidate.mjs";
import {
  DESKTOP_PUBLISH_CANDIDATE_DIR,
  DESKTOP_PUBLISH_CANDIDATE_JSON,
  DESKTOP_PUBLISH_CANDIDATE_MARKDOWN,
} from "./build-desktop-publish-candidate.mjs";
import {
  OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR,
  OPERATIONAL_APPROVAL_COMMAND_PACKET_JSON,
  OPERATIONAL_APPROVAL_COMMAND_PACKET_MARKDOWN,
} from "./build-operational-approval-command-packet.mjs";
import {
  OPERATIONAL_LAUNCH_CONSOLE_DIR,
  OPERATIONAL_LAUNCH_CONSOLE_JSON,
  OPERATIONAL_LAUNCH_CONSOLE_MARKDOWN,
} from "./build-operational-launch-console.mjs";
import {
  OPERATIONAL_APPROVAL_INPUTS_DIR,
  OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_JSON,
  OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_MARKDOWN,
} from "./operational-approval-inputs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_RELEASE_DOSSIER_SCHEMA = "jium-operational-release-dossier-v1";
export const OPERATIONAL_RELEASE_DOSSIER_DIR = "dist/operational-release-dossier";
export const OPERATIONAL_RELEASE_DOSSIER_JSON = "operational-release-dossier.json";
export const OPERATIONAL_RELEASE_DOSSIER_MARKDOWN = "operational-release-dossier.md";

const PRIORITY_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePrepareDossierDir(root, dossierDir) {
  const resolved = path.resolve(root, dossierDir);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== OPERATIONAL_RELEASE_DOSSIER_DIR) {
    throw new Error(`Refusing to clean unsafe operational release dossier directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function resolveInputPath(root, inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(root, inputPath);
}

function assertSchema(value, schema, label) {
  if (!value || typeof value !== "object" || value.schema !== schema) {
    throw new Error(`${label} is missing or has unsupported schema.`);
  }
}

function redactValue(value, root) {
  if (typeof value === "string") {
    return redactOperationalText(value, root);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, root));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item, root)]));
  }
  return value;
}

function buildRequiredReviewFiles() {
  return [
    {
      id: "handoff-summary-json",
      label: "Operational handoff summary JSON",
      path: `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/operational-handoff-summary.json`,
      purpose: "Gate status and report index for technical review.",
    },
    {
      id: "handoff-summary-markdown",
      label: "Operational handoff summary Markdown",
      path: `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/operational-handoff-summary.md`,
      purpose: "Human-readable operating runbook summary.",
    },
    {
      id: "action-plan-json",
      label: "Operational action plan JSON",
      path: `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/${OPERATIONAL_ACTION_PLAN_JSON}`,
      purpose: "Owner-routed remaining work and verification commands.",
    },
    {
      id: "action-plan-markdown",
      label: "Operational action plan Markdown",
      path: `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/${OPERATIONAL_ACTION_PLAN_MARKDOWN}`,
      purpose: "Reviewer-facing checklist by owner role.",
    },
    {
      id: "go-live-rehearsal-json",
      label: "Operational go-live rehearsal JSON",
      path: `${OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR}/operational-go-live-rehearsal-report.json`,
      purpose: "Synthetic internal gate-wiring verification.",
    },
    {
      id: "go-live-rehearsal-markdown",
      label: "Operational go-live rehearsal Markdown",
      path: `${OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR}/operational-go-live-rehearsal-report.md`,
      purpose: "Simulation boundary and rehearsal result for reviewers.",
    },
    {
      id: "server-origin-candidate-json",
      label: "Server origin candidate JSON",
      path: `${SERVER_ORIGIN_CANDIDATE_DIR}/${SERVER_ORIGIN_CANDIDATE_JSON}`,
      purpose: "Redacted server origin approval candidate and private command digest.",
    },
    {
      id: "server-origin-candidate-markdown",
      label: "Server origin candidate Markdown",
      path: `${SERVER_ORIGIN_CANDIDATE_DIR}/${SERVER_ORIGIN_CANDIDATE_MARKDOWN}`,
      purpose: "Human-readable server origin approval candidate summary.",
    },
    {
      id: "trusted-key-approval-candidate-json",
      label: "Trusted key approval candidate JSON",
      path: `${TRUSTED_KEY_APPROVAL_CANDIDATE_DIR}/${TRUSTED_KEY_APPROVAL_CANDIDATE_JSON}`,
      purpose: "Redacted trusted-key approval candidate and artifact digests.",
    },
    {
      id: "trusted-key-approval-candidate-markdown",
      label: "Trusted key approval candidate Markdown",
      path: `${TRUSTED_KEY_APPROVAL_CANDIDATE_DIR}/${TRUSTED_KEY_APPROVAL_CANDIDATE_MARKDOWN}`,
      purpose: "Human-readable trusted-key approval candidate summary.",
    },
    {
      id: "desktop-publish-candidate-json",
      label: "Desktop publish candidate JSON",
      path: `${DESKTOP_PUBLISH_CANDIDATE_DIR}/${DESKTOP_PUBLISH_CANDIDATE_JSON}`,
      purpose: "Redacted signed desktop publish approval candidate and evidence digest summary.",
    },
    {
      id: "desktop-publish-candidate-markdown",
      label: "Desktop publish candidate Markdown",
      path: `${DESKTOP_PUBLISH_CANDIDATE_DIR}/${DESKTOP_PUBLISH_CANDIDATE_MARKDOWN}`,
      purpose: "Human-readable desktop publish approval candidate summary.",
    },
    {
      id: "operational-approval-command-packet-json",
      label: "Operational approval command packet JSON",
      path: `${OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR}/${OPERATIONAL_APPROVAL_COMMAND_PACKET_JSON}`,
      purpose: "Redacted command templates for external approval recording and onboarding evidence updates.",
    },
    {
      id: "operational-approval-command-packet-markdown",
      label: "Operational approval command packet Markdown",
      path: `${OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR}/${OPERATIONAL_APPROVAL_COMMAND_PACKET_MARKDOWN}`,
      purpose: "Human-readable approval and onboarding command packet for operators.",
    },
    {
      id: "operational-launch-console-json",
      label: "Operational launch console JSON",
      path: `${OPERATIONAL_LAUNCH_CONSOLE_DIR}/${OPERATIONAL_LAUNCH_CONSOLE_JSON}`,
      purpose: "Owner-lane launch board that separates external inputs from verification commands.",
    },
    {
      id: "operational-launch-console-markdown",
      label: "Operational launch console Markdown",
      path: `${OPERATIONAL_LAUNCH_CONSOLE_DIR}/${OPERATIONAL_LAUNCH_CONSOLE_MARKDOWN}`,
      purpose: "Human-readable launch board for program owner, legal reviewer, release manager, and deployment admin.",
    },
    {
      id: "operational-approval-inputs-template-json",
      label: "Operational approval inputs template JSON",
      path: `${OPERATIONAL_APPROVAL_INPUTS_DIR}/${OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_JSON}`,
      purpose: "Private-fill template for batch recording externally approved approval and onboarding references.",
    },
    {
      id: "operational-approval-inputs-template-markdown",
      label: "Operational approval inputs template Markdown",
      path: `${OPERATIONAL_APPROVAL_INPUTS_DIR}/${OPERATIONAL_APPROVAL_INPUTS_TEMPLATE_MARKDOWN}`,
      purpose: "Human-readable guide for preparing a private approval input file.",
    },
    {
      id: "release-dossier-json",
      label: "Operational release dossier JSON",
      path: `${OPERATIONAL_RELEASE_DOSSIER_DIR}/${OPERATIONAL_RELEASE_DOSSIER_JSON}`,
      purpose: "Redacted manifest for release evidence review.",
    },
    {
      id: "release-dossier-markdown",
      label: "Operational release dossier Markdown",
      path: `${OPERATIONAL_RELEASE_DOSSIER_DIR}/${OPERATIONAL_RELEASE_DOSSIER_MARKDOWN}`,
      purpose: "External-review handoff document.",
    },
  ];
}

function summarizeGates(summary) {
  return (summary.gates || []).map((gate) => ({
    id: gate.id,
    status: gate.status,
    errorCount: gate.errorCount,
  }));
}

function priorityActions(actionPlan, root) {
  return (actionPlan.phases || [])
    .flatMap((phase) =>
      (phase.actions || []).map((action) => ({
        phaseId: phase.id,
        phaseTitle: redactOperationalText(phase.title, root),
        ownerRole: phase.ownerRole,
        actionId: action.id,
        status: action.status,
        priority: action.priority,
        action: redactOperationalText(action.action, root),
        evidenceTarget: redactOperationalText(action.evidenceTarget, root),
        verificationCommands: (action.verificationCommands || []).map((command) => redactOperationalText(command, root)),
        reportRefs: (action.reportRefs || []).map((reportRef) => redactOperationalText(reportRef, root)),
      })),
    )
    .filter((action) => action.status !== "DONE")
    .sort((left, right) => {
      const priority = (PRIORITY_ORDER[left.priority] ?? 9) - (PRIORITY_ORDER[right.priority] ?? 9);
      if (priority !== 0) return priority;
      return `${left.phaseId}:${left.actionId}`.localeCompare(`${right.phaseId}:${right.actionId}`);
    })
    .slice(0, 12);
}

function reviewRunOrder(actionPlan, root) {
  return (actionPlan.runOrder || []).map((entry) => ({
    order: entry.order,
    phaseId: entry.phaseId,
    status: entry.status,
    ownerRole: entry.ownerRole,
    verificationCommands: (entry.verificationCommands || []).map((command) => redactOperationalText(command, root)),
  }));
}

function rehearsalSummary(rehearsalReport) {
  const checks = rehearsalReport.checks || [];
  return {
    status: rehearsalReport.status,
    version: rehearsalReport.version,
    goLiveStatus: rehearsalReport.summary?.goLiveStatus || "UNKNOWN",
    goLiveErrorCount: rehearsalReport.summary?.goLiveErrorCount ?? 0,
    approvalInputsStatus: rehearsalReport.summary?.approvalInputsStatus || "UNKNOWN",
    approvalInputsAppliedCount: rehearsalReport.summary?.approvalInputsAppliedCount ?? 0,
    approvalInputsTotalInputCount: rehearsalReport.summary?.approvalInputsTotalInputCount ?? 0,
    approvalInputsApprovalRecordsStatus: rehearsalReport.summary?.approvalInputsApprovalRecordsStatus || "UNKNOWN",
    approvalInputsProductionOnboardingStatus: rehearsalReport.summary?.approvalInputsProductionOnboardingStatus || "UNKNOWN",
    approvalInputsLeakScanStatus: rehearsalReport.summary?.approvalInputsLeakScanStatus || "UNKNOWN",
    passCheckCount: checks.filter((check) => check.status === "PASS").length,
    blockedCheckCount: checks.filter((check) => check.status !== "PASS").length,
    simulation: rehearsalReport.simulation || {},
  };
}

function leakPatterns(root) {
  const escapedRoot = path.resolve(root).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalizedRoot = path.resolve(root).replace(/\\/g, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    { id: "raw-url", label: "Raw URL", regex: /https?:\/\/[^\s")]+/i },
    { id: "raw-invite", label: "Raw invite route", regex: /\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/i },
    { id: "raw-onion", label: "Raw onion address", regex: /\b[a-z2-7]{16,56}\.onion\b/i },
    { id: "raw-email", label: "Raw email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
    {
      id: "raw-token",
      label: "Raw token",
      regex: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/i,
    },
    { id: "raw-phone", label: "Raw phone number", regex: /\b(?:(?:\+?\d{1,3}[-.\s]?)?(?:0\d{1,2}[-.\s]?)?\d{3,4}[-.\s]?\d{4})\b/ },
    { id: "repo-root", label: "Repository root path", regex: new RegExp(`${escapedRoot}|${normalizedRoot}`, "i") },
  ];
}

function scanForLeaks(value, root) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const findings = leakPatterns(root)
    .filter((pattern) => pattern.regex.test(text))
    .map((pattern) => ({
      id: pattern.id,
      label: pattern.label,
    }));
  return {
    status: findings.length ? "BLOCKED" : "PASS",
    checkedPatternCount: leakPatterns(root).length,
    findings,
  };
}

function statusFor({ summary, actionPlan, rehearsalReport, leakScan }) {
  if (leakScan.status !== "PASS" || rehearsalReport.status !== "READY") {
    return "BLOCKED";
  }
  if (summary.status === "READY" && actionPlan.status === "READY") {
    return "READY_FOR_GO_LIVE_ARCHIVE";
  }
  return "READY_FOR_EXTERNAL_REVIEW";
}

async function resolveSummary({ root, env, platform, generatedAt, summary, summaryPath }) {
  if (summaryPath) {
    const loaded = readJson(resolveInputPath(root, summaryPath));
    assertSchema(loaded, "jium-operational-handoff-bundle-v1", "Operational handoff summary");
    return loaded;
  }
  return loadOperationalHandoffSummary({ root, env, platform, generatedAt, summary });
}

async function resolveActionPlan({ root, env, platform, generatedAt, summary, actionPlan, actionPlanPath, deriveMissingActionPlan = false }) {
  if (actionPlanPath) {
    const resolvedActionPlanPath = resolveInputPath(root, actionPlanPath);
    if (existsSync(resolvedActionPlanPath)) {
      const loaded = readJson(resolvedActionPlanPath);
      assertSchema(loaded, "jium-operational-action-plan-v1", "Operational action plan");
      return loaded;
    }
    if (!deriveMissingActionPlan) {
      throw new Error(`Operational action plan source report is missing: ${actionPlanPath}`);
    }
  }
  if (actionPlan) {
    assertSchema(actionPlan, "jium-operational-action-plan-v1", "Operational action plan");
    return actionPlan;
  }
  const plan = await buildOperationalActionPlan({ root, env, platform, generatedAt, summary });
  writeOperationalActionPlanFiles({ root, plan });
  return plan;
}

async function resolveRehearsal({ root, generatedAt, platform, rehearsalReport, rehearsalPath }) {
  if (rehearsalPath) {
    const loaded = readJson(resolveInputPath(root, rehearsalPath));
    assertSchema(loaded, "jium-operational-go-live-rehearsal-v1", "Operational go-live rehearsal report");
    return loaded;
  }
  if (rehearsalReport) {
    assertSchema(rehearsalReport, "jium-operational-go-live-rehearsal-v1", "Operational go-live rehearsal report");
    return rehearsalReport;
  }
  const result = await runOperationalGoLiveRehearsal({ root, generatedAt, platform });
  return result.report;
}

export async function buildOperationalReleaseDossier({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
  summary,
  summaryPath,
  actionPlan,
  actionPlanPath,
  deriveMissingActionPlan = false,
  rehearsalReport,
  rehearsalPath,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const handoffSummary = redactValue(
    await resolveSummary({ root: resolvedRoot, env, platform, generatedAt, summary, summaryPath }),
    resolvedRoot,
  );
  const resolvedActionPlan = redactValue(
    await resolveActionPlan({
      root: resolvedRoot,
      env,
      platform,
      generatedAt,
      summary: handoffSummary,
      actionPlan,
      actionPlanPath,
      deriveMissingActionPlan,
    }),
    resolvedRoot,
  );
  const resolvedRehearsal = redactValue(
    await resolveRehearsal({ root: resolvedRoot, generatedAt, platform, rehearsalReport, rehearsalPath }),
    resolvedRoot,
  );

  const gateSummary = summarizeGates(handoffSummary);
  const blockedGateCount = gateSummary.filter((gate) => gate.status !== "READY" || gate.errorCount > 0).length;
  const reviewFiles = buildRequiredReviewFiles();
  const baseDossier = {
    schema: OPERATIONAL_RELEASE_DOSSIER_SCHEMA,
    generatedAt,
    status: "BLOCKED",
    source: {
      handoffSchema: handoffSummary.schema,
      handoffStatus: handoffSummary.status,
      actionPlanSchema: resolvedActionPlan.schema,
      actionPlanStatus: resolvedActionPlan.status,
      rehearsalSchema: resolvedRehearsal.schema,
      rehearsalStatus: resolvedRehearsal.status,
      version: handoffSummary.version || resolvedRehearsal.version || "",
      commit: handoffSummary.commit || "",
      platform: handoffSummary.platform || platform,
    },
    summary: {
      gateCount: gateSummary.length,
      blockedGateCount,
      readyGateCount: gateSummary.length - blockedGateCount,
      openActionCount: resolvedActionPlan.summary?.todoActionCount ?? 0,
      completedActionCount: resolvedActionPlan.summary?.doneActionCount ?? 0,
      externalRecordCount: (handoffSummary.externalRecordsNeeded || []).length,
      requiredReviewFileCount: reviewFiles.length,
      rehearsalStatus: resolvedRehearsal.status,
    },
    requiredReviewFiles: reviewFiles,
    gateSummary,
    externalRecordsNeeded: (handoffSummary.externalRecordsNeeded || []).map((record) => redactOperationalText(record, resolvedRoot)),
    priorityActions: priorityActions(resolvedActionPlan, resolvedRoot),
    reviewRunOrder: reviewRunOrder(resolvedActionPlan, resolvedRoot),
    rehearsal: rehearsalSummary(resolvedRehearsal),
    nextCommands: [
      "npm run ops:handoff:bundle",
      "npm run ops:action-plan",
      "npm run ops:launch-console",
      "npm run ops:approvals:input-template",
      "npm run ops:go-live:rehearsal",
      "npm run ops:release-dossier",
      "npm run ops:go-live:check",
    ],
    safetyNotes: [
      "This dossier is an external-review manifest, not go-live approval.",
      "It stores redacted statuses, counts, report names, owner roles, and verification command templates only.",
      "Keep raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, and private storage paths in approved private systems only.",
      "A READY_FOR_EXTERNAL_REVIEW result means the evidence packet can be reviewed; it does not mean production launch is approved.",
    ],
  };
  const leakScan = scanForLeaks(baseDossier, resolvedRoot);
  return {
    ...baseDossier,
    status: statusFor({ summary: handoffSummary, actionPlan: resolvedActionPlan, rehearsalReport: resolvedRehearsal, leakScan }),
    leakScan,
  };
}

export function formatOperationalReleaseDossierMarkdown(dossier) {
  const lines = [
    "# JiumAI Operational Release Dossier",
    "",
    `- Generated at: ${dossier.generatedAt}`,
    `- Status: ${dossier.status}`,
    `- Version: ${dossier.source.version || "MISSING"}`,
    `- Commit: ${dossier.source.commit || "MISSING"}`,
    `- Handoff status: ${dossier.source.handoffStatus}`,
    `- Action plan status: ${dossier.source.actionPlanStatus}`,
    `- Rehearsal status: ${dossier.source.rehearsalStatus}`,
    `- Leak scan: ${dossier.leakScan.status}`,
    "",
    "## Required Review Files",
    ...dossier.requiredReviewFiles.map((file) => `- ${file.id}: ${file.path} (${file.purpose})`),
    "",
    "## Gate Summary",
    ...dossier.gateSummary.map((gate) => `- ${gate.status} ${gate.id}: ${gate.errorCount} error(s)`),
    "",
    "## External Records Needed",
    ...(dossier.externalRecordsNeeded.length ? dossier.externalRecordsNeeded.map((record) => `- ${record}`) : ["- None"]),
    "",
    "## Priority Actions",
    ...(dossier.priorityActions.length
      ? dossier.priorityActions.map(
          (action) =>
            `- ${action.priority} ${action.phaseId} (${action.ownerRole}): ${action.action}\n  Evidence: ${action.evidenceTarget}\n  Verify: ${action.verificationCommands.map((command) => `\`${command}\``).join("; ")}`,
        )
      : ["- None"]),
    "",
    "## Review Run Order",
    ...dossier.reviewRunOrder.map((entry) => `- ${entry.order}. ${entry.phaseId} (${entry.ownerRole}): ${entry.status}`),
    "",
    "## Rehearsal Boundary",
    `- Status: ${dossier.rehearsal.status}`,
    `- Go-live status: ${dossier.rehearsal.goLiveStatus}`,
    `- Approval inputs: ${dossier.rehearsal.approvalInputsAppliedCount}/${dossier.rehearsal.approvalInputsTotalInputCount} (${dossier.rehearsal.approvalInputsStatus})`,
    `- Approval input readiness: records=${dossier.rehearsal.approvalInputsApprovalRecordsStatus}, onboarding=${dossier.rehearsal.approvalInputsProductionOnboardingStatus}, leakScan=${dossier.rehearsal.approvalInputsLeakScanStatus}`,
    `- Pass checks: ${dossier.rehearsal.passCheckCount}`,
    `- Blocked checks: ${dossier.rehearsal.blockedCheckCount}`,
    ...Object.entries(dossier.rehearsal.simulation || {}).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Leak Scan",
    `- Status: ${dossier.leakScan.status}`,
    `- Checked patterns: ${dossier.leakScan.checkedPatternCount}`,
    ...(dossier.leakScan.findings.length ? dossier.leakScan.findings.map((finding) => `- Finding: ${finding.id} ${finding.label}`) : ["- Findings: None"]),
    "",
    "## Next Commands",
    ...dossier.nextCommands.map((command) => `- \`${command}\``),
    "",
    "## Safety Notes",
    ...dossier.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function writeOperationalReleaseDossierFiles({
  root = repoRoot,
  dossier,
  outputPath = "",
  format = "markdown",
} = {}) {
  if (!dossier) {
    throw new Error("Operational release dossier is required.");
  }
  const dossierDir = safePrepareDossierDir(root, OPERATIONAL_RELEASE_DOSSIER_DIR);
  const jsonPath = path.join(dossierDir, OPERATIONAL_RELEASE_DOSSIER_JSON);
  const markdownPath = path.join(dossierDir, OPERATIONAL_RELEASE_DOSSIER_MARKDOWN);
  writeJson(jsonPath, dossier);
  writeText(markdownPath, formatOperationalReleaseDossierMarkdown(dossier));

  if (outputPath) {
    const resolvedOutput = path.resolve(root, outputPath);
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(dossier, null, 2)}\n` : formatOperationalReleaseDossierMarkdown(dossier),
    );
  }

  return {
    dossierDir,
    dossierDirRelative: relativePath(root, dossierDir),
    jsonPath,
    markdownPath,
    jsonPathRelative: relativePath(root, jsonPath),
    markdownPathRelative: relativePath(root, markdownPath),
  };
}

function parseCliArgs(argv) {
  const args = {
    format: "text",
    root: repoRoot,
    summaryPath: "",
    actionPlanPath: "",
    rehearsalPath: "",
    outputPath: "",
    platform: process.platform,
    deriveMissingActionPlan: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--summary") {
      args.summaryPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--summary=")) {
      args.summaryPath = arg.slice("--summary=".length);
    } else if (arg === "--action-plan") {
      args.actionPlanPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--action-plan=")) {
      args.actionPlanPath = arg.slice("--action-plan=".length);
    } else if (arg === "--rehearsal") {
      args.rehearsalPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--rehearsal=")) {
      args.rehearsalPath = arg.slice("--rehearsal=".length);
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg.startsWith("--platform=")) {
      args.platform = arg.slice("--platform=".length);
    } else if (arg === "--no-build") {
      args.summaryPath = args.summaryPath || `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/operational-handoff-summary.json`;
      args.actionPlanPath = args.actionPlanPath || `${OPERATIONAL_HANDOFF_BUNDLE_DIR}/${OPERATIONAL_ACTION_PLAN_JSON}`;
      args.rehearsalPath =
        args.rehearsalPath || `${OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR}/operational-go-live-rehearsal-report.json`;
      args.deriveMissingActionPlan = true;
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const dossier = await buildOperationalReleaseDossier({
      root: args.root,
      platform: args.platform,
      summaryPath: args.summaryPath,
      actionPlanPath: args.actionPlanPath,
      deriveMissingActionPlan: args.deriveMissingActionPlan,
      rehearsalPath: args.rehearsalPath,
    });
    const written = writeOperationalReleaseDossierFiles({
      root: args.root,
      dossier,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (!args.outputPath) {
      if (args.format === "json") {
        console.log(JSON.stringify(dossier, null, 2));
      } else {
        console.log(formatOperationalReleaseDossierMarkdown(dossier));
        console.log(`Operational release dossier written: ${written.markdownPathRelative}`);
      }
    } else {
      console.log(`Operational release dossier written: ${args.outputPath}`);
    }
    if (dossier.status === "BLOCKED") {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
