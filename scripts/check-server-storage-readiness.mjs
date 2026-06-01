#!/usr/bin/env node
import { mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const REQUIRED_SERVER_STORAGE_ENV_KEYS = [
  "INSTITUTION_AUDIT_LEDGER_DIR",
  "INSTITUTION_ACCOUNT_REGISTRY_DIR",
];

const FORBIDDEN_REPO_STORAGE_DIRS = ["public", "out", "dist", ".next", "app", "server-route-templates", "data"];

function clean(value) {
  return String(value || "").trim();
}

function hasPlaceholder(value) {
  return /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|CHANGE[-_ ]?ME)\b/i.test(value);
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeRealpath(target) {
  try {
    return realpathSync.native(target);
  } catch {
    return path.resolve(target);
  }
}

function writableDirectoryStatus(target) {
  try {
    try {
      if (!statSync(target).isDirectory()) {
        return "NOT_DIRECTORY";
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        return "NOT_WRITABLE";
      }
      mkdirSync(target, { recursive: true });
    }
    if (!statSync(target).isDirectory()) {
      return "NOT_DIRECTORY";
    }
    const probePath = path.join(target, `.jium-storage-readiness-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
    try {
      writeFileSync(probePath, "jium-storage-readiness\n", { encoding: "utf8", flag: "wx" });
    } finally {
      rmSync(probePath, { force: true });
    }
    return "WRITABLE";
  } catch {
    return "NOT_WRITABLE";
  }
}

function validateStorageTarget({ envKey, value, rootRealpath, root, writeProbe }) {
  const errors = [];
  const configuredValue = clean(value);
  const target = {
    envKey,
    configured: Boolean(configuredValue),
    status: "BLOCKED",
    checks: {
      present: configuredValue ? "PASS" : "BLOCKED",
      noPlaceholder: "BLOCKED",
      absolutePath: "BLOCKED",
      outsideRepository: "BLOCKED",
      outsidePublicBuildDirs: "BLOCKED",
      writable: writeProbe ? "BLOCKED" : "SKIPPED",
    },
  };

  if (!configuredValue) {
    errors.push(`${envKey} is required for server storage readiness`);
    target.status = "MISSING";
    return { target, errors, realpath: "" };
  }

  if (hasPlaceholder(configuredValue)) {
    errors.push(`${envKey} must not contain placeholders`);
  } else {
    target.checks.noPlaceholder = "PASS";
  }

  if (!path.isAbsolute(configuredValue)) {
    errors.push(`${envKey} must be an absolute path outside the repository workspace`);
    return { target, errors, realpath: "" };
  }
  target.checks.absolutePath = "PASS";

  const resolved = path.resolve(configuredValue);
  if (isPathInside(rootRealpath, resolved) || isPathInside(root, resolved)) {
    errors.push(`${envKey} must be outside the repository workspace`);
  } else {
    target.checks.outsideRepository = "PASS";
  }

  const forbiddenRoots = FORBIDDEN_REPO_STORAGE_DIRS.map((entry) => path.join(rootRealpath, entry));
  if (forbiddenRoots.some((forbiddenRoot) => isPathInside(forbiddenRoot, resolved))) {
    errors.push(`${envKey} must not point inside public static or build artifact directories`);
  } else {
    target.checks.outsidePublicBuildDirs = "PASS";
  }

  if (errors.length) {
    return { target, errors, realpath: "" };
  }

  const preflightRealpath = safeRealpath(resolved);
  if (isPathInside(rootRealpath, preflightRealpath)) {
    errors.push(`${envKey} must not resolve through a symlink into the repository workspace`);
    target.checks.outsideRepository = "BLOCKED";
    return { target, errors, realpath: "" };
  }

  const writeStatus = writeProbe ? writableDirectoryStatus(resolved) : "SKIPPED";
  target.checks.writable = writeStatus === "SKIPPED" ? "SKIPPED" : writeStatus === "WRITABLE" ? "PASS" : "BLOCKED";
  if (writeStatus === "NOT_DIRECTORY") {
    errors.push(`${envKey} must resolve to a directory`);
  } else if (writeStatus === "NOT_WRITABLE") {
    errors.push(`${envKey} must be writable by the server process`);
  }

  const realpath = safeRealpath(resolved);
  if (isPathInside(rootRealpath, realpath)) {
    errors.push(`${envKey} must not resolve through a symlink into the repository workspace`);
    target.checks.outsideRepository = "BLOCKED";
  }

  target.status = errors.length ? "BLOCKED" : "READY";
  return { target, errors, realpath: errors.length ? "" : realpath };
}

export function validateServerStorageReadiness({
  root = repoRoot,
  env = process.env,
  writeProbe = true,
} = {}) {
  const rootRealpath = safeRealpath(root);
  const results = REQUIRED_SERVER_STORAGE_ENV_KEYS.map((envKey) =>
    validateStorageTarget({
      envKey,
      value: env[envKey],
      root,
      rootRealpath,
      writeProbe,
    }),
  );
  const errors = results.flatMap((result) => result.errors);
  const realpaths = Object.fromEntries(results.map((result) => [result.target.envKey, result.realpath]).filter(([, value]) => value));
  const auditPath = realpaths.INSTITUTION_AUDIT_LEDGER_DIR;
  const accountPath = realpaths.INSTITUTION_ACCOUNT_REGISTRY_DIR;

  if (auditPath && accountPath && (isPathInside(auditPath, accountPath) || isPathInside(accountPath, auditPath))) {
    errors.push("INSTITUTION_AUDIT_LEDGER_DIR and INSTITUTION_ACCOUNT_REGISTRY_DIR must be separate non-nested directories");
  }

  const targets = results.map((result) => {
    const nestedConflict =
      auditPath &&
      accountPath &&
      result.realpath &&
      (isPathInside(auditPath, accountPath) || isPathInside(accountPath, auditPath));
    return nestedConflict ? { ...result.target, status: "BLOCKED" } : result.target;
  });

  return {
    valid: errors.length === 0,
    errors,
    writeProbe: writeProbe ? "ENABLED" : "SKIPPED",
    summary: {
      requiredDirectoryCount: REQUIRED_SERVER_STORAGE_ENV_KEYS.length,
      configuredDirectoryCount: targets.filter((target) => target.configured).length,
      readyDirectoryCount: targets.filter((target) => target.status === "READY").length,
    },
    targets,
  };
}

function nextActionFor(error) {
  if (error.includes("absolute path") || error.includes("outside the repository")) {
    return "Set audit ledger and account registry directories to approved absolute paths outside the app repository.";
  }
  if (error.includes("placeholders")) {
    return "Replace storage path placeholders with approved deployment volume paths.";
  }
  if (error.includes("writable") || error.includes("directory")) {
    return "Provision access-controlled writable server storage for the app process before go-live.";
  }
  if (error.includes("separate non-nested")) {
    return "Use separate non-nested directories for append-only audit logs and account registry data.";
  }
  return "Resolve this server storage readiness blocker before production deployment.";
}

export function buildServerStorageReadinessReport(readiness, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    writeProbe: readiness.writeProbe,
    summary: readiness.summary,
    checks: readiness.targets.map((target) => ({
      id: target.envKey,
      label:
        target.envKey === "INSTITUTION_AUDIT_LEDGER_DIR"
          ? "Audit ledger storage is private, repo-external, and writable"
          : "Account registry storage is private, repo-external, and writable",
      status: target.status === "READY" ? "PASS" : "BLOCKED",
      detail: target.checks,
    })),
    errors: [...readiness.errors],
    nextActions: readiness.errors.length
      ? Array.from(new Set(readiness.errors.map(nextActionFor)))
      : ["Archive the storage readiness report with the server deployment handoff."],
    safetyNotes: [
      "This report records storage readiness states only and redacts filesystem paths.",
      "The write probe creates and immediately removes a temporary marker file; it does not write victim data, account data, or audit events.",
      "Use separate access controls and retention rules for audit ledger storage and account registry storage.",
    ],
  };
}

export function formatServerStorageReadinessMarkdown(report) {
  const lines = [
    "# JiumAI Server Storage Readiness Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Write probe: ${report.writeProbe}`,
    `- Ready directories: ${report.summary.readyDirectoryCount}/${report.summary.requiredDirectoryCount}`,
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
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
  const args = { format: "text", outputPath: "", writeProbe: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--no-write-probe") {
      args.writeProbe = false;
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
  console.log(`Server storage readiness report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  const readiness = validateServerStorageReadiness({ writeProbe: args.writeProbe });
  const report = buildServerStorageReadinessReport(readiness);
  const content =
    args.format === "json"
      ? JSON.stringify(report, null, 2)
      : args.format === "markdown"
        ? formatServerStorageReadinessMarkdown(report)
        : formatServerStorageReadinessMarkdown(report);
  writeOutput(content, args.outputPath);
  if (!readiness.valid) {
    process.exit(1);
  }
}
