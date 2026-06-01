#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDesktopExport } from "./build-desktop-export.mjs";
import { summarizeDesktopSigningSecrets } from "./check-desktop-signing-secrets.mjs";
import { loadDesktopReleaseEnv } from "./desktop-release-env.mjs";

export const REQUIRED_DESKTOP_FILES = [
  "desktop/electron-main.cjs",
  "desktop/electron-preload.cjs",
  "electron-builder.config.cjs",
  "scripts/native-secure-vault-bridge.mjs",
  "scripts/prepare-desktop-app-dir.mjs",
  "scripts/package-desktop-dir.mjs",
  "scripts/check-desktop-distribution.mjs",
  "scripts/check-desktop-update-feed.mjs",
  "scripts/build-desktop-release-bundle.mjs",
  "scripts/check-desktop-signing-secrets.mjs",
];

export const REQUIRED_DESKTOP_PACKAGE_SCRIPTS = [
  "desktop:vault",
  "desktop:vault:describe",
  "desktop:export",
  "desktop:package:dir",
  "desktop:package:signed",
  "desktop:distribution:check",
  "desktop:update-feed:check",
  "desktop:release:bundle",
  "desktop:signing-secrets:check",
  "desktop:release-env:apply",
  "desktop:release-env:apply:json",
  "desktop:release-env:apply:markdown",
  "desktop:release:check",
  "desktop:release:json",
  "desktop:release:markdown",
];

export const REQUIRED_DESKTOP_RUNTIME_DEPENDENCIES = ["electron-updater"];
export const REQUIRED_DESKTOP_DEV_DEPENDENCIES = ["electron", "electron-builder"];

function present(value) {
  return Boolean(String(value || "").trim());
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readTextSafe(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function updateUrlStatus(value) {
  if (!present(value)) {
    return "MISSING";
  }
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? "SET_HTTPS" : "SET_NOT_HTTPS";
  } catch {
    return "SET_INVALID";
  }
}

export function summarizeDesktopReleaseEnv(env = process.env) {
  const signingSecrets = summarizeDesktopSigningSecrets(env);
  const windowsSigning = signingSecrets.WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE === "SET";
  const appleSigning = present(env.APPLE_TEAM_ID) && present(env.APPLE_SIGNING_IDENTITY);
  const linuxSigning = present(env.LINUX_PACKAGE_SIGNING_KEY_ID);
  return {
    JIUM_DESKTOP_RELEASE_CHANNEL: present(env.JIUM_DESKTOP_RELEASE_CHANNEL) ? "SET" : "MISSING",
    JIUM_DESKTOP_UPDATE_URL: updateUrlStatus(env.JIUM_DESKTOP_UPDATE_URL),
    WINDOWS_SIGNING_PROFILE: windowsSigning ? "SET" : "MISSING",
    APPLE_SIGNING_PROFILE: appleSigning ? "SET" : "MISSING",
    LINUX_SIGNING_PROFILE: linuxSigning ? "SET" : "MISSING",
    SIGNING_PROFILE_COUNT: [windowsSigning, appleSigning, linuxSigning].filter(Boolean).length,
    WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE: signingSecrets.WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE,
  };
}

function nextActionFor(error) {
  if (error.includes("desktop file missing")) {
    return "Restore the Electron shell and native secure-vault bridge files before release.";
  }
  if (error.includes("package script missing")) {
    return "Restore the desktop export and release readiness scripts in package.json.";
  }
  if (error.includes("JIUM_DESKTOP_EXPORT")) {
    return "Keep the desktop export profile in next.config.ts so Electron can load static files without the Pages basePath.";
  }
  if (error.includes("desktop dependency missing")) {
    return "Install and commit the required Electron packaging dependencies.";
  }
  if (error.includes("electron-builder config")) {
    return "Restore electron-builder.config.cjs with out/** files, native vault bridge, generic publish, and signed package targets.";
  }
  if (error.includes("desktop staging")) {
    return "Restore the lean Electron app staging step before packaging.";
  }
  if (error.includes("distribution") || error.includes("update feed")) {
    return "Restore the desktop distribution and update-feed validation scripts.";
  }
  if (error.includes("static export")) {
    return "Run npm run desktop:export and review the generated out/jium-desktop-manifest.json.";
  }
  if (error.includes("release channel")) {
    return "Apply the approved non-secret desktop release lane with npm run desktop:release-env:apply.";
  }
  if (error.includes("update URL")) {
    return "Apply the approved HTTPS desktop updater endpoint with npm run desktop:release-env:apply.";
  }
  if (error.includes("signing profile")) {
    return "Configure at least one platform signing profile before producing a trusted installer.";
  }
  return "Resolve this desktop release readiness error before packaging.";
}

export function validateDesktopReleaseReadiness({ root = process.cwd(), env = process.env, outDir = path.join(root, "out") } = {}) {
  const errors = [];
  const effectiveEnv = loadDesktopReleaseEnv({ root, env });
  const packageJson = readJsonSafe(path.join(root, "package.json")) || {};
  const scripts = packageJson.scripts || {};
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const nextConfigText = readTextSafe(path.join(root, "next.config.ts"));
  const builderConfigText = readTextSafe(path.join(root, "electron-builder.config.cjs"));
  const envSummary = summarizeDesktopReleaseEnv(effectiveEnv);
  const staticExport = verifyDesktopExport({ root, outDir });

  for (const relativePath of REQUIRED_DESKTOP_FILES) {
    if (!existsSync(path.join(root, relativePath))) {
      errors.push(`desktop file missing: ${relativePath}`);
    }
  }

  for (const scriptName of REQUIRED_DESKTOP_PACKAGE_SCRIPTS) {
    if (!present(scripts[scriptName])) {
      errors.push(`package script missing: ${scriptName}`);
    }
  }

  for (const dependency of REQUIRED_DESKTOP_RUNTIME_DEPENDENCIES) {
    if (!present(dependencies[dependency])) {
      errors.push(`desktop dependency missing: ${dependency}`);
    }
  }

  for (const dependency of REQUIRED_DESKTOP_DEV_DEPENDENCIES) {
    if (!present(devDependencies[dependency])) {
      errors.push(`desktop dev dependency missing: ${dependency}`);
    }
  }

  if (!nextConfigText.includes("JIUM_DESKTOP_EXPORT")) {
    errors.push("next.config.ts missing JIUM_DESKTOP_EXPORT desktop static profile");
  }

  for (const requiredConfigNeedle of [
    "out/**",
    "dist/electron-app",
    "node_modules/**",
    "desktop/electron-main.cjs",
    "desktop/electron-preload.cjs",
    "scripts/native-secure-vault-bridge.mjs",
    "provider: \"generic\"",
  ]) {
    if (!builderConfigText.includes(requiredConfigNeedle)) {
      errors.push(`electron-builder config missing: ${requiredConfigNeedle}`);
    }
  }

  for (const error of staticExport.errors) {
    errors.push(`desktop static export: ${error}`);
  }

  if (envSummary.JIUM_DESKTOP_RELEASE_CHANNEL !== "SET") {
    errors.push("desktop release channel missing: JIUM_DESKTOP_RELEASE_CHANNEL");
  }

  if (envSummary.JIUM_DESKTOP_UPDATE_URL !== "SET_HTTPS") {
    errors.push("desktop update URL must be set to HTTPS: JIUM_DESKTOP_UPDATE_URL");
  }

  if (envSummary.SIGNING_PROFILE_COUNT < 1) {
    errors.push("desktop signing profile missing: configure Windows, Apple, or Linux signing");
  }

  return {
    valid: errors.length === 0,
    errors,
    envSummary,
    staticExport,
    requiredFiles: [...REQUIRED_DESKTOP_FILES],
    requiredScripts: [...REQUIRED_DESKTOP_PACKAGE_SCRIPTS],
    requiredRuntimeDependencies: [...REQUIRED_DESKTOP_RUNTIME_DEPENDENCIES],
    requiredDevDependencies: [...REQUIRED_DESKTOP_DEV_DEPENDENCIES],
  };
}

export function buildDesktopReleaseReadinessReport(readiness, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const checks = [
    {
      id: "electron-shell",
      label: "Electron shell and preload bridge files are present",
      status: REQUIRED_DESKTOP_FILES.every((relativePath) => readiness.requiredFiles.includes(relativePath)) &&
        REQUIRED_DESKTOP_FILES.every((relativePath) => !readiness.errors.includes(`desktop file missing: ${relativePath}`))
          ? "PASS"
          : "BLOCKED",
    },
    {
      id: "desktop-scripts",
      label: "Desktop export and release report scripts are registered",
      status: REQUIRED_DESKTOP_PACKAGE_SCRIPTS.every((scriptName) => !readiness.errors.includes(`package script missing: ${scriptName}`))
        ? "PASS"
        : "BLOCKED",
    },
    {
      id: "desktop-static-export",
      label: "Static export exists without the GitHub Pages basePath",
      status: readiness.staticExport.valid ? "PASS" : "BLOCKED",
    },
    {
      id: "packaging-config",
      label: "Electron builder configuration and packaging dependencies are present",
      status: readiness.errors.some((error) => error.includes("desktop dependency missing") || error.includes("electron-builder config"))
        ? "BLOCKED"
        : "PASS",
    },
    {
      id: "release-channel",
      label: "Release channel is configured",
      status: readiness.envSummary.JIUM_DESKTOP_RELEASE_CHANNEL === "SET" ? "PASS" : "BLOCKED",
    },
    {
      id: "update-url",
      label: "Desktop update URL is configured as HTTPS",
      status: readiness.envSummary.JIUM_DESKTOP_UPDATE_URL === "SET_HTTPS" ? "PASS" : "BLOCKED",
    },
    {
      id: "code-signing",
      label: "At least one platform signing profile is configured",
      status: readiness.envSummary.SIGNING_PROFILE_COUNT >= 1 ? "PASS" : "BLOCKED",
    },
  ];

  return {
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    summary: {
      errorCount: readiness.errors.length,
      signingProfileCount: readiness.envSummary.SIGNING_PROFILE_COUNT,
      staticRouteCount: readiness.staticExport.routeFiles.length,
      requiredStaticRouteCount: readiness.staticExport.requiredFiles.length,
    },
    envSummary: readiness.envSummary,
    checks,
    errors: [...readiness.errors],
    nextActions: readiness.errors.length ? Array.from(new Set(readiness.errors.map(nextActionFor))) : ["Proceed with signed desktop packaging on the approved release channel."],
    safetyNotes: [
      "This report intentionally redacts update endpoints, signing certificate paths, certificate hashes, team identifiers, and package signing key identifiers.",
      "Do not store credentials, raw victim indicators, URLs, invite links, onion addresses, emails, or phone numbers in this release report.",
      "A READY result proves technical release readiness only; legal, institution, and incident-response operating procedures still need human sign-off.",
    ],
  };
}

export function formatDesktopReleaseReadinessMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Release Readiness Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Signing profiles: ${report.summary.signingProfileCount}`,
    `- Static routes: ${report.summary.staticRouteCount}/${report.summary.requiredStaticRouteCount}`,
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
    "",
    "## Environment Summary",
    ...Object.entries(report.envSummary).map(([key, value]) => `- ${key}: ${value}`),
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
  const args = { format: "text", outputPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
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

function writeOutput(content, outputPath) {
  if (!outputPath) {
    console.log(content);
    return;
  }
  mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, content, "utf8");
  console.log(`Desktop release readiness report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  const result = validateDesktopReleaseReadiness();
  if (args.format !== "text") {
    const report = buildDesktopReleaseReadinessReport(result);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatDesktopReleaseReadinessMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!result.valid) {
      process.exit(1);
    }
    process.exit(0);
  }

  if (!result.valid) {
    console.error("Desktop release readiness check failed:");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(
    `Desktop release readiness passed: ${result.staticExport.routeFiles.length} route(s), ${result.envSummary.SIGNING_PROFILE_COUNT} signing profile(s)`,
  );
}
