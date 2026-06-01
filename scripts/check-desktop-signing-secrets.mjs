#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function present(value) {
  return Boolean(String(value || "").trim());
}

function updateUrlStatus(value) {
  if (!present(value)) {
    return "MISSING";
  }
  try {
    return new URL(String(value)).protocol === "https:" ? "SET_HTTPS" : "SET_NOT_HTTPS";
  } catch {
    return "SET_INVALID";
  }
}

function paired(left, right) {
  return present(left) && present(right);
}

export function summarizeDesktopSigningSecrets(env = process.env) {
  const genericCsc = paired(env.CSC_LINK, env.CSC_KEY_PASSWORD);
  const windowsCsc = paired(env.WIN_CSC_LINK, env.WIN_CSC_KEY_PASSWORD);
  const windowsFile = paired(env.WINDOWS_SIGNING_CERT_PATH, env.WINDOWS_SIGNING_CERT_PASSWORD);
  const windowsAzureTrustedSigning = present(env.AZURE_TENANT_ID) &&
    present(env.AZURE_CLIENT_ID) &&
    present(env.AZURE_CLIENT_SECRET) &&
    present(env.AZURE_TRUSTED_SIGNING_ACCOUNT_NAME) &&
    present(env.AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME);
  return {
    JIUM_DESKTOP_RELEASE_CHANNEL: present(env.JIUM_DESKTOP_RELEASE_CHANNEL) ? "SET" : "MISSING",
    JIUM_DESKTOP_UPDATE_URL: updateUrlStatus(env.JIUM_DESKTOP_UPDATE_URL),
    CSC_LINK: present(env.CSC_LINK) ? "SET" : "MISSING",
    CSC_KEY_PASSWORD: present(env.CSC_KEY_PASSWORD) ? "SET" : "MISSING",
    WIN_CSC_LINK: present(env.WIN_CSC_LINK) ? "SET" : "MISSING",
    WIN_CSC_KEY_PASSWORD: present(env.WIN_CSC_KEY_PASSWORD) ? "SET" : "MISSING",
    WINDOWS_SIGNING_CERT_PATH: present(env.WINDOWS_SIGNING_CERT_PATH) ? "SET" : "MISSING",
    WINDOWS_SIGNING_CERT_PASSWORD: present(env.WINDOWS_SIGNING_CERT_PASSWORD) ? "SET" : "MISSING",
    WINDOWS_SIGNING_CERT_SHA256: present(env.WINDOWS_SIGNING_CERT_SHA256) ? "SET" : "MISSING",
    AZURE_TRUSTED_SIGNING_PROFILE: windowsAzureTrustedSigning ? "SET" : "MISSING",
    WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE: genericCsc || windowsCsc || windowsFile || windowsAzureTrustedSigning ? "SET" : "MISSING",
  };
}

function nextActionFor(error) {
  if (error.includes("release channel")) {
    return "Set JIUM_DESKTOP_RELEASE_CHANNEL for the approved desktop lane.";
  }
  if (error.includes("update URL")) {
    return "Set JIUM_DESKTOP_UPDATE_URL to the approved HTTPS generic updater endpoint.";
  }
  if (error.includes("Windows electron-builder signing profile")) {
    return "Configure CSC_LINK/CSC_KEY_PASSWORD, WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD, WINDOWS_SIGNING_CERT_PATH/WINDOWS_SIGNING_CERT_PASSWORD, or Azure Trusted Signing secrets.";
  }
  return "Resolve the desktop signing secret preflight error before signed packaging.";
}

export function validateDesktopSigningSecrets({ env = process.env } = {}) {
  const summary = summarizeDesktopSigningSecrets(env);
  const errors = [];
  if (summary.JIUM_DESKTOP_RELEASE_CHANNEL !== "SET") {
    errors.push("desktop signed release channel missing: JIUM_DESKTOP_RELEASE_CHANNEL");
  }
  if (summary.JIUM_DESKTOP_UPDATE_URL !== "SET_HTTPS") {
    errors.push("desktop signed release update URL must be HTTPS: JIUM_DESKTOP_UPDATE_URL");
  }
  if (summary.WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE !== "SET") {
    errors.push("desktop Windows electron-builder signing profile missing");
  }
  return {
    valid: errors.length === 0,
    errors,
    summary,
  };
}

export function buildDesktopSigningSecretsReport(validation, options = {}) {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: validation.valid ? "READY" : "BLOCKED",
    summary: validation.summary,
    errors: [...validation.errors],
    nextActions: validation.errors.length
      ? Array.from(new Set(validation.errors.map(nextActionFor)))
      : ["Proceed with signed desktop packaging, then validate the generated update feed metadata."],
    safetyNotes: [
      "This report records only whether signing-related settings are present.",
      "It never stores certificate file paths, certificate payloads, passwords, Azure secret values, update endpoint values, victim indicators, raw URLs, invite links, onion addresses, emails, or phone numbers.",
      "A READY result means the signed packaging environment is plausibly configured; the installer and update metadata must still be built and verified.",
    ],
  };
}

export function formatDesktopSigningSecretsMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Signing Secret Preflight",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    "",
    "## Redacted Summary",
    ...Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value}`),
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
  console.log(`Desktop signing secret preflight report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  const validation = validateDesktopSigningSecrets({ root: repoRoot });
  const report = buildDesktopSigningSecretsReport(validation);
  const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatDesktopSigningSecretsMarkdown(report);
  writeOutput(content, args.outputPath);
  if (!validation.valid) {
    process.exit(1);
  }
}
