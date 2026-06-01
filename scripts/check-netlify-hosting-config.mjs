#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const NETLIFY_HOSTING_CONFIG_SCHEMA = "jium-netlify-hosting-config-v1";
export const NETLIFY_HOSTING_CONFIG_DIR = "dist/netlify-hosting-config";
export const NETLIFY_HOSTING_CONFIG_JSON = "netlify-hosting-config-report.json";
export const NETLIFY_HOSTING_CONFIG_MARKDOWN = "netlify-hosting-config-report.md";

const REQUIRED_BUILD_COMMAND = "npm run public:hosting:bundle";
const REQUIRED_PUBLISH_DIRECTORY = "dist/static-hosting-bundle/site";
const REQUIRED_NODE_VERSION = "24";
const REQUIRED_IGNORE_ENTRIES = ["node_modules", ".git", ".next", "out", "dist", ".env", ".env*.local", "ops/private"];

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
  {
    id: "secret-assignment",
    label: "Secret-like assignment",
    regex: /\b(?:NETLIFY_AUTH_TOKEN|GITHUB_TOKEN|GH_TOKEN|API_KEY|SECRET|PASSWORD|PRIVATE_KEY)\s*=/i,
  },
];

function clean(value) {
  return String(value || "").trim();
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
  } catch {
    return "";
  }
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function safePrepareReportDir(root) {
  const resolved = path.resolve(root, NETLIFY_HOSTING_CONFIG_DIR);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== NETLIFY_HOSTING_CONFIG_DIR) {
    throw new Error(`Refusing to clean unsafe Netlify hosting config report directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function tomlValue(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^\\s*${escaped}\\s*=\\s*"([^"]*)"\\s*$`, "im").exec(text);
  return match?.[1]?.trim() || "";
}

function unsafeFindings(text) {
  return UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
  }));
}

function statusFromBoolean(valid) {
  return valid ? "READY" : "BLOCKED";
}

export function validateNetlifyHostingConfig({
  root = repoRoot,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const configPath = path.join(resolvedRoot, "netlify.toml");
  const ignorePath = path.join(resolvedRoot, ".netlifyignore");
  const errors = [];
  const warnings = [];
  let configText = "";
  let ignoreText = "";

  if (!existsSync(configPath)) {
    errors.push("Netlify config missing: netlify.toml");
  } else {
    configText = readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
  }
  if (!existsSync(ignorePath)) {
    errors.push("Netlify upload ignore file missing: .netlifyignore");
  } else {
    ignoreText = readFileSync(ignorePath, "utf8").replace(/^\uFEFF/, "");
  }

  const buildCommand = tomlValue(configText, "command");
  const publishDirectory = tomlValue(configText, "publish");
  const nodeVersion = tomlValue(configText, "NODE_VERSION");
  const telemetryDisabled = tomlValue(configText, "NEXT_TELEMETRY_DISABLED");
  const findings = unsafeFindings(configText);
  const ignoreEntries = new Set(
    ignoreText
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => clean(line.replace(/#.*/, "")))
      .filter(Boolean),
  );
  const missingIgnoreEntries = REQUIRED_IGNORE_ENTRIES.filter((entry) => !ignoreEntries.has(entry));

  if (buildCommand !== REQUIRED_BUILD_COMMAND) {
    errors.push("Netlify build command must run npm run public:hosting:bundle");
  }
  if (publishDirectory !== REQUIRED_PUBLISH_DIRECTORY) {
    errors.push("Netlify publish directory must be dist/static-hosting-bundle/site");
  }
  if (nodeVersion !== REQUIRED_NODE_VERSION) {
    errors.push("Netlify NODE_VERSION must be 24");
  }
  if (telemetryDisabled !== "1") {
    warnings.push("Netlify NEXT_TELEMETRY_DISABLED should be 1");
  }
  if (findings.length) {
    errors.push("Netlify config contains unsafe raw deployment values");
  }
  if (missingIgnoreEntries.length) {
    errors.push("Netlify upload ignore file must exclude generated directories and private files");
  }

  const report = {
    schema: NETLIFY_HOSTING_CONFIG_SCHEMA,
    generatedAt,
    status: errors.length ? "BLOCKED" : "READY",
    version: readPackageVersion(resolvedRoot),
    configPath: "netlify.toml",
    required: {
      buildCommand: REQUIRED_BUILD_COMMAND,
      publishDirectory: REQUIRED_PUBLISH_DIRECTORY,
      nodeVersion: REQUIRED_NODE_VERSION,
      uploadIgnoreEntries: REQUIRED_IGNORE_ENTRIES,
    },
    summary: {
      configFileStatus: existsSync(configPath) ? "FOUND" : "MISSING",
      uploadIgnoreFileStatus: existsSync(ignorePath) ? "FOUND" : "MISSING",
      buildCommandStatus: statusFromBoolean(buildCommand === REQUIRED_BUILD_COMMAND),
      publishDirectoryStatus: statusFromBoolean(publishDirectory === REQUIRED_PUBLISH_DIRECTORY),
      nodeVersionStatus: statusFromBoolean(nodeVersion === REQUIRED_NODE_VERSION),
      uploadIgnoreStatus: statusFromBoolean(missingIgnoreEntries.length === 0),
      telemetryStatus: telemetryDisabled === "1" ? "READY" : "WARNING",
      unsafeFindingCount: findings.length,
      missingIgnoreEntryCount: missingIgnoreEntries.length,
    },
    missingIgnoreEntries,
    unsafeFindings: findings,
    errors,
    warnings,
    nextActions:
      errors.length === 0
        ? [
            "Run npm run public:hosting:bundle before Netlify deploy.",
            "Deploy the existing Netlify site after this config and .netlifyignore are reviewed.",
            "Run npm run public:hosting:preflight -- <approved-netlify-https-url> after deployment.",
          ]
        : [
            "Update netlify.toml to publish dist/static-hosting-bundle/site from npm run public:hosting:bundle.",
            "Update .netlifyignore to exclude local dependencies, generated artifacts, and private operating files.",
            "Remove raw URLs, contacts, tokens, private paths, and secret-like assignments from Netlify config.",
          ],
    safetyNotes: [
      "This report stores config readiness states, expected command names, ignore entry names, and unsafe pattern IDs only.",
      "Do not store Netlify auth tokens, public URLs, raw host names, support contacts, incident owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, private paths, or certificate material in netlify.toml.",
      "A READY config proves deployment settings are structurally ready; it is not proof that Netlify has deployed or that go-live is approved.",
    ],
  };

  return {
    valid: report.status === "READY",
    report,
  };
}

export function formatNetlifyHostingConfigMarkdown(report) {
  const lines = [
    "# JiumAI Netlify Hosting Config",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Config: ${report.configPath}`,
    `- Config file: ${report.summary.configFileStatus}`,
    `- Upload ignore file: ${report.summary.uploadIgnoreFileStatus}`,
    `- Build command: ${report.summary.buildCommandStatus}`,
    `- Publish directory: ${report.summary.publishDirectoryStatus}`,
    `- Node version: ${report.summary.nodeVersionStatus}`,
    `- Upload ignore: ${report.summary.uploadIgnoreStatus}`,
    `- Telemetry: ${report.summary.telemetryStatus}`,
    `- Unsafe findings: ${report.summary.unsafeFindingCount}`,
    `- Missing ignore entries: ${report.summary.missingIgnoreEntryCount}`,
    "",
    "## Required",
    `- Build command: \`${report.required.buildCommand}\``,
    `- Publish directory: \`${report.required.publishDirectory}\``,
    `- Node version: \`${report.required.nodeVersion}\``,
    `- Upload ignore entries: \`${report.required.uploadIgnoreEntries.join(", ")}\``,
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "## Unsafe Findings",
    ...(report.unsafeFindings.length ? report.unsafeFindings.map((finding) => `- ${finding.id}: ${finding.label}`) : ["- None"]),
    "",
    "## Missing Ignore Entries",
    ...(report.missingIgnoreEntries.length ? report.missingIgnoreEntries.map((entry) => `- ${entry}`) : ["- None"]),
    "",
    "## Next Actions",
    ...report.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function writeNetlifyHostingConfigReportFiles({ root = repoRoot, report, outputPath = "", format = "markdown" } = {}) {
  if (!report) {
    throw new Error("Netlify hosting config report is required.");
  }
  const resolvedRoot = path.resolve(root);
  if (outputPath) {
    const resolvedOutput = path.resolve(resolvedRoot, outputPath);
    if (!isPathInside(resolvedRoot, resolvedOutput)) {
      throw new Error("output path must stay inside the repository");
    }
  }
  const reportDir = safePrepareReportDir(resolvedRoot);
  const jsonPath = path.join(reportDir, NETLIFY_HOSTING_CONFIG_JSON);
  const markdownPath = path.join(reportDir, NETLIFY_HOSTING_CONFIG_MARKDOWN);
  writeJson(jsonPath, report);
  writeText(markdownPath, formatNetlifyHostingConfigMarkdown(report));
  if (outputPath) {
    writeText(
      path.resolve(resolvedRoot, outputPath),
      format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatNetlifyHostingConfigMarkdown(report),
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

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
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
    if (args.outputPath && !isPathInside(args.root, path.resolve(args.root, args.outputPath))) {
      throw new Error("output path must stay inside the repository");
    }
    const result = validateNetlifyHostingConfig({ root: args.root });
    const written = writeNetlifyHostingConfigReportFiles({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    const rendered = args.format === "json" ? `${JSON.stringify(result.report, null, 2)}\n` : formatNetlifyHostingConfigMarkdown(result.report);
    process.stdout.write(rendered);
    console.log(`Netlify hosting config report written: ${args.outputPath || written.reportDirRelative}`);
    if (!result.valid) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
