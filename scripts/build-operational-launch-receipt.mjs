#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATIONAL_LAUNCH_COMMAND_PACKET_SCHEMA,
  OPERATIONAL_LAUNCH_PRIVATE_COMMAND_PACKET_DIR,
  OPERATIONAL_LAUNCH_PRIVATE_COMMAND_PACKET_JSON,
} from "./build-operational-launch-inputs.mjs";
import {
  OPERATIONAL_LAUNCH_APPLY_READINESS_SCHEMA,
  buildOperationalLaunchApplyReadiness,
} from "./check-operational-launch-apply-readiness.mjs";
import {
  buildOperationalGoLiveReport,
  validateOperationalGoLive,
} from "./check-operational-go-live.mjs";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_LAUNCH_RECEIPT_SCHEMA = "jium-operational-launch-receipt-v1";
export const OPERATIONAL_LAUNCH_RECEIPT_DIR = "dist/operational-launch-receipt";
export const OPERATIONAL_LAUNCH_RECEIPT_JSON = "operational-launch-receipt.json";
export const OPERATIONAL_LAUNCH_RECEIPT_MARKDOWN = "operational-launch-receipt.md";

const DEFAULT_COMMAND_PACKET_PATH = path.join(
  OPERATIONAL_LAUNCH_PRIVATE_COMMAND_PACKET_DIR,
  OPERATIONAL_LAUNCH_PRIVATE_COMMAND_PACKET_JSON,
).replace(/\\/g, "/");

const EXPECTED_COMMAND_IDS = [
  "public-operations-env",
  "hosted-security-header-audit",
  "server-storage",
  "server-origin",
  "trusted-key-review",
  "trusted-key-apply",
  "desktop-release-env",
  "desktop-update-feed-check",
  "desktop-release-evidence-digest",
  "desktop-publish-check",
  "approval-inputs-apply",
  "go-live-env-apply",
  "go-live-check",
];

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

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
  } catch {
    return "";
  }
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

function resolveInsideRepo(root, target, label) {
  const resolved = path.resolve(root, target || "");
  if (!isPathInside(root, resolved)) {
    throw new Error(`${label} path must stay inside the repository`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = path.resolve(root, OPERATIONAL_LAUNCH_RECEIPT_DIR);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== OPERATIONAL_LAUNCH_RECEIPT_DIR) {
    throw new Error(`Refusing to clean unsafe operational launch receipt directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function redactText(value, root) {
  return String(value || "")
    .replaceAll(path.resolve(root), "<repo-root>")
    .replace(/https?:\/\/[^\s")]+/gi, "<redacted-url>")
    .replace(/\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/gi, "<redacted-invite>")
    .replace(/\b[a-z2-7]{16,56}\.onion\b/gi, "<redacted-onion>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>")
    .replace(/\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/gi, "<redacted-token>")
    .replace(/\b(?:(?:\+82[\s.-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4})\b/g, "<redacted-phone>")
    .replace(/(?:[A-Za-z]:\\|\/(?:Users|home|var|etc|tmp|mnt|opt)\/)[^\s")]+/gi, "<redacted-path>");
}

function scanReportForLeaks(value) {
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

function commandStatus(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object") {
    errors.push("private command packet must be a JSON object");
    return { status: "BLOCKED", errors };
  }
  if (packet.schema !== OPERATIONAL_LAUNCH_COMMAND_PACKET_SCHEMA) {
    errors.push(`private command packet schema must be ${OPERATIONAL_LAUNCH_COMMAND_PACKET_SCHEMA}`);
  }
  if (!Array.isArray(packet.commands)) {
    errors.push("private command packet commands must be an array");
  }
  const commandIds = Array.isArray(packet.commands) ? packet.commands.map((command) => command?.id).filter(Boolean) : [];
  const missing = EXPECTED_COMMAND_IDS.filter((id) => !commandIds.includes(id));
  const unexpected = commandIds.filter((id) => !EXPECTED_COMMAND_IDS.includes(id));
  if (missing.length) errors.push(`private command packet is missing expected commands: ${missing.join(", ")}`);
  if (unexpected.length) errors.push(`private command packet contains unexpected commands: ${unexpected.join(", ")}`);
  if (packet.commandCount !== EXPECTED_COMMAND_IDS.length || commandIds.length !== EXPECTED_COMMAND_IDS.length) {
    errors.push(`private command packet command count must be ${EXPECTED_COMMAND_IDS.length}`);
  }
  return {
    status: errors.length ? "BLOCKED" : "READY",
    errors,
  };
}

function inspectPrivateCommandPacket({ root, commandPacketPath }) {
  const privateRoot = path.resolve(root, "ops/private");
  let resolved = path.resolve(root, commandPacketPath || DEFAULT_COMMAND_PACKET_PATH);
  const errors = [];
  if (!isPathInside(root, resolved)) {
    return {
      status: "BLOCKED",
      pathStatus: "OUTSIDE_REPOSITORY",
      path: "[REDACTED_OUTSIDE_REPOSITORY]",
      errors: ["private command packet path must stay inside the repository"],
      commandCount: 0,
      commandPacketDigest: "",
      inputDigest: "",
      commands: [],
    };
  }
  if (!isPathInside(privateRoot, resolved)) {
    errors.push("private command packet path must stay under ops/private");
  }
  const relative = relativePath(root, resolved);
  if (!existsSync(resolved)) {
    return {
      status: "BLOCKED",
      pathStatus: errors.length ? "INVALID_PRIVATE_PATH" : "MISSING",
      path: relative,
      errors: [...errors, "private command packet is missing"],
      commandCount: 0,
      commandPacketDigest: "",
      inputDigest: "",
      commands: [],
    };
  }
  let packet;
  try {
    packet = readJson(resolved);
  } catch (error) {
    return {
      status: "BLOCKED",
      pathStatus: errors.length ? "INVALID_PRIVATE_PATH" : "PRESENT",
      path: relative,
      errors: [...errors, `private command packet JSON is invalid: ${redactText(error instanceof Error ? error.message : String(error), root)}`],
      commandCount: 0,
      commandPacketDigest: "",
      inputDigest: "",
      commands: [],
    };
  }
  const validation = commandStatus(packet);
  const allErrors = [...errors, ...validation.errors];
  return {
    status: allErrors.length ? "BLOCKED" : "READY",
    pathStatus: errors.length ? "INVALID_PRIVATE_PATH" : "PRESENT",
    path: relative,
    errors: allErrors,
    commandCount: Array.isArray(packet.commands) ? packet.commands.length : 0,
    commandPacketDigest: sha256Text(JSON.stringify(packet)),
    inputDigest: typeof packet.inputDigest === "string" ? packet.inputDigest : "",
    commands: (Array.isArray(packet.commands) ? packet.commands : []).map((command) => ({
      id: command.id || "UNKNOWN",
      description: redactText(command.description || "", root),
      commandDigest: sha256Text(command.command || ""),
      status: EXPECTED_COMMAND_IDS.includes(command.id) ? "EXPECTED" : "UNEXPECTED",
    })),
  };
}

function blockedApplyPhases(applyReadiness, root) {
  return (applyReadiness.phases || [])
    .filter((phase) => phase.status === "BLOCKED")
    .map((phase) => ({
      id: phase.id,
      title: redactText(phase.title || phase.id, root),
      errorCount: phase.errorCount,
      errors: (phase.errors || []).slice(0, 5).map((error) => redactText(error, root)),
    }));
}

function blockedGoLiveChecks(goLiveReport, root) {
  return (goLiveReport.checks || [])
    .filter((check) => check.status !== "PASS")
    .map((check) => ({
      id: check.id,
      label: redactText(check.label || check.id, root),
      status: check.status,
    }));
}

function firstGoLiveErrors(goLiveReport, root) {
  const errors = (goLiveReport.errors || []).map((error) => redactText(error, root));
  return {
    errorCount: errors.length,
    shownErrors: errors.slice(0, 25),
    truncated: errors.length > 25,
  };
}

function buildNextActions({ commandPacket, digestMatch, applyReadiness, goLiveReport }) {
  const actions = [];
  if (commandPacket.status !== "READY") {
    actions.push("Regenerate the private command packet with npm run ops:launch-inputs:commands after launch input review passes.");
  }
  if (digestMatch !== "MATCH") {
    actions.push("Use the same private launch input file that generated the private command packet, then rebuild this receipt.");
  }
  if (applyReadiness.status === "BLOCKED") {
    actions.push("Resolve blocked apply-readiness phases before treating private command execution as launch-ready.");
  }
  if (goLiveReport.status === "BLOCKED") {
    actions.push("Run npm run ops:go-live:check and resolve external approval, signing, key, onboarding, or publish blockers.");
  }
  if (!actions.length) {
    actions.push("Archive this receipt with the private approval records, release dossier, handoff bundle, signed release evidence, and final go-live approval.");
  }
  return actions;
}

export async function buildOperationalLaunchReceipt({
  root = repoRoot,
  inputPath = "",
  commandPacketPath = DEFAULT_COMMAND_PACKET_PATH,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  if (!inputPath) {
    throw new Error("launch receipt --input is required");
  }
  const resolvedInput = resolveInsideRepo(resolvedRoot, inputPath, "input");
  if (!existsSync(resolvedInput)) {
    throw new Error("launch input file is missing");
  }
  const commandPacket = inspectPrivateCommandPacket({ root: resolvedRoot, commandPacketPath });
  const applyReadiness = await buildOperationalLaunchApplyReadiness({
    root: resolvedRoot,
    inputPath,
    envPath,
    platform,
    generatedAt,
    now,
  });
  const goLiveReadiness = await validateOperationalGoLive({ root: resolvedRoot, platform });
  const goLiveReport = buildOperationalGoLiveReport(goLiveReadiness, { generatedAt });
  const digestMatch =
    commandPacket.inputDigest && applyReadiness.summary?.inputDigest && commandPacket.inputDigest === applyReadiness.summary.inputDigest
      ? "MATCH"
      : "MISMATCH_OR_MISSING";
  const goLiveErrors = firstGoLiveErrors(goLiveReport, resolvedRoot);
  const baseReport = {
    schema: OPERATIONAL_LAUNCH_RECEIPT_SCHEMA,
    generatedAt,
    status: "BLOCKED",
    version: readPackageVersion(resolvedRoot),
    source: {
      inputPath: relativePath(resolvedRoot, resolvedInput),
      commandPacketPath: commandPacket.path,
      envPath,
      commandPacketSchema: commandPacket.status === "READY" ? OPERATIONAL_LAUNCH_COMMAND_PACKET_SCHEMA : "INVALID_OR_MISSING",
      applyReadinessSchema: applyReadiness.schema === OPERATIONAL_LAUNCH_APPLY_READINESS_SCHEMA ? OPERATIONAL_LAUNCH_APPLY_READINESS_SCHEMA : "INVALID_OR_MISSING",
    },
    summary: {
      commandPacketStatus: commandPacket.status,
      commandPacketPathStatus: commandPacket.pathStatus,
      commandCount: commandPacket.commandCount,
      expectedCommandCount: EXPECTED_COMMAND_IDS.length,
      commandPacketDigest: commandPacket.commandPacketDigest,
      inputDigest: applyReadiness.summary?.inputDigest || "",
      commandPacketInputDigest: commandPacket.inputDigest,
      inputDigestMatch: digestMatch,
      applyReadinessStatus: applyReadiness.status,
      applyReadyPhaseCount: applyReadiness.summary?.readyPhaseCount || 0,
      applyBlockedPhaseCount: applyReadiness.summary?.blockedPhaseCount || 0,
      goLiveStatus: goLiveReport.status,
      goLiveErrorCount: goLiveReport.summary?.errorCount || 0,
      goLivePassCheckCount: (goLiveReport.checks || []).filter((check) => check.status === "PASS").length,
      goLiveBlockedCheckCount: (goLiveReport.checks || []).filter((check) => check.status !== "PASS").length,
    },
    commands: commandPacket.commands,
    blockers: {
      commandPacketErrors: commandPacket.errors.map((error) => redactText(error, resolvedRoot)),
      applyReadinessBlockedPhases: blockedApplyPhases(applyReadiness, resolvedRoot),
      goLiveBlockedChecks: blockedGoLiveChecks(goLiveReport, resolvedRoot),
      goLiveErrors,
    },
    nextActions: [],
    safetyNotes: [
      "This receipt proves command-packet/input digest alignment and current launch gate status; it does not approve production launch.",
      "The report stores statuses, counts, command digests, input digests, and redacted blocker summaries only.",
      "It does not store raw public URLs, support contacts, incident owner names, storage paths, feed paths, command text, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "Keep the private command packet and launch input file under ignored, access-controlled private storage.",
    ],
  };
  const ready =
    commandPacket.status === "READY" &&
    digestMatch === "MATCH" &&
    applyReadiness.status !== "BLOCKED" &&
    goLiveReport.status === "READY";
  const withDecision = {
    ...baseReport,
    status: ready ? "READY_FOR_LAUNCH_ARCHIVE" : "BLOCKED",
    decision: ready ? "ARCHIVE_WITH_PRIVATE_GO_LIVE_RECORDS" : "REMAIN_BLOCKED",
    nextActions: buildNextActions({ commandPacket, digestMatch, applyReadiness, goLiveReport }),
  };
  const leakScan = scanReportForLeaks(withDecision);
  return {
    ...withDecision,
    status: leakScan.status === "PASS" ? withDecision.status : "BLOCKED",
    leakScan,
    errors: leakScan.findings.map((finding) => `launch receipt contains unsafe ${finding.label}`),
  };
}

export function writeOperationalLaunchReceiptFiles({
  root = repoRoot,
  receipt,
  outputPath = "",
  format = "markdown",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const jsonPath = path.join(reportDir, OPERATIONAL_LAUNCH_RECEIPT_JSON);
  const markdownPath = path.join(reportDir, OPERATIONAL_LAUNCH_RECEIPT_MARKDOWN);
  writeJson(jsonPath, receipt);
  writeText(markdownPath, formatOperationalLaunchReceiptMarkdown(receipt));
  if (outputPath) {
    const resolvedOutput = resolveInsideRepo(resolvedRoot, outputPath, "output");
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(receipt, null, 2)}\n` : formatOperationalLaunchReceiptMarkdown(receipt),
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

export function formatOperationalLaunchReceiptMarkdown(receipt) {
  const lines = [
    "# JiumAI Operational Launch Receipt",
    "",
    `- Generated at: ${receipt.generatedAt}`,
    `- Status: ${receipt.status}`,
    `- Version: ${receipt.version || "MISSING"}`,
    `- Decision: ${receipt.decision}`,
    `- Command packet: ${receipt.summary.commandPacketStatus}`,
    `- Commands: ${receipt.summary.commandCount}/${receipt.summary.expectedCommandCount}`,
    `- Input digest match: ${receipt.summary.inputDigestMatch}`,
    `- Apply readiness: ${receipt.summary.applyReadinessStatus}`,
    `- Apply blocked phases: ${receipt.summary.applyBlockedPhaseCount}`,
    `- Go-live status: ${receipt.summary.goLiveStatus}`,
    `- Go-live blocked checks: ${receipt.summary.goLiveBlockedCheckCount}`,
    `- Go-live errors: ${receipt.summary.goLiveErrorCount}`,
    `- Leak scan: ${receipt.leakScan.status}`,
    "",
    "## Commands",
    ...(receipt.commands.length
      ? receipt.commands.map((command) => `- ${command.status} ${command.id}: ${command.commandDigest}`)
      : ["- None"]),
    "",
    "## Apply Readiness Blockers",
    ...(receipt.blockers.applyReadinessBlockedPhases.length
      ? receipt.blockers.applyReadinessBlockedPhases.map((phase) => `- ${phase.id}: ${phase.errorCount} error(s)`)
      : ["- None"]),
    "",
    "## Go-Live Blocked Checks",
    ...(receipt.blockers.goLiveBlockedChecks.length
      ? receipt.blockers.goLiveBlockedChecks.map((check) => `- ${check.status} ${check.id}: ${check.label}`)
      : ["- None"]),
    "",
    "## Go-Live Errors",
    ...(receipt.blockers.goLiveErrors.shownErrors.length
      ? receipt.blockers.goLiveErrors.shownErrors.map((error) => `- ${error}`)
      : ["- None"]),
    ...(receipt.blockers.goLiveErrors.truncated ? ["- Additional errors truncated in this receipt; run npm run ops:go-live:check for the full redacted report."] : []),
    "",
    "## Next Actions",
    ...receipt.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...receipt.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    inputPath: "",
    commandPacketPath: DEFAULT_COMMAND_PACKET_PATH,
    envPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
    outputPath: "",
    platform: process.platform,
    format: "text",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--input") {
      args.inputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--input=")) {
      args.inputPath = arg.slice("--input=".length);
    } else if (arg === "--command-packet") {
      args.commandPacketPath = argv[index + 1] || args.commandPacketPath;
      index += 1;
    } else if (arg.startsWith("--command-packet=")) {
      args.commandPacketPath = arg.slice("--command-packet=".length);
    } else if (arg === "--env") {
      args.envPath = argv[index + 1] || args.envPath;
      index += 1;
    } else if (arg.startsWith("--env=")) {
      args.envPath = arg.slice("--env=".length);
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
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    if (args.outputPath) {
      resolveInsideRepo(args.root, args.outputPath, "output");
    }
    const receipt = await buildOperationalLaunchReceipt({
      root: args.root,
      inputPath: args.inputPath,
      commandPacketPath: args.commandPacketPath,
      envPath: args.envPath,
      platform: args.platform,
    });
    const written = writeOperationalLaunchReceiptFiles({
      root: args.root,
      receipt,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(receipt, null, 2));
    } else {
      console.log(formatOperationalLaunchReceiptMarkdown(receipt));
    }
    console.log(`Operational launch receipt written: ${args.outputPath || written.reportDirRelative}`);
    if (receipt.status === "BLOCKED") {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
