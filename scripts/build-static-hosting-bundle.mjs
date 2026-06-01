#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStaticHeadersFile } from "./security-headers-runtime.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const STATIC_HOSTING_BUNDLE_DIR = "dist/static-hosting-bundle";
const STATIC_HOSTING_SITE_DIR = "dist/static-hosting-bundle/site";
const PROVIDER_TARGETS = ["Cloudflare Pages", "Netlify"];

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeCleanDir(root, target, expectedRelativePath) {
  const resolved = path.resolve(target);
  const relative = path.relative(path.resolve(root), resolved).replace(/\\/g, "/");
  if (!isPathInside(root, resolved) || relative !== expectedRelativePath) {
    throw new Error(`Refusing to clean unsafe static hosting path: ${resolved}`);
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

function copyDirectory(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    } else {
      throw new Error(`Unsupported static export artifact type: ${entry.name}`);
    }
  }
}

function resolveNextBuildInvocation(root = repoRoot, platform = process.platform) {
  const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
  if (existsSync(nextCli)) {
    return { command: process.execPath, args: [nextCli, "build"] };
  }
  if (platform === "win32") {
    return { command: "cmd", args: ["/d", "/s", "/c", "npx next build"] };
  }
  return { command: "npx", args: ["next", "build"] };
}

function staticHostingExportEnv(env = process.env) {
  return {
    ...env,
    GITHUB_PAGES: "false",
    JIUM_DESKTOP_EXPORT: "false",
    JIUM_STATIC_HOSTING_EXPORT: "true",
    NEXT_TELEMETRY_DISABLED: env.NEXT_TELEMETRY_DISABLED || "1",
  };
}

function requiredRouteFiles() {
  return ["index.html", "dashboard/index.html", "privacy/index.html", "support/index.html"];
}

export function validateStaticHostingExport({ root = repoRoot, outDir = path.join(root, "out") } = {}) {
  const resolvedOut = path.resolve(outDir);
  const errors = [];
  const foundFiles = [];

  if (!existsSync(resolvedOut)) {
    errors.push("static hosting export directory missing: out");
  } else {
    for (const relativeFile of requiredRouteFiles()) {
      const filePath = path.join(resolvedOut, relativeFile);
      if (!existsSync(filePath)) {
        errors.push(`static hosting export file missing: ${relativeFile}`);
      } else {
        foundFiles.push(relativeFile);
        const html = readFileSync(filePath, "utf8");
        if (html.includes("/jium-ai/")) {
          errors.push(`static hosting export contains GitHub Pages basePath: ${relativeFile}`);
        }
      }
    }

    const nextAssets = path.join(resolvedOut, "_next");
    if (!existsSync(nextAssets) || !statSync(nextAssets).isDirectory()) {
      errors.push("static hosting export asset directory missing: _next");
    }

    const headersPath = path.join(resolvedOut, "_headers");
    if (!existsSync(headersPath)) {
      errors.push("static hosting _headers file missing");
    } else {
      const headers = readFileSync(headersPath, "utf8").replace(/\r\n/g, "\n");
      if (headers !== buildStaticHeadersFile()) {
        errors.push("static hosting _headers file must match repository security policy");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    outDir: "out",
    foundFiles,
    requiredFiles: requiredRouteFiles(),
    headerPolicyStatus: errors.some((error) => error.includes("_headers")) ? "BLOCKED" : "READY",
  };
}

function buildReport({ root, generatedAt, readiness, bundleDir }) {
  const checks = [
    {
      id: "route-files",
      label: "Static export contains required public routes",
      status: readiness.requiredFiles.every((file) => readiness.foundFiles.includes(file)) ? "PASS" : "BLOCKED",
    },
    {
      id: "security-headers",
      label: "Static host _headers matches repository security policy",
      status: readiness.headerPolicyStatus === "READY" ? "PASS" : "BLOCKED",
    },
    {
      id: "base-path",
      label: "Static export is free of GitHub Pages basePath",
      status: readiness.errors.some((error) => error.includes("basePath")) ? "BLOCKED" : "PASS",
    },
  ];

  return {
    schema: "jium-static-hosting-bundle-v1",
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    version: readPackageVersion(root),
    commit: currentGitCommit(root),
    providerTargets: [...PROVIDER_TARGETS],
    summary: {
      bundleDir: relativePath(root, bundleDir),
      siteDir: STATIC_HOSTING_SITE_DIR,
      requiredFileCount: readiness.requiredFiles.length,
      foundFileCount: readiness.foundFiles.length,
      headerPolicyStatus: readiness.headerPolicyStatus,
    },
    checks,
    errors: [...readiness.errors],
    deploymentCommands: [
      "npm run public:hosting:bundle",
      "Upload dist/static-hosting-bundle/site to a host that supports _headers, such as Cloudflare Pages or Netlify.",
      "Run npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json after deployment.",
    ],
    safetyNotes: [
      "This report stores relative artifact names, counts, version, commit, and readiness states only.",
      "It does not store public URL values, host names, support contacts, incident owner names, secrets, tokens, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.",
      "A READY result means the static host bundle is structurally ready for a _headers-capable provider; it is not proof that the external production host has deployed it.",
    ],
  };
}

export function formatStaticHostingBundleMarkdown(report) {
  const lines = [
    "# JiumAI Static Hosting Bundle",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Commit: ${report.commit || "MISSING"}`,
    `- Bundle dir: ${report.summary.bundleDir}`,
    `- Site dir: ${report.summary.siteDir}`,
    `- Provider targets: ${report.providerTargets.join(", ")}`,
    `- Required files: ${report.summary.foundFileCount}/${report.summary.requiredFileCount}`,
    `- Header policy: ${report.summary.headerPolicyStatus}`,
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Deployment Commands",
    ...report.deploymentCommands.map((command) => `- ${command}`),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  writeFileSync(filePath, value, "utf8");
}

export async function buildStaticHostingBundle({
  root = repoRoot,
  runner = spawnSync,
  generatedAt = new Date().toISOString(),
  clean = true,
} = {}) {
  const outDir = path.join(root, "out");
  if (clean) {
    safeCleanDir(root, outDir, "out");
  }

  const invocation = resolveNextBuildInvocation(root);
  const result = runner(invocation.command, invocation.args, {
    cwd: root,
    env: staticHostingExportEnv(process.env),
    stdio: "inherit",
  });

  if (typeof result?.status === "number" && result.status !== 0) {
    throw new Error(`Static hosting export build failed with exit code ${result.status}`);
  }
  if (result?.error) {
    throw result.error;
  }

  const readiness = validateStaticHostingExport({ root, outDir });
  const bundleDir = safeCleanDir(root, path.join(root, STATIC_HOSTING_BUNDLE_DIR), STATIC_HOSTING_BUNDLE_DIR);
  const siteDir = path.join(root, STATIC_HOSTING_SITE_DIR);
  copyDirectory(outDir, siteDir);
  const report = buildReport({ root, generatedAt, readiness, bundleDir });

  writeJson(path.join(bundleDir, "static-hosting-readiness-report.json"), report);
  writeText(path.join(bundleDir, "static-hosting-readiness-report.md"), formatStaticHostingBundleMarkdown(report));
  writeText(path.join(bundleDir, "static-hosting-deployment-runbook.md"), formatStaticHostingBundleMarkdown(report));

  return {
    valid: report.status === "READY",
    bundleDir,
    bundleDirRelative: relativePath(root, bundleDir),
    summary: report,
  };
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
    const result = await buildStaticHostingBundle();
    if (args.format === "json") {
      console.log(JSON.stringify(result.summary, null, 2));
    } else {
      console.log(formatStaticHostingBundleMarkdown(result.summary));
      console.log(`Static hosting bundle written: ${result.bundleDirRelative}`);
    }
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
