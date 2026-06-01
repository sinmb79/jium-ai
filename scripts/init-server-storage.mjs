#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";
import {
  REQUIRED_SERVER_STORAGE_ENV_KEYS,
  buildServerStorageReadinessReport,
  formatServerStorageReadinessMarkdown,
  validateServerStorageReadiness,
} from "./check-server-storage-readiness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const DEFAULT_SERVER_STORAGE_DIR_NAMES = {
  INSTITUTION_AUDIT_LEDGER_DIR: "audit-ledger",
  INSTITUTION_ACCOUNT_REGISTRY_DIR: "account-registry",
};

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

function defaultStorageRoot({ platform = process.platform, env = process.env } = {}) {
  if (platform === "win32" && clean(env.LOCALAPPDATA)) {
    return path.join(clean(env.LOCALAPPDATA), "JiumAI", "server-storage");
  }
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "JiumAI", "server-storage");
  }
  return path.join(clean(env.XDG_DATA_HOME) || path.join(os.homedir(), ".local", "share"), "jium-ai", "server-storage");
}

function resolveStorageRoot({ root, storageRoot, platform, env }) {
  const resolved = path.resolve(clean(storageRoot) || defaultStorageRoot({ platform, env }));
  if (!path.isAbsolute(resolved) || hasPlaceholder(resolved)) {
    throw new Error("Server storage root must be an absolute non-placeholder path.");
  }
  if (isPathInside(root, resolved)) {
    throw new Error("Server storage root must be outside the repository workspace.");
  }
  return resolved;
}

function storageTargets(storageRoot) {
  return Object.fromEntries(
    REQUIRED_SERVER_STORAGE_ENV_KEYS.map((envKey) => [envKey, path.join(storageRoot, DEFAULT_SERVER_STORAGE_DIR_NAMES[envKey])]),
  );
}

function parseEnvFile(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function upsertEnvLine(lines, key, value, { force = false } = {}) {
  const lineIndex = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (lineIndex < 0) {
    lines.push(`${key}=${value}`);
    return "ADDED";
  }
  const currentValue = lines[lineIndex].slice(lines[lineIndex].indexOf("=") + 1);
  if (currentValue === value) {
    return "UNCHANGED";
  }
  if (!force && clean(currentValue) && !hasPlaceholder(currentValue)) {
    return "PRESERVED";
  }
  lines[lineIndex] = `${key}=${value}`;
  return "UPDATED";
}

function updateEnvFile({ root, envPath, targets, forceEnv }) {
  const resolvedEnvPath = path.resolve(root, envPath);
  const existingContent = existsSync(resolvedEnvPath) ? readFileSync(resolvedEnvPath, "utf8") : "";
  const lines = existingContent ? existingContent.replace(/\r\n/g, "\n").split("\n") : ["# JiumAI private server storage env"];
  const keyStatuses = Object.fromEntries(
    Object.entries(targets).map(([key, value]) => [key, upsertEnvLine(lines, key, value, { force: forceEnv })]),
  );
  mkdirSync(path.dirname(resolvedEnvPath), { recursive: true });
  writeFileSync(resolvedEnvPath, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n")}\n`, "utf8");
  const updatedEnv = parseEnvFile(readFileSync(resolvedEnvPath, "utf8"));
  return {
    envPath,
    envPathRelative: path.relative(root, resolvedEnvPath).replace(/\\/g, "/"),
    status: Object.values(keyStatuses).some((status) => status === "UPDATED" || status === "ADDED") ? "UPDATED" : "UNCHANGED",
    keyStatuses,
    updatedEnv,
  };
}

function redactedTargetSummary(targets, root) {
  return Object.entries(targets).map(([envKey, targetPath]) => ({
    envKey,
    directoryName: path.basename(targetPath),
    pathStatus: isPathInside(root, targetPath) ? "BLOCKED_REPOSITORY_PATH" : "REPO_EXTERNAL",
  }));
}

export function buildServerStorageInitPlan({
  root = repoRoot,
  storageRoot,
  platform = process.platform,
  env = process.env,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  createDirs = true,
  writeEnv = false,
  forceEnv = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedStorageRoot = resolveStorageRoot({ root: resolvedRoot, storageRoot, platform, env });
  const targets = storageTargets(resolvedStorageRoot);
  if (createDirs) {
    Object.values(targets).forEach((targetPath) => mkdirSync(targetPath, { recursive: true }));
  }

  const readiness = validateServerStorageReadiness({ root: resolvedRoot, env: targets });
  const readinessReport = buildServerStorageReadinessReport(readiness, { generatedAt });
  const envUpdate = writeEnv
    ? updateEnvFile({ root: resolvedRoot, envPath, targets, forceEnv })
    : {
        envPath,
        envPathRelative: envPath.replace(/\\/g, "/"),
        status: "SKIPPED",
        keyStatuses: Object.fromEntries(REQUIRED_SERVER_STORAGE_ENV_KEYS.map((key) => [key, "SKIPPED"])),
        updatedEnv: {},
      };

  return {
    schema: "jium-server-storage-init-v1",
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    mode: writeEnv ? "DIRECTORY_AND_ENV_UPDATE" : "DIRECTORY_ONLY",
    summary: {
      createdDirectoryCount: createDirs ? Object.keys(targets).length : 0,
      readyDirectoryCount: readinessReport.summary.readyDirectoryCount,
      requiredDirectoryCount: readinessReport.summary.requiredDirectoryCount,
      envUpdateStatus: envUpdate.status,
    },
    envFile: {
      path: envUpdate.envPathRelative,
      status: envUpdate.status,
      keyStatuses: envUpdate.keyStatuses,
    },
    targets: redactedTargetSummary(targets, resolvedRoot),
    readiness: {
      status: readinessReport.status,
      errorCount: readinessReport.errors.length,
      nextActions: writeEnv
        ? readinessReport.nextActions
        : ["Run this command again with --write-env to update the private server env file after reviewing the storage location."],
    },
    safetyNotes: [
      "This init report redacts absolute filesystem paths and records only directory roles, statuses, and counts.",
      "The private env file may contain real storage paths; keep it out of git and do not copy it into public reports.",
      "This helper provisions local or deployment directories only; it does not approve retention, access control, backup, or institution operating policy.",
    ],
  };
}

export function formatServerStorageInitMarkdown(plan) {
  const lines = [
    "# JiumAI Server Storage Init Report",
    "",
    `- Generated at: ${plan.generatedAt}`,
    `- Status: ${plan.status}`,
    `- Mode: ${plan.mode}`,
    `- Ready directories: ${plan.summary.readyDirectoryCount}/${plan.summary.requiredDirectoryCount}`,
    `- Env update: ${plan.summary.envUpdateStatus}`,
    `- Env file: ${plan.envFile.path}`,
    "",
    "## Targets",
    ...plan.targets.map((target) => `- ${target.envKey}: ${target.directoryName} (${target.pathStatus})`),
    "",
    "## Env Key Status",
    ...Object.entries(plan.envFile.keyStatuses).map(([key, status]) => `- ${key}: ${status}`),
    "",
    "## Next Actions",
    ...plan.readiness.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...plan.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = {
    format: "text",
    outputPath: "",
    storageRoot: "",
    envPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
    createDirs: true,
    writeEnv: false,
    forceEnv: false,
    platform: process.platform,
    root: repoRoot,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--storage-root") {
      args.storageRoot = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--storage-root=")) {
      args.storageRoot = arg.slice("--storage-root=".length);
    } else if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--env") {
      args.envPath = argv[index + 1] || args.envPath;
      index += 1;
    } else if (arg.startsWith("--env=")) {
      args.envPath = arg.slice("--env=".length);
    } else if (arg === "--write-env") {
      args.writeEnv = true;
    } else if (arg === "--force-env") {
      args.forceEnv = true;
      args.writeEnv = true;
    } else if (arg === "--no-create") {
      args.createDirs = false;
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
  console.log(`Server storage init report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const plan = buildServerStorageInitPlan(args);
    const content = args.format === "json" ? JSON.stringify(plan, null, 2) : formatServerStorageInitMarkdown(plan);
    writeOutput(content, args.outputPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
