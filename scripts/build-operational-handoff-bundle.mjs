#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDesktopPublishReadinessReport,
  formatDesktopPublishReadinessMarkdown,
  validateDesktopPublishReadiness,
} from "./check-desktop-publish-readiness.mjs";
import {
  buildOperationalGoLiveReport,
  formatOperationalGoLiveMarkdown,
  validateOperationalGoLive,
} from "./check-operational-go-live.mjs";
import {
  buildOperationalApprovalRecordsReport,
  formatOperationalApprovalRecordsMarkdown,
  validateOperationalApprovalRecords,
} from "./check-operational-approval-records.mjs";
import {
  buildServerRuntimeReadinessReport,
  formatServerRuntimeReadinessMarkdown,
  validateServerRuntimeReadiness,
} from "./check-server-readiness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
export const OPERATIONAL_HANDOFF_BUNDLE_DIR = "dist/operational-handoff-bundle";

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePrepareBundleDir(root, bundleDir) {
  const resolved = path.resolve(root, bundleDir);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== OPERATIONAL_HANDOFF_BUNDLE_DIR) {
    throw new Error(`Refusing to clean unsafe operational handoff bundle directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function currentGitCommit(root, env = process.env) {
  if (env.GITHUB_SHA) {
    return env.GITHUB_SHA;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  writeFileSync(filePath, value, "utf8");
}

function uniqueActions(...actionLists) {
  return Array.from(new Set(actionLists.flat().filter(Boolean)));
}

function buildRunbookMarkdown(summary) {
  const lines = [
    "# JiumAI Operational Handoff Runbook",
    "",
    `- Generated at: ${summary.generatedAt}`,
    `- Status: ${summary.status}`,
    `- Version: ${summary.version || "MISSING"}`,
    `- Commit: ${summary.commit || "MISSING"}`,
    "",
    "## Required Review Files",
    ...Object.entries(summary.reports).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Gates",
    ...summary.gates.map((gate) => `- ${gate.status} ${gate.id}: ${gate.errorCount} error(s)`),
    "",
    "## External Records Needed",
    ...summary.externalRecordsNeeded.map((record) => `- ${record}`),
    "",
    "## Next Actions",
    ...summary.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...summary.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export async function buildOperationalHandoffBundle({
  root = repoRoot,
  env = process.env,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
  validations,
} = {}) {
  const bundleDir = safePrepareBundleDir(root, OPERATIONAL_HANDOFF_BUNDLE_DIR);
  const serverRuntime = validations?.serverRuntime || validateServerRuntimeReadiness({ root, env });
  const desktopPublish =
    validations?.desktopPublish ||
    (await validateDesktopPublishReadiness({ root, env, platform, feedDir: path.join(root, "dist", "desktop") }));
  const approvalRecords =
    validations?.approvalRecords || validations?.goLive?.approvalRecords || validateOperationalApprovalRecords({ root, env });
  const goLive =
    validations?.goLive ||
    (await validateOperationalGoLive({
      root,
      env,
      platform,
      validations: { serverRuntime, desktopPublish, approvalRecords },
    }));

  const serverReport = buildServerRuntimeReadinessReport(serverRuntime, { generatedAt });
  const desktopReport = buildDesktopPublishReadinessReport(desktopPublish, { generatedAt });
  const approvalRecordsReport = buildOperationalApprovalRecordsReport(approvalRecords, { generatedAt });
  const goLiveReport = buildOperationalGoLiveReport(goLive, { generatedAt });

  const summary = {
    schema: "jium-operational-handoff-bundle-v1",
    generatedAt,
    status: [serverReport.status, desktopReport.status, approvalRecordsReport.status, goLiveReport.status].every((status) => status === "READY")
      ? "READY"
      : "BLOCKED",
    version: readPackageVersion(root),
    commit: currentGitCommit(root, env),
    platform,
    gates: [
      { id: "server-runtime-readiness", status: serverReport.status, errorCount: serverReport.errors.length },
      { id: "desktop-publish-readiness", status: desktopReport.status, errorCount: desktopReport.errors.length },
      { id: "operational-approval-records", status: approvalRecordsReport.status, errorCount: approvalRecordsReport.errors.length },
      { id: "operational-go-live", status: goLiveReport.status, errorCount: goLiveReport.errors.length },
    ],
    reports: {
      serverRuntimeJson: "server-runtime-readiness-report.json",
      serverRuntimeMarkdown: "server-runtime-readiness-report.md",
      desktopPublishJson: "desktop-publish-readiness-report.json",
      desktopPublishMarkdown: "desktop-publish-readiness-report.md",
      approvalRecordsJson: "operational-approval-records-report.json",
      approvalRecordsMarkdown: "operational-approval-records-report.md",
      goLiveJson: "operational-go-live-report.json",
      goLiveMarkdown: "operational-go-live-report.md",
      runbookMarkdown: "operational-handoff-runbook.md",
    },
    externalRecordsNeeded: [
      "Approved institution public key registry and approval record",
      "Server-only institution session secret and trusted origin deployment record",
      "Access-controlled audit ledger and account registry storage decision",
      "Signed desktop installer, blockmap, and update metadata from the same build",
      "GitHub Release publish approval and asset review record",
      "Private operational approval records packet for legal, data retention, support route, incident-response, release evidence, and go-live approval",
    ],
    nextActions: uniqueActions(serverReport.nextActions, desktopReport.nextActions, approvalRecordsReport.nextActions, goLiveReport.nextActions),
    safetyNotes: [
      "This bundle is an operational handoff packet, not proof that human approval is complete.",
      "Reports store approval states, counts, release tags, package versions, relative artifact names, and setting presence only.",
      "Do not add public URL values, support contact details, incident owner names, secrets, tokens, certificate material, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers to this bundle.",
    ],
  };

  writeJson(path.join(bundleDir, "server-runtime-readiness-report.json"), serverReport);
  writeText(path.join(bundleDir, "server-runtime-readiness-report.md"), formatServerRuntimeReadinessMarkdown(serverReport));
  writeJson(path.join(bundleDir, "desktop-publish-readiness-report.json"), desktopReport);
  writeText(path.join(bundleDir, "desktop-publish-readiness-report.md"), formatDesktopPublishReadinessMarkdown(desktopReport));
  writeJson(path.join(bundleDir, "operational-approval-records-report.json"), approvalRecordsReport);
  writeText(path.join(bundleDir, "operational-approval-records-report.md"), formatOperationalApprovalRecordsMarkdown(approvalRecordsReport));
  writeJson(path.join(bundleDir, "operational-go-live-report.json"), goLiveReport);
  writeText(path.join(bundleDir, "operational-go-live-report.md"), formatOperationalGoLiveMarkdown(goLiveReport));
  writeJson(path.join(bundleDir, "operational-handoff-summary.json"), summary);
  writeText(path.join(bundleDir, "operational-handoff-summary.md"), buildRunbookMarkdown(summary));
  writeText(path.join(bundleDir, "operational-handoff-runbook.md"), buildRunbookMarkdown(summary));

  return {
    valid: summary.status === "READY",
    bundleDir,
    bundleDirRelative: relativePath(root, bundleDir),
    summary,
  };
}

function parseCliArgs(argv) {
  const args = { format: "text", platform: process.platform };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const result = await buildOperationalHandoffBundle({ platform: args.platform });
    if (args.format === "json") {
      console.log(JSON.stringify(result.summary, null, 2));
    } else if (args.format === "markdown") {
      console.log(buildRunbookMarkdown(result.summary));
    } else {
      console.log(buildRunbookMarkdown(result.summary));
      console.log(`Operational handoff bundle written: ${result.bundleDirRelative}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
