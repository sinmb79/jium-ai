#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const SERVER_ORIGIN_APPROVAL_BUNDLE_DIR = "dist/server-origin-approval";

const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
const PLACEHOLDER_PATTERN = /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL|CHANGE[-_ ]?ME)\b/i;
const CONTACT_OR_INVITE_PATTERN =
  /\b(?:[a-z0-9.-]+\.onion\b|t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite\/)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/i;
const SECRET_PATTERN =
  /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i;

function present(value) {
  return Boolean(String(value || "").trim());
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "").trim()).digest("hex")}`;
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function parseEnvLines(content) {
  const lines = content ? content.replace(/\r\n/g, "\n").split("\n") : [];
  return lines.length ? lines : ["# JiumAI private server runtime env"];
}

function upsertEnvLine(lines, key, value) {
  const lineIndex = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (lineIndex < 0) {
    lines.push(`${key}=${value}`);
    return "ADDED";
  }
  const currentValue = lines[lineIndex].slice(lines[lineIndex].indexOf("=") + 1);
  if (currentValue === value) {
    return "UNCHANGED";
  }
  lines[lineIndex] = `${key}=${value}`;
  return "UPDATED";
}

function normalizeOrigin(value) {
  const text = String(value || "").trim();
  const errors = [];
  if (!text) {
    errors.push("origins contain an empty value");
    return { origin: "", errors };
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    errors.push("origins must not contain placeholders");
  }
  if (CONTACT_OR_INVITE_PATTERN.test(text)) {
    errors.push("origins must not contain invite, onion, or contact values");
  }
  if (SECRET_PATTERN.test(text)) {
    errors.push("origins must not contain secret-like values");
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:") {
      errors.push("origins must use HTTPS");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      errors.push("origins must be origins only, without credentials, query, or fragment");
    }
    if (parsed.pathname && parsed.pathname !== "/") {
      errors.push("origins must be origins only, without path");
    }
    return { origin: parsed.origin, errors };
  } catch {
    errors.push("origins must be valid HTTPS origins");
    return { origin: "", errors };
  }
}

function normalizeOrigins(origins) {
  const rawValues = Array.isArray(origins) ? origins : String(origins || "").split(",");
  const entries = rawValues.flatMap((value) => String(value || "").split(",")).map((value) => value.trim()).filter(Boolean);
  const errors = [];
  const normalized = [];
  for (const entry of entries) {
    const result = normalizeOrigin(entry);
    errors.push(...result.errors);
    if (result.origin) {
      normalized.push(result.origin);
    }
  }
  const uniqueOrigins = Array.from(new Set(normalized));
  if (!uniqueOrigins.length) {
    errors.push("at least one approved HTTPS origin is required");
  }
  return { origins: uniqueOrigins, errors };
}

function validateApprovalRef(approvalRef) {
  const errors = [];
  const normalized = String(approvalRef || "").trim();
  if (!normalized) {
    errors.push("approvalRef is required");
    return { status: "MISSING", digest: "", errors };
  }
  if (PLACEHOLDER_PATTERN.test(normalized)) {
    errors.push("approvalRef contains placeholder");
  }
  if (!SAFE_REF_PATTERN.test(normalized)) {
    errors.push("approvalRef must be a short pseudonymous reference");
  }
  if (/\bhttps?:\/\//i.test(normalized) || CONTACT_OR_INVITE_PATTERN.test(normalized)) {
    errors.push("approvalRef contains raw URL or contact value");
  }
  if (SECRET_PATTERN.test(normalized)) {
    errors.push("approvalRef contains secret-like value");
  }
  return {
    status: errors.length ? "BLOCKED" : "SET_REDACTED",
    digest: errors.length ? "" : sha256Text(normalized),
    errors,
  };
}

function planServerOriginApproval({
  root = repoRoot,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  origins = [],
  approvalRef = "",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedEnvPath = path.resolve(resolvedRoot, envPath);
  const errors = [];
  const warnings = [];
  const originPlan = normalizeOrigins(origins);
  const approval = validateApprovalRef(approvalRef);
  errors.push(...originPlan.errors, ...approval.errors);

  if (!isPathInside(resolvedRoot, resolvedEnvPath)) {
    errors.push("server env path must stay inside the repository");
  }
  if (!existsSync(resolvedEnvPath)) {
    errors.push("server runtime env file missing; run npm run server:env:init first");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    root: resolvedRoot,
    envPath,
    resolvedEnvPath,
    origins: originPlan.origins,
    approval,
    originListDigest: originPlan.origins.length ? sha256Text(originPlan.origins.join(",")) : "",
  };
}

export function validateServerOriginApproval(options = {}) {
  const plan = planServerOriginApproval(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    evidence: {
      approvalRefStatus: plan.approval.status,
      approvalRefDigest: plan.approval.digest,
      originListDigest: plan.originListDigest,
    },
    summary: {
      originCount: plan.origins.length,
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
    },
  };
}

function buildReport(plan, { generatedAt, applied, envUpdateStatus }) {
  return {
    schema: "jium-server-origin-approval-v1",
    generatedAt,
    status: plan.valid && applied ? "APPLIED" : "BLOCKED",
    summary: {
      originCount: plan.origins.length,
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
      envUpdateStatus,
      serverRoutesStatus: plan.valid && applied ? "SET_TRUE" : "BLOCKED",
      secureCookiesStatus: plan.valid && applied ? "SET_TRUE" : "BLOCKED",
    },
    evidence: {
      approvalRefStatus: plan.approval.status,
      approvalRefDigest: plan.approval.digest,
      originListDigest: plan.originListDigest,
    },
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions: plan.valid && applied
      ? [
          "Run npm run security:server-readiness after storage, trusted-key, and server deployment records are prepared.",
          "Record the server-origin-approval onboarding checklist item with a pseudonymous evidence reference.",
        ]
      : ["Resolve server origin approval blockers before writing .env.server.local."],
    safetyNotes: [
      "This report stores origin count, env key update status, and SHA-256 digests only.",
      "The private server env file stores the raw approved origins and must stay ignored and out of public reports.",
      "Do not store raw origins, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets in approval references.",
    ],
  };
}

export async function applyServerOriginApproval({
  root = repoRoot,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  origins = [],
  approvalRef = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const plan = planServerOriginApproval({ root, envPath, origins, approvalRef });
  let applied = false;
  let envUpdateStatus = "SKIPPED";

  if (plan.valid) {
    const lines = parseEnvLines(readFileSync(plan.resolvedEnvPath, "utf8"));
    const updates = [
      upsertEnvLine(lines, "JIUM_SERVER_ROUTES", "true"),
      upsertEnvLine(lines, "INSTITUTION_ALLOWED_ORIGINS", plan.origins.join(",")),
      upsertEnvLine(lines, "INSTITUTION_SECURE_COOKIES", "true"),
    ];
    envUpdateStatus = updates.some((status) => status === "ADDED" || status === "UPDATED") ? "UPDATED" : "UNCHANGED";
    writeText(plan.resolvedEnvPath, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n")}\n`);
    applied = true;
  }

  const report = buildReport(plan, { generatedAt, applied, envUpdateStatus });
  const bundleDir = path.join(plan.root, SERVER_ORIGIN_APPROVAL_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "server-origin-approval-report.json"), report);
  writeText(path.join(bundleDir, "server-origin-approval-report.md"), formatServerOriginApprovalMarkdown(report));

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatServerOriginApprovalMarkdown(report) {
  const lines = [
    "# JiumAI Server Origin Approval",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Origin count: ${report.summary.originCount}`,
    `- Env path: ${report.summary.envPath}`,
    `- Env update: ${report.summary.envUpdateStatus}`,
    `- Server routes: ${report.summary.serverRoutesStatus}`,
    `- Secure cookies: ${report.summary.secureCookiesStatus}`,
    `- Approval ref: ${report.evidence.approvalRefStatus}`,
    `- Approval ref digest: ${report.evidence.approvalRefDigest || "MISSING"}`,
    `- Origin list digest: ${report.evidence.originListDigest || "MISSING"}`,
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
    origins: [],
    approvalRef: "",
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
    } else if (arg === "--origin") {
      args.origins.push(argv[index + 1] || "");
      index += 1;
    } else if (arg.startsWith("--origin=")) {
      args.origins.push(arg.slice("--origin=".length));
    } else if (arg === "--origins") {
      args.origins.push(argv[index + 1] || "");
      index += 1;
    } else if (arg.startsWith("--origins=")) {
      args.origins.push(arg.slice("--origins=".length));
    } else if (arg === "--approval-ref") {
      args.approvalRef = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--approval-ref=")) {
      args.approvalRef = arg.slice("--approval-ref=".length);
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
    const result = await applyServerOriginApproval({
      root: args.root,
      envPath: args.envPath,
      origins: args.origins,
      approvalRef: args.approvalRef,
    });
    const content = args.format === "json" ? JSON.stringify(result.report, null, 2) : formatServerOriginApprovalMarkdown(result.report);

    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Server origin approval report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Server origin approval report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
