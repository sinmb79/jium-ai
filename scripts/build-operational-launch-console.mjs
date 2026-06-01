#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOperationalActionPlan,
  redactOperationalText,
  writeOperationalActionPlanFiles,
} from "./build-operational-action-plan.mjs";
import {
  OPERATIONAL_HANDOFF_BUNDLE_DIR,
} from "./build-operational-handoff-bundle.mjs";
import {
  OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR,
  OPERATIONAL_APPROVAL_COMMAND_PACKET_JSON,
  buildOperationalApprovalCommandPacket,
} from "./build-operational-approval-command-packet.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_LAUNCH_CONSOLE_SCHEMA = "jium-operational-launch-console-v1";
export const OPERATIONAL_LAUNCH_CONSOLE_DIR = "dist/operational-launch-console";
export const OPERATIONAL_LAUNCH_CONSOLE_JSON = "operational-launch-console.json";
export const OPERATIONAL_LAUNCH_CONSOLE_MARKDOWN = "operational-launch-console.md";

const PRIORITY_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
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

function assertSchema(value, schema, label) {
  if (!value || typeof value !== "object" || value.schema !== schema) {
    throw new Error(`${label} is missing or has unsupported schema.`);
  }
}

function resolveInputPath(root, inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(root, inputPath);
}

function assertSafeFixedDir(root, target, expectedRelative) {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== expectedRelative) {
    throw new Error(`Refusing to clean unsafe operational launch console directory: ${resolved}`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = assertSafeFixedDir(root, OPERATIONAL_LAUNCH_CONSOLE_DIR, OPERATIONAL_LAUNCH_CONSOLE_DIR);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sortActions(actions) {
  return [...actions].sort((left, right) => {
    const priority = (PRIORITY_ORDER[left.priority] ?? 9) - (PRIORITY_ORDER[right.priority] ?? 9);
    if (priority !== 0) return priority;
    return String(left.id || "").localeCompare(String(right.id || ""));
  });
}

function redactedAction(action, root) {
  return {
    id: action.id,
    status: action.status,
    priority: action.priority,
    action: redactOperationalText(action.action || "", root),
    evidenceTarget: redactOperationalText(action.evidenceTarget || "", root),
    verificationCommands: (action.verificationCommands || []).map((command) => redactOperationalText(command, root)),
  };
}

function ownerLaneFromPhase(phase, root) {
  const openActions = sortActions((phase.actions || []).filter((action) => action.status !== "DONE"));
  const p0Actions = openActions.filter((action) => action.priority === "P0");
  const gates = (phase.gates || []).map((gate) => ({
    id: gate.id,
    status: gate.status,
    errorCount: gate.errorCount,
  }));
  return {
    phaseId: phase.id,
    title: redactOperationalText(phase.title || phase.id, root),
    ownerRole: phase.ownerRole,
    status: phase.status,
    openActionCount: openActions.length,
    p0OpenActionCount: p0Actions.length,
    gates,
    firstActions: openActions.slice(0, 3).map((action) => redactedAction(action, root)),
    verificationCommands: unique(openActions.flatMap((action) => action.verificationCommands || [])).slice(0, 8).map((command) => redactOperationalText(command, root)),
  };
}

function buildLaunchDecision(actionPlan, commandPacket, leakScan) {
  if (leakScan.status !== "PASS" || commandPacket.status === "BLOCKED") {
    return {
      canLaunchNow: false,
      label: "BLOCKED_BY_UNSAFE_OUTPUT",
      reason: "The launch console or approval command packet contains unsafe output and must not be used.",
    };
  }
  if (actionPlan.status === "READY" && actionPlan.source?.status === "READY") {
    return {
      canLaunchNow: true,
      label: "READY_FOR_GO_LIVE_ARCHIVE",
      reason: "All generated operating gates are READY. Archive the private approval records with the release packet before launch.",
    };
  }
  return {
    canLaunchNow: false,
    label: "EXTERNAL_INPUTS_REQUIRED",
    reason: "The product wiring is reportable, but real approval records, institution keys, signed desktop release evidence, or operating assignments are still missing.",
  };
}

function hardBlocksFromLanes(lanes) {
  return lanes
    .filter((lane) => lane.status !== "READY")
    .map((lane) => ({
      phaseId: lane.phaseId,
      ownerRole: lane.ownerRole,
      status: lane.status,
      openActionCount: lane.openActionCount,
      p0OpenActionCount: lane.p0OpenActionCount,
      firstAction: lane.firstActions[0]?.action || "",
      firstVerificationCommand: lane.firstActions[0]?.verificationCommands?.[0] || "",
    }));
}

function externalApprovalQueue(commandPacket, root) {
  return (commandPacket.commands || [])
    .filter((command) => command.externalApprovalRequired)
    .map((command) => ({
      id: command.id,
      group: command.group,
      ownerRole: command.ownerRole,
      phaseId: command.phaseId,
      command: redactOperationalText(command.command, root),
      evidencePlaceholder: command.evidencePlaceholder,
    }));
}

function verificationCommands(commandPacket, root) {
  return (commandPacket.commands || [])
    .filter((command) => !command.externalApprovalRequired)
    .map((command) => ({
      id: command.id,
      ownerRole: command.ownerRole,
      phaseId: command.phaseId,
      command: redactOperationalText(command.command, root),
    }));
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

async function resolveActionPlan({ root, env, platform, generatedAt, actionPlan, actionPlanPath, noBuild }) {
  if (actionPlanPath) {
    const loaded = readJson(resolveInputPath(root, actionPlanPath));
    assertSchema(loaded, "jium-operational-action-plan-v1", "Operational action plan");
    return loaded;
  }
  if (actionPlan) {
    assertSchema(actionPlan, "jium-operational-action-plan-v1", "Operational action plan");
    return actionPlan;
  }
  if (noBuild) {
    const loaded = readJson(path.join(root, OPERATIONAL_HANDOFF_BUNDLE_DIR, "operational-action-plan.json"));
    assertSchema(loaded, "jium-operational-action-plan-v1", "Operational action plan");
    return loaded;
  }
  const plan = await buildOperationalActionPlan({ root, env, platform, generatedAt });
  writeOperationalActionPlanFiles({ root, plan });
  return plan;
}

async function resolveCommandPacket({ root, generatedAt, commandPacket, commandPacketPath, noBuild }) {
  if (commandPacketPath) {
    const loaded = readJson(resolveInputPath(root, commandPacketPath));
    assertSchema(loaded, "jium-operational-approval-command-packet-v1", "Operational approval command packet");
    return loaded;
  }
  if (commandPacket) {
    assertSchema(commandPacket, "jium-operational-approval-command-packet-v1", "Operational approval command packet");
    return commandPacket;
  }
  if (noBuild) {
    const loaded = readJson(path.join(root, OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR, OPERATIONAL_APPROVAL_COMMAND_PACKET_JSON));
    assertSchema(loaded, "jium-operational-approval-command-packet-v1", "Operational approval command packet");
    return loaded;
  }
  const result = await buildOperationalApprovalCommandPacket({ root, generatedAt });
  return result.report;
}

export async function buildOperationalLaunchConsole({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
  actionPlan,
  actionPlanPath,
  commandPacket,
  commandPacketPath,
  noBuild = false,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedActionPlan = await resolveActionPlan({
    root: resolvedRoot,
    env,
    platform,
    generatedAt,
    actionPlan,
    actionPlanPath,
    noBuild,
  });
  const resolvedCommandPacket = await resolveCommandPacket({
    root: resolvedRoot,
    generatedAt,
    commandPacket,
    commandPacketPath,
    noBuild,
  });

  const ownerLanes = (resolvedActionPlan.phases || []).map((phase) => ownerLaneFromPhase(phase, resolvedRoot));
  const allOpenActions = (resolvedActionPlan.phases || []).flatMap((phase) => (phase.actions || []).filter((action) => action.status !== "DONE"));
  const p0OpenActions = allOpenActions.filter((action) => action.priority === "P0");
  const baseConsole = {
    schema: OPERATIONAL_LAUNCH_CONSOLE_SCHEMA,
    generatedAt,
    status: "PENDING",
    source: {
      actionPlanStatus: resolvedActionPlan.status,
      handoffStatus: resolvedActionPlan.source?.status || "UNKNOWN",
      version: resolvedActionPlan.source?.version || resolvedCommandPacket.version || "",
      commit: resolvedActionPlan.source?.commit || "",
      commandPacketStatus: resolvedCommandPacket.status,
    },
    summary: {
      phaseCount: ownerLanes.length,
      blockedPhaseCount: ownerLanes.filter((lane) => lane.status !== "READY").length,
      readyPhaseCount: ownerLanes.filter((lane) => lane.status === "READY").length,
      openActionCount: allOpenActions.length,
      p0OpenActionCount: p0OpenActions.length,
      externalApprovalCommandCount: resolvedCommandPacket.summary?.externalApprovalCommandCount || 0,
      verificationCommandCount: resolvedCommandPacket.summary?.verificationCommandCount || 0,
      ownerLaneCount: ownerLanes.length,
    },
    ownerLanes,
    externalApprovalQueue: externalApprovalQueue(resolvedCommandPacket, resolvedRoot),
    verificationCommands: verificationCommands(resolvedCommandPacket, resolvedRoot),
    readyEvidence: ownerLanes
      .filter((lane) => lane.status === "READY")
      .map((lane) => ({
        phaseId: lane.phaseId,
        ownerRole: lane.ownerRole,
        gates: lane.gates,
      })),
    nextOperatorRunOrder: ownerLanes
      .filter((lane) => lane.status !== "READY")
      .map((lane, index) => ({
        order: index + 1,
        phaseId: lane.phaseId,
        ownerRole: lane.ownerRole,
        status: lane.status,
        firstAction: lane.firstActions[0]?.action || "",
        verificationCommands: lane.firstActions[0]?.verificationCommands || [],
      })),
    hardBlocks: hardBlocksFromLanes(ownerLanes),
    safetyNotes: [
      "This launch console is a redacted operating board, not a launch approval.",
      "It turns the long action plan into owner lanes and command queues so operators can finish real external approvals faster.",
      "Do not store raw public URLs, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, phone numbers, or private paths in this console.",
      "Use only pseudonymous references and SHA-256 evidence digests in private approval records.",
    ],
  };
  const leakScan = scanForLeaks(baseConsole);
  const launchDecision = buildLaunchDecision(resolvedActionPlan, resolvedCommandPacket, leakScan);
  const consoleReport = {
    ...baseConsole,
    status: leakScan.status === "PASS" && resolvedCommandPacket.status !== "BLOCKED" ? launchDecision.label : "BLOCKED",
    launchDecision,
    leakScan,
    errors: [
      ...leakScan.findings.map((finding) => `launch console contains unsafe ${finding.label}`),
      ...(resolvedCommandPacket.status === "BLOCKED" ? ["approval command packet is blocked"] : []),
    ],
    warnings: resolvedActionPlan.status === "READY" ? [] : ["External approvals or operating inputs are still required before production launch."],
  };

  const reportDir = safePrepareReportDir(resolvedRoot);
  writeJson(path.join(reportDir, OPERATIONAL_LAUNCH_CONSOLE_JSON), consoleReport);
  writeText(path.join(reportDir, OPERATIONAL_LAUNCH_CONSOLE_MARKDOWN), formatOperationalLaunchConsoleMarkdown(consoleReport));

  return {
    valid: consoleReport.status !== "BLOCKED",
    report: consoleReport,
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
  };
}

export function formatOperationalLaunchConsoleMarkdown(report) {
  const lines = [
    "# JiumAI Operational Launch Console",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Launch decision: ${report.launchDecision.label}`,
    `- Can launch now: ${report.launchDecision.canLaunchNow ? "YES" : "NO"}`,
    `- Version: ${report.source.version || "MISSING"}`,
    `- Commit: ${report.source.commit || "MISSING"}`,
    `- Handoff status: ${report.source.handoffStatus}`,
    `- Action plan status: ${report.source.actionPlanStatus}`,
    `- Command packet status: ${report.source.commandPacketStatus}`,
    `- Leak scan: ${report.leakScan.status}`,
    "",
    "## Summary",
    `- Phases: ${report.summary.readyPhaseCount}/${report.summary.phaseCount} ready`,
    `- Open actions: ${report.summary.openActionCount}`,
    `- P0 open actions: ${report.summary.p0OpenActionCount}`,
    `- External approval commands: ${report.summary.externalApprovalCommandCount}`,
    `- Verification commands: ${report.summary.verificationCommandCount}`,
    "",
    "## Owner Lanes",
    ...report.ownerLanes.map(
      (lane) =>
        `- ${lane.status} ${lane.phaseId} (${lane.ownerRole}): ${lane.openActionCount} open / ${lane.p0OpenActionCount} P0`,
    ),
    "",
    "## Hard Blocks",
    ...(report.hardBlocks.length
      ? report.hardBlocks.map(
          (block) =>
            `- ${block.phaseId} (${block.ownerRole}): ${block.p0OpenActionCount} P0, first action: ${block.firstAction || "None"}`,
        )
      : ["- None"]),
    "",
    "## Next Operator Run Order",
    ...(report.nextOperatorRunOrder.length
      ? report.nextOperatorRunOrder.map(
          (entry) =>
            `- ${entry.order}. ${entry.phaseId} (${entry.ownerRole}): ${entry.firstAction || "Review lane"}${
              entry.verificationCommands.length ? `\n  Verify: ${entry.verificationCommands.map((command) => `\`${command}\``).join("; ")}` : ""
            }`,
        )
      : ["- None"]),
    "",
    "## External Approval Queue",
    ...(report.externalApprovalQueue.length
      ? report.externalApprovalQueue.map((entry) => `- ${entry.group}/${entry.id} (${entry.ownerRole}): \`${entry.command}\``)
      : ["- None"]),
    "",
    "## Verification Commands",
    ...(report.verificationCommands.length
      ? report.verificationCommands.map((entry) => `- ${entry.phaseId}/${entry.id} (${entry.ownerRole}): \`${entry.command}\``)
      : ["- None"]),
    "",
    "## Ready Evidence Lanes",
    ...(report.readyEvidence.length
      ? report.readyEvidence.map((entry) => `- ${entry.phaseId} (${entry.ownerRole})`)
      : ["- None"]),
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

export function writeOperationalLaunchConsoleOutput({ root = repoRoot, report, outputPath = "", format = "markdown" } = {}) {
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
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatOperationalLaunchConsoleMarkdown(report),
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
    platform: process.platform,
    actionPlanPath: "",
    commandPacketPath: "",
    noBuild: false,
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
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg === "--action-plan") {
      args.actionPlanPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--action-plan=")) {
      args.actionPlanPath = arg.slice("--action-plan=".length);
    } else if (arg === "--command-packet") {
      args.commandPacketPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--command-packet=")) {
      args.commandPacketPath = arg.slice("--command-packet=".length);
    } else if (arg === "--no-build") {
      args.noBuild = true;
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
    const result = await buildOperationalLaunchConsole({
      root: args.root,
      platform: args.platform,
      actionPlanPath: args.actionPlanPath,
      commandPacketPath: args.commandPacketPath,
      noBuild: args.noBuild,
    });
    writeOperationalLaunchConsoleOutput({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(result.report, null, 2));
    } else {
      console.log(formatOperationalLaunchConsoleMarkdown(result.report));
    }
    console.log(`Operational launch console written: ${args.outputPath || result.reportDirRelative}`);
    if (result.report.status === "BLOCKED") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
