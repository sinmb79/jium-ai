#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";
import {
  HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY,
  validateHostedSecurityHeaderAuditEvidence,
} from "./hosted-security-header-audit-evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const HOSTED_SECURITY_HEADER_AUDIT_ENV_APPLY_BUNDLE_DIR = "dist/hosted-security-header-audit-env";

function clean(value) {
  return String(value || "").trim();
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function parseEnvLines(content) {
  const normalized = String(content || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return normalized ? normalized.split("\n") : ["# JiumAI private server runtime env"];
}

function upsertEnvLine(lines, key, value) {
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (index < 0) {
    lines.push(`${key}=${value}`);
    return "ADDED";
  }
  const current = lines[index].slice(lines[index].indexOf("=") + 1);
  if (current === value) {
    return "UNCHANGED";
  }
  lines[index] = `${key}=${value}`;
  return "UPDATED";
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function resolveAuditReportPath(root, auditReport) {
  const value = clean(auditReport);
  if (!value) {
    return "";
  }
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
}

function planHostedSecurityHeaderAuditEnvApply({
  root = repoRoot,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  auditReport = "",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedEnvPath = path.resolve(resolvedRoot, envPath);
  const resolvedAuditReport = resolveAuditReportPath(resolvedRoot, auditReport);
  const errors = [];

  if (!resolvedAuditReport) {
    errors.push("hosted security header audit report path is required");
  } else if (!isPathInside(resolvedRoot, resolvedAuditReport)) {
    errors.push("hosted security header audit report path must stay inside the repository");
  }
  if (!isPathInside(resolvedRoot, resolvedEnvPath)) {
    errors.push("hosted security header audit env path must stay inside the repository");
  }
  if (!existsSync(resolvedEnvPath)) {
    errors.push("server runtime env file missing; run npm run server:env:init first");
  }

  const auditReportRelative = resolvedAuditReport && isPathInside(resolvedRoot, resolvedAuditReport) ? relativePath(resolvedRoot, resolvedAuditReport) : "";
  const evidence =
    auditReportRelative && !errors.some((error) => error.includes("audit report path"))
      ? validateHostedSecurityHeaderAuditEvidence({
          root: resolvedRoot,
          env: { [HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY]: auditReportRelative },
        })
      : {
          valid: false,
          errors: [],
          sourceSummary: {
            [HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY]: "MISSING",
            fileStatus: "MISSING",
            schema: "",
            status: "MISSING",
            targetUrlState: "",
            fetchState: "",
            httpStatus: null,
            checkedHeaderCount: 0,
            passCount: 0,
            failureCount: 0,
          },
        };

  errors.push(...evidence.errors);

  const auditReportDigest = existsSync(resolvedAuditReport) && isPathInside(resolvedRoot, resolvedAuditReport)
    ? sha256Text(readFileSync(resolvedAuditReport, "utf8").replace(/^\uFEFF/, ""))
    : "";

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    root: resolvedRoot,
    envPath,
    resolvedEnvPath,
    auditReportRelative,
    evidence,
    reportEvidence: {
      auditReportPathStatus: auditReportRelative ? "SET_REDACTED" : "MISSING",
      auditReportDigest,
      auditStatus: evidence.sourceSummary.status,
      targetUrlState: evidence.sourceSummary.targetUrlState,
      fetchState: evidence.sourceSummary.fetchState,
      failureCount: evidence.sourceSummary.failureCount,
    },
  };
}

export function validateHostedSecurityHeaderAuditApply(options = {}) {
  const plan = planHostedSecurityHeaderAuditEnvApply(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    evidence: { ...plan.reportEvidence },
    summary: {
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
      auditReportPathStatus: plan.reportEvidence.auditReportPathStatus,
      auditStatus: plan.reportEvidence.auditStatus,
      targetUrlState: plan.reportEvidence.targetUrlState,
      fetchState: plan.reportEvidence.fetchState,
      failureCount: plan.reportEvidence.failureCount,
    },
  };
}

function buildReport(plan, { generatedAt, applied, envUpdateStatus }) {
  return {
    schema: "jium-hosted-security-header-audit-env-apply-v1",
    generatedAt,
    status: plan.valid && applied ? "APPLIED" : "BLOCKED",
    summary: {
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
      envUpdateStatus,
      auditReportPathStatus: plan.reportEvidence.auditReportPathStatus,
      auditStatus: plan.reportEvidence.auditStatus,
      targetUrlState: plan.reportEvidence.targetUrlState,
      fetchState: plan.reportEvidence.fetchState,
      failureCount: plan.reportEvidence.failureCount,
    },
    evidence: { ...plan.reportEvidence },
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions:
      plan.valid && applied
        ? [
            "Run npm run ops:onboarding:check so production onboarding can consume the READY hosted security header audit evidence.",
            "Run npm run ops:go-live:check after public routes, approval records, server, and desktop gates are ready.",
          ]
        : ["Resolve hosted security header audit evidence blockers before writing the private env pointer."],
    safetyNotes: [
      "This report stores readiness states, failure counts, and SHA-256 digest values only.",
      "The private env file stores the relative audit report path and must stay ignored.",
      "Do not store raw target URLs, hosts, paths, contacts, victim indicators, invite links, onion addresses, emails, phone numbers, tokens, passwords, or certificate material in this report.",
    ],
  };
}

export async function applyHostedSecurityHeaderAuditEnv({
  root = repoRoot,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  auditReport = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const plan = planHostedSecurityHeaderAuditEnvApply({ root, envPath, auditReport });
  let applied = false;
  let envUpdateStatus = "SKIPPED";

  if (plan.valid) {
    const lines = parseEnvLines(readFileSync(plan.resolvedEnvPath, "utf8"));
    const update = upsertEnvLine(lines, HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY, plan.auditReportRelative);
    envUpdateStatus = update === "ADDED" || update === "UPDATED" ? "UPDATED" : "UNCHANGED";
    writeText(plan.resolvedEnvPath, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n")}\n`);
    applied = true;
  }

  const report = buildReport(plan, { generatedAt, applied, envUpdateStatus });
  const bundleDir = path.join(plan.root, HOSTED_SECURITY_HEADER_AUDIT_ENV_APPLY_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "hosted-security-header-audit-env-apply-report.json"), report);
  writeText(path.join(bundleDir, "hosted-security-header-audit-env-apply-report.md"), formatHostedSecurityHeaderAuditApplyMarkdown(report));

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatHostedSecurityHeaderAuditApplyMarkdown(report) {
  const lines = [
    "# JiumAI Hosted Security Header Audit Env Apply",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Env path: ${report.summary.envPath}`,
    `- Env update: ${report.summary.envUpdateStatus}`,
    `- Audit report path: ${report.summary.auditReportPathStatus}`,
    `- Audit status: ${report.summary.auditStatus}`,
    `- Target URL state: ${report.summary.targetUrlState || "MISSING"}`,
    `- Fetch state: ${report.summary.fetchState || "MISSING"}`,
    `- Header failures: ${report.summary.failureCount}`,
    `- Audit report digest: ${report.evidence.auditReportDigest || "MISSING"}`,
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
    root: repoRoot,
    envPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
    auditReport: "",
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
    } else if (arg === "--env") {
      args.envPath = argv[index + 1] || args.envPath;
      index += 1;
    } else if (arg.startsWith("--env=")) {
      args.envPath = arg.slice("--env=".length);
    } else if (arg === "--audit-report") {
      args.auditReport = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--audit-report=")) {
      args.auditReport = arg.slice("--audit-report=".length);
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
    if (args.outputPath) {
      const resolvedOutput = path.resolve(args.root, args.outputPath);
      if (!isPathInside(args.root, resolvedOutput)) {
        throw new Error("output path must stay inside the repository");
      }
    }
    const result = await applyHostedSecurityHeaderAuditEnv({
      root: args.root,
      envPath: args.envPath,
      auditReport: args.auditReport,
    });
    const content = args.format === "json" ? JSON.stringify(result.report, null, 2) : formatHostedSecurityHeaderAuditApplyMarkdown(result.report);

    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Hosted security header audit env apply report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Hosted security header audit env apply report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
