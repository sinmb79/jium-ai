#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildServerRuntimeReadinessReport,
  formatServerRuntimeReadinessMarkdown,
  validateServerRuntimeReadiness,
} from "./check-server-readiness.mjs";
import {
  buildServerStorageReadinessReport,
  formatServerStorageReadinessMarkdown,
} from "./check-server-storage-readiness.mjs";
import {
  SERVER_ROUTE_TEMPLATE_ROOT,
  listServerRouteTemplates,
  materializeServerRoutes,
} from "./materialize-server-routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
export const SERVER_DEPLOYMENT_BUNDLE_DIR = "dist/server-deployment-bundle";

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePrepareBundleDir(root, bundleDir) {
  const resolved = path.resolve(root, bundleDir);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== SERVER_DEPLOYMENT_BUNDLE_DIR) {
    throw new Error(`Refusing to clean unsafe server deployment bundle directory: ${resolved}`);
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

function redactLocalPaths(message, root, templateRoot) {
  return String(message || "")
    .replaceAll(path.resolve(root), "[REDACTED_REPO_ROOT]")
    .replaceAll(path.resolve(templateRoot), "[REDACTED_TEMPLATE_ROOT]")
    .replaceAll(path.resolve(root).replace(/\\/g, "/"), "[REDACTED_REPO_ROOT]")
    .replaceAll(path.resolve(templateRoot).replace(/\\/g, "/"), "[REDACTED_TEMPLATE_ROOT]");
}

function routeNextActionFor(error) {
  if (error.includes("JIUM_SERVER_ROUTES=true")) {
    return "Set JIUM_SERVER_ROUTES=true only for server deployments before materializing routes.";
  }
  if (error.includes("GITHUB_PAGES=true")) {
    return "Disable GITHUB_PAGES for the server deployment profile.";
  }
  if (error.includes("server route templates")) {
    return "Restore required files under server-route-templates/app before building the server deployment.";
  }
  if (error.includes("Deployment profile")) {
    return "Set the required server-only env values, then rerun the server route materialization plan.";
  }
  if (error.includes("non-generated server route")) {
    return "Review the existing app route handler before allowing generated institution routes to be materialized.";
  }
  return "Resolve this server route materialization blocker before production deployment.";
}

export function validateServerRouteMaterialization({
  root = repoRoot,
  templateRoot = SERVER_ROUTE_TEMPLATE_ROOT,
  env = process.env,
} = {}) {
  const templateFiles = listServerRouteTemplates(templateRoot).map((template) => template.relativePath).sort();
  const errors = [];
  let profile = "unknown";
  let routeFiles = [];

  if (!templateFiles.length) {
    errors.push("server route templates missing under server-route-templates/app");
  } else {
    try {
      const plan = materializeServerRoutes({ root, templateRoot, env, dryRun: true });
      profile = plan.profile;
      routeFiles = plan.routeFiles;
    } catch (error) {
      errors.push(`server route materialization: ${redactLocalPaths(error instanceof Error ? error.message : String(error), root, templateRoot)}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    profile,
    templateFiles,
    routeFiles,
    summary: {
      templateFileCount: templateFiles.length,
      routeFileCount: routeFiles.length,
    },
  };
}

export function buildServerRouteMaterializationReport(plan, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    generatedAt,
    status: plan.valid ? "READY" : "BLOCKED",
    profile: plan.profile,
    summary: plan.summary,
    templateFiles: [...plan.templateFiles],
    routeFiles: [...plan.routeFiles],
    errors: [...plan.errors],
    nextActions: plan.errors.length
      ? Array.from(new Set(plan.errors.map(routeNextActionFor)))
      : ["Run npm run server:routes:materialize in the approved server deployment environment."],
    safetyNotes: [
      "This report contains relative route template and generated route paths only.",
      "It does not store server secrets, trusted origin values, storage directory paths, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.",
      "Generated route handlers must be removed with npm run server:routes:clean before returning to static GitHub Pages builds.",
    ],
  };
}

export function formatServerRouteMaterializationMarkdown(report) {
  const lines = [
    "# JiumAI Server Route Materialization Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Profile: ${report.profile}`,
    `- Templates: ${report.summary.templateFileCount}`,
    `- Planned route files: ${report.summary.routeFileCount}`,
    "",
    "## Planned Route Files",
    ...(report.routeFiles.length ? report.routeFiles.map((file) => `- ${file}`) : ["- None"]),
    "",
    "## Template Files",
    ...(report.templateFiles.length ? report.templateFiles.map((file) => `- ${file}`) : ["- None"]),
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

export async function buildServerDeploymentBundle({
  root = repoRoot,
  templateRoot = path.join(root, "server-route-templates", "app"),
  env = process.env,
  generatedAt = new Date().toISOString(),
  validations,
} = {}) {
  const bundleDir = safePrepareBundleDir(root, SERVER_DEPLOYMENT_BUNDLE_DIR);
  const serverRuntime = validations?.serverRuntime || validateServerRuntimeReadiness({ root, templateRoot, env });
  const routeMaterialization =
    validations?.routeMaterialization || validateServerRouteMaterialization({ root, templateRoot, env });

  const serverReport = buildServerRuntimeReadinessReport(serverRuntime, { generatedAt });
  const storageReport = buildServerStorageReadinessReport(serverRuntime.storage, { generatedAt });
  const routeReport = buildServerRouteMaterializationReport(routeMaterialization, { generatedAt });

  const summary = {
    schema: "jium-server-deployment-bundle-v1",
    generatedAt,
    status: [serverReport.status, storageReport.status, routeReport.status].every((status) => status === "READY")
      ? "READY"
      : "BLOCKED",
    version: readPackageVersion(root),
    commit: currentGitCommit(root, env),
    profile: serverReport.profile,
    gates: [
      { id: "server-runtime-readiness", status: serverReport.status, errorCount: serverReport.errors.length },
      { id: "server-storage-readiness", status: storageReport.status, errorCount: storageReport.errors.length },
      { id: "server-route-materialization", status: routeReport.status, errorCount: routeReport.errors.length },
    ],
    summary: {
      activeTrustedKeyCount: serverReport.summary.activeKeyCount,
      trustedKeyCount: serverReport.summary.keyCount,
      routeTemplateCount: routeReport.summary.templateFileCount,
      plannedRouteFileCount: routeReport.summary.routeFileCount,
      storageReadyDirectoryCount: storageReport.summary.readyDirectoryCount,
      storageRequiredDirectoryCount: storageReport.summary.requiredDirectoryCount,
    },
    reports: {
      serverRuntimeJson: "server-runtime-readiness-report.json",
      serverRuntimeMarkdown: "server-runtime-readiness-report.md",
      serverStorageJson: "server-storage-readiness-report.json",
      serverStorageMarkdown: "server-storage-readiness-report.md",
      routeMaterializationJson: "server-route-materialization-report.json",
      routeMaterializationMarkdown: "server-route-materialization-report.md",
      summaryJson: "server-deployment-summary.json",
      summaryMarkdown: "server-deployment-summary.md",
      runbookMarkdown: "server-deployment-runbook.md",
    },
    deploymentCommands: [
      "npm run server:env:init",
      "npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>",
      "npm run security:server-storage",
      "npm run security:server-readiness",
      "npm run server:routes:materialize",
      "npm run build:server:production",
      "npm run server:routes:clean",
    ],
    externalRecordsNeeded: [
      "Approved HTTPS institution operator origin list",
      "Server-only session secret stored in deployment secret storage",
      "Approved active institution public key and fingerprint approval record",
      "Access-controlled audit ledger and account registry storage decision",
      "Server hosting approval, retention policy approval, support route, and incident-response owner",
    ],
    nextActions: uniqueActions(serverReport.nextActions, storageReport.nextActions, routeReport.nextActions),
    safetyNotes: [
      "This bundle is a server deployment evidence packet, not proof that institution, legal, or hosting approval is complete.",
      "Reports store readiness states, counts, relative route file names, version, and commit only.",
      "Do not add public URL values, support contact details, incident owner names, secrets, tokens, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers to this bundle.",
    ],
  };

  writeJson(path.join(bundleDir, "server-runtime-readiness-report.json"), serverReport);
  writeText(path.join(bundleDir, "server-runtime-readiness-report.md"), formatServerRuntimeReadinessMarkdown(serverReport));
  writeJson(path.join(bundleDir, "server-storage-readiness-report.json"), storageReport);
  writeText(path.join(bundleDir, "server-storage-readiness-report.md"), formatServerStorageReadinessMarkdown(storageReport));
  writeJson(path.join(bundleDir, "server-route-materialization-report.json"), routeReport);
  writeText(path.join(bundleDir, "server-route-materialization-report.md"), formatServerRouteMaterializationMarkdown(routeReport));
  writeJson(path.join(bundleDir, "server-deployment-summary.json"), summary);
  writeText(path.join(bundleDir, "server-deployment-summary.md"), formatServerDeploymentSummary(summary));
  writeText(path.join(bundleDir, "server-deployment-runbook.md"), formatServerDeploymentSummary(summary));

  return {
    valid: summary.status === "READY",
    bundleDir,
    bundleDirRelative: relativePath(root, bundleDir),
    summary,
  };
}

export function formatServerDeploymentSummary(summary) {
  const lines = [
    "# JiumAI Server Deployment Bundle",
    "",
    `- Generated at: ${summary.generatedAt}`,
    `- Status: ${summary.status}`,
    `- Version: ${summary.version || "MISSING"}`,
    `- Commit: ${summary.commit || "MISSING"}`,
    `- Profile: ${summary.profile}`,
    "",
    "## Gates",
    ...summary.gates.map((gate) => `- ${gate.status} ${gate.id}: ${gate.errorCount} error(s)`),
    "",
    "## Summary",
    `- Active trusted keys: ${summary.summary.activeTrustedKeyCount}/${summary.summary.trustedKeyCount}`,
    `- Route templates: ${summary.summary.routeTemplateCount}`,
    `- Planned route files: ${summary.summary.plannedRouteFileCount}`,
    `- Storage directories: ${summary.summary.storageReadyDirectoryCount}/${summary.summary.storageRequiredDirectoryCount}`,
    "",
    "## Reports",
    ...Object.entries(summary.reports).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Deployment Commands",
    ...summary.deploymentCommands.map((command) => `- ${command}`),
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

function parseCliArgs(argv) {
  const args = { format: "text" };
  for (const arg of argv) {
    if (arg === "--json") {
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
    const result = await buildServerDeploymentBundle();
    if (args.format === "json") {
      console.log(JSON.stringify(result.summary, null, 2));
    } else {
      console.log(formatServerDeploymentSummary(result.summary));
      console.log(`Server deployment bundle written: ${result.bundleDirRelative}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
