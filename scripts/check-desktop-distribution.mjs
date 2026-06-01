#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedDesktopDirArtifact, verifyDesktopDirPackage } from "./package-desktop-dir.mjs";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const REQUIRED_DESKTOP_ASAR_ENTRIES = [
  "package.json",
  "desktop/electron-main.cjs",
  "desktop/electron-preload.cjs",
  "scripts/native-secure-vault-bridge.mjs",
  "out/index.html",
  "out/dashboard/index.html",
  "node_modules/electron-updater/package.json",
];

export const FORBIDDEN_DESKTOP_ASAR_PATTERNS = [
  "node_modules/next/",
  "node_modules/react/",
  "node_modules/react-dom/",
  "node_modules/@prisma/",
];

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function normalizeAsarEntry(entry) {
  return String(entry || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function inspectDesktopAppArchive(appArchive, asarApi = asar) {
  const entries = asarApi.listPackage(appArchive).map(normalizeAsarEntry);
  const missingEntries = REQUIRED_DESKTOP_ASAR_ENTRIES.filter((required) => !entries.includes(required));
  const forbiddenEntries = entries.filter((entry) => FORBIDDEN_DESKTOP_ASAR_PATTERNS.some((pattern) => entry.includes(pattern)));
  return {
    entryCount: entries.length,
    requiredEntries: [...REQUIRED_DESKTOP_ASAR_ENTRIES],
    missingEntries,
    forbiddenEntries,
  };
}

export async function validateDesktopDistribution({ root = repoRoot, platform = process.platform } = {}) {
  const errors = [];
  const packageCheck = verifyDesktopDirPackage({ root, platform });
  errors.push(...packageCheck.errors);

  const artifact = expectedDesktopDirArtifact(root, platform);
  const artifactReport = {
    appDir: relativePath(root, artifact.appDir),
    executable: relativePath(root, artifact.executable),
    appArchive: relativePath(root, artifact.appArchive),
    executableBytes: existsSync(artifact.executable) ? statSync(artifact.executable).size : 0,
    appArchiveBytes: existsSync(artifact.appArchive) ? statSync(artifact.appArchive).size : 0,
    executableSha256: existsSync(artifact.executable) ? await sha256File(artifact.executable) : "",
    appArchiveSha256: existsSync(artifact.appArchive) ? await sha256File(artifact.appArchive) : "",
  };

  let archiveInspection = {
    entryCount: 0,
    requiredEntries: [...REQUIRED_DESKTOP_ASAR_ENTRIES],
    missingEntries: [...REQUIRED_DESKTOP_ASAR_ENTRIES],
    forbiddenEntries: [],
  };
  if (existsSync(artifact.appArchive)) {
    archiveInspection = inspectDesktopAppArchive(artifact.appArchive);
    for (const missing of archiveInspection.missingEntries) {
      errors.push(`desktop app archive missing required entry: ${missing}`);
    }
    if (archiveInspection.forbiddenEntries.length) {
      errors.push(`desktop app archive includes forbidden web/runtime dependency: ${archiveInspection.forbiddenEntries[0]}`);
    }
  }

  const stagedPackagePath = path.join(root, "dist", "electron-app", "package.json");
  const stagedPackage = readJsonSafe(stagedPackagePath);
  const stagedDependencies = Object.keys(stagedPackage?.dependencies || {});
  if (!stagedPackage) {
    errors.push("desktop staged app package.json missing: dist/electron-app/package.json");
  } else {
    for (const forbidden of ["next", "react", "react-dom", "@prisma/client"]) {
      if (stagedDependencies.includes(forbidden)) {
        errors.push(`desktop staged app includes forbidden dependency: ${forbidden}`);
      }
    }
    if (!stagedDependencies.includes("electron-updater")) {
      errors.push("desktop staged app missing electron-updater dependency");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    platform,
    artifact: artifactReport,
    archiveInspection,
    stagedApp: {
      packageJson: "dist/electron-app/package.json",
      dependencies: stagedDependencies,
    },
  };
}

export function buildDesktopDistributionReport(validation, options = {}) {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: validation.valid ? "READY" : "BLOCKED",
    platform: validation.platform,
    artifact: validation.artifact,
    archiveInspection: validation.archiveInspection,
    stagedApp: validation.stagedApp,
    errors: [...validation.errors],
    nextActions: validation.errors.length
      ? Array.from(new Set(validation.errors.map((error) => (error.includes("forbidden") ? "Rebuild the desktop app from the lean staging directory." : "Regenerate and verify the desktop package artifacts."))))
      : ["Attach the signed installer/update metadata only after code-signing and update feed readiness pass."],
    safetyNotes: [
      "This report contains artifact names, byte sizes, and SHA-256 digests only.",
      "It does not include update endpoints, certificate paths, signing key material, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.",
      "A READY result proves local distribution artifact integrity only; signed installer and update-feed checks are separate release gates.",
    ],
  };
}

export function formatDesktopDistributionMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Distribution Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Platform: ${report.platform}`,
    `- Executable: ${report.artifact.executable}`,
    `- Executable bytes: ${report.artifact.executableBytes}`,
    `- Executable sha256: ${report.artifact.executableSha256 || "MISSING"}`,
    `- App archive: ${report.artifact.appArchive}`,
    `- App archive bytes: ${report.artifact.appArchiveBytes}`,
    `- App archive sha256: ${report.artifact.appArchiveSha256 || "MISSING"}`,
    `- App archive entries: ${report.archiveInspection.entryCount}`,
    "",
    "## Required Entries",
    ...report.archiveInspection.requiredEntries.map((entry) => `- ${report.archiveInspection.missingEntries.includes(entry) ? "MISSING" : "PASS"} ${entry}`),
    "",
    "## Staged App Dependencies",
    ...(report.stagedApp.dependencies.length ? report.stagedApp.dependencies.map((dependency) => `- ${dependency}`) : ["- None"]),
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
  const args = { format: "text", outputPath: "", platform: process.platform };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
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
  console.log(`Desktop distribution report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const validation = await validateDesktopDistribution({ platform: args.platform });
    const report = buildDesktopDistributionReport(validation);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : args.format === "markdown" ? formatDesktopDistributionMarkdown(report) : formatDesktopDistributionMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!validation.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
