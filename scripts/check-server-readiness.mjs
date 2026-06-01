#!/usr/bin/env node
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  TRUSTED_KEY_REGISTRY_PATH,
  loadTrustedAuthorizedFeedKeyRegistry,
  validateTrustedAuthorizedFeedKeyRegistry,
} from "./check-authorized-feed-keys.mjs";
import { truthy, validateDeploymentProfile } from "./check-deployment-profile.mjs";
import { listServerRouteTemplates } from "./materialize-server-routes.mjs";

export const REQUIRED_SERVER_ROUTE_TEMPLATES = [
  "api/institution/accounts/route.ts",
  "api/institution/audit-ledger/route.ts",
  "api/institution/login/route.ts",
  "api/institution/logout/route.ts",
  "api/institution/session/route.ts",
];

export const REQUIRED_SERVER_ENV_KEYS = [
  "JIUM_SERVER_ROUTES",
  "INSTITUTION_SESSION_SECRET",
  "INSTITUTION_ALLOWED_ORIGINS",
  "INSTITUTION_AUDIT_LEDGER_DIR",
  "INSTITUTION_ACCOUNT_REGISTRY_DIR",
  "INSTITUTION_SECURE_COOKIES",
];

function parseIso(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isActiveTrustedKey(key, now = Date.now()) {
  const validFrom = parseIso(key.validFrom);
  const validUntil = parseIso(key.validUntil);
  return (!Number.isFinite(validFrom) || validFrom <= now) && (!Number.isFinite(validUntil) || validUntil > now);
}

function present(value) {
  return Boolean(String(value || "").trim());
}

function csvCount(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean).length;
}

export function summarizeServerRuntimeEnv(env = process.env) {
  return {
    JIUM_SERVER_ROUTES: truthy(env.JIUM_SERVER_ROUTES) ? "TRUE" : "MISSING_OR_FALSE",
    GITHUB_PAGES: truthy(env.GITHUB_PAGES) ? "TRUE_BLOCKED" : "NOT_TRUE",
    INSTITUTION_SESSION_SECRET: present(env.INSTITUTION_SESSION_SECRET) ? "SET" : "MISSING",
    NEXT_PUBLIC_INSTITUTION_SESSION_SECRET: present(env.NEXT_PUBLIC_INSTITUTION_SESSION_SECRET) ? "SET_BLOCKED" : "NOT_SET",
    INSTITUTION_ALLOWED_ORIGINS: present(env.INSTITUTION_ALLOWED_ORIGINS) ? "SET" : "MISSING",
    INSTITUTION_ALLOWED_ORIGINS_COUNT: csvCount(env.INSTITUTION_ALLOWED_ORIGINS),
    INSTITUTION_AUDIT_LEDGER_DIR: present(env.INSTITUTION_AUDIT_LEDGER_DIR) ? "SET" : "MISSING",
    INSTITUTION_ACCOUNT_REGISTRY_DIR: present(env.INSTITUTION_ACCOUNT_REGISTRY_DIR) ? "SET" : "MISSING",
    INSTITUTION_SECURE_COOKIES: String(env.INSTITUTION_SECURE_COOKIES || "").toLowerCase() === "false" ? "FALSE" : "DEFAULT_OR_TRUE",
  };
}

export function validateServerRuntimeReadiness({
  root = process.cwd(),
  templateRoot = path.join(root, "server-route-templates", "app"),
  env = process.env,
} = {}) {
  const errors = [];
  const deployment = validateDeploymentProfile(env, root);
  const envSummary = summarizeServerRuntimeEnv(env);

  if (!truthy(env.JIUM_SERVER_ROUTES)) {
    errors.push("JIUM_SERVER_ROUTES=true is required for server runtime readiness");
  }
  if (truthy(env.GITHUB_PAGES)) {
    errors.push("GITHUB_PAGES=true cannot be used for server runtime readiness");
  }
  deployment.errors.forEach((error) => errors.push(`deployment profile: ${error}`));

  let keyCount = 0;
  let activeKeyCount = 0;
  try {
    const registry = loadTrustedAuthorizedFeedKeyRegistry(path.resolve(root, TRUSTED_KEY_REGISTRY_PATH));
    const keyErrors = validateTrustedAuthorizedFeedKeyRegistry(registry);
    keyErrors.forEach((error) => errors.push(`trusted key registry: ${error}`));
    keyCount = Array.isArray(registry.keys) ? registry.keys.length : 0;
    activeKeyCount = Array.isArray(registry.keys) ? registry.keys.filter((key) => isActiveTrustedKey(key)).length : 0;
    if (keyCount < 1) {
      errors.push(
        `trusted key registry: at least one ${AUTHORIZED_FEED_SIGNATURE_ALGORITHM} institution public key is required`,
      );
    }
    if (keyCount >= 1 && activeKeyCount < 1) {
      errors.push(`trusted key registry: at least one active ${AUTHORIZED_FEED_SIGNATURE_ALGORITHM} institution public key is required`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`trusted key registry: could not load ${TRUSTED_KEY_REGISTRY_PATH}: ${message}`);
  }

  const templateFiles = listServerRouteTemplates(templateRoot).map((template) => template.relativePath).sort();
  for (const required of REQUIRED_SERVER_ROUTE_TEMPLATES) {
    if (!templateFiles.includes(required)) {
      errors.push(`server route template missing: ${required}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    profile: deployment.profile,
    keyCount,
    activeKeyCount,
    templateFiles,
    envSummary,
  };
}

function statusFor(errorNeedle, errors) {
  return errors.some((error) => error.includes(errorNeedle)) ? "BLOCKED" : "PASS";
}

function nextActionFor(error) {
  if (error.includes("JIUM_SERVER_ROUTES=true")) {
    return "Set JIUM_SERVER_ROUTES=true only for server deployments.";
  }
  if (error.includes("GITHUB_PAGES=true")) {
    return "Disable GITHUB_PAGES for the server runtime profile.";
  }
  if (error.includes("INSTITUTION_SESSION_SECRET")) {
    return "Set a server-only high-entropy INSTITUTION_SESSION_SECRET and keep it out of NEXT_PUBLIC_*.";
  }
  if (error.includes("INSTITUTION_ALLOWED_ORIGINS")) {
    return "Set INSTITUTION_ALLOWED_ORIGINS to the exact trusted operator origin list.";
  }
  if (error.includes("INSTITUTION_AUDIT_LEDGER_DIR")) {
    return "Set INSTITUTION_AUDIT_LEDGER_DIR to an access-controlled append-only storage path.";
  }
  if (error.includes("INSTITUTION_ACCOUNT_REGISTRY_DIR")) {
    return "Set INSTITUTION_ACCOUNT_REGISTRY_DIR to an access-controlled account registry path.";
  }
  if (error.includes("trusted key registry")) {
    return "Approve and register at least one active institution public key.";
  }
  if (error.includes("server route template missing")) {
    return "Restore all required server route templates before materializing server routes.";
  }
  return "Review and resolve this readiness error before production deployment.";
}

export function buildServerRuntimeReadinessReport(readiness, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const checks = [
    {
      id: "server-route-profile",
      label: "Server route profile is enabled and GitHub Pages mode is disabled",
      status: readiness.envSummary.JIUM_SERVER_ROUTES === "TRUE" && readiness.envSummary.GITHUB_PAGES === "NOT_TRUE" ? "PASS" : "BLOCKED",
    },
    {
      id: "server-secret",
      label: "Server-only institution session secret is present and not public",
      status:
        readiness.envSummary.INSTITUTION_SESSION_SECRET === "SET" &&
        readiness.envSummary.NEXT_PUBLIC_INSTITUTION_SESSION_SECRET === "NOT_SET"
          ? "PASS"
          : "BLOCKED",
    },
    {
      id: "trusted-origins",
      label: "Trusted institution origins are configured",
      status: readiness.envSummary.INSTITUTION_ALLOWED_ORIGINS === "SET" ? "PASS" : "BLOCKED",
    },
    {
      id: "storage-paths",
      label: "Audit ledger and account registry storage paths are configured",
      status:
        readiness.envSummary.INSTITUTION_AUDIT_LEDGER_DIR === "SET" &&
        readiness.envSummary.INSTITUTION_ACCOUNT_REGISTRY_DIR === "SET"
          ? "PASS"
          : "BLOCKED",
    },
    {
      id: "trusted-public-key",
      label: "At least one active institution public key is registered",
      status: readiness.activeKeyCount >= 1 ? "PASS" : "BLOCKED",
    },
    {
      id: "route-templates",
      label: "All required server route templates are present",
      status: REQUIRED_SERVER_ROUTE_TEMPLATES.every((required) => readiness.templateFiles.includes(required)) ? "PASS" : "BLOCKED",
    },
    {
      id: "deployment-profile",
      label: "Deployment profile guard passes",
      status: statusFor("deployment profile:", readiness.errors),
    },
  ];
  return {
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    profile: readiness.profile,
    summary: {
      errorCount: readiness.errors.length,
      keyCount: readiness.keyCount,
      activeKeyCount: readiness.activeKeyCount,
      routeTemplateCount: readiness.templateFiles.length,
      requiredRouteTemplateCount: REQUIRED_SERVER_ROUTE_TEMPLATES.length,
      allowedOriginCount: readiness.envSummary.INSTITUTION_ALLOWED_ORIGINS_COUNT,
    },
    envSummary: readiness.envSummary,
    checks,
    errors: [...readiness.errors],
    nextActions: readiness.errors.length ? Array.from(new Set(readiness.errors.map(nextActionFor))) : ["Proceed with controlled server build and deployment approval."],
    safetyNotes: [
      "This report intentionally redacts secret values, trusted origins, and filesystem paths.",
      "Do not store credentials, session tokens, raw victim indicators, URLs, invite links, onion addresses, emails, or phone numbers in the report.",
      "A READY result proves technical readiness only; institution approval and operating procedures still need human sign-off.",
    ],
  };
}

export function formatServerRuntimeReadinessMarkdown(report) {
  const lines = [
    "# JiumAI Server Runtime Readiness Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Profile: ${report.profile}`,
    `- Active trusted keys: ${report.summary.activeKeyCount}/${report.summary.keyCount}`,
    `- Route templates: ${report.summary.routeTemplateCount}/${report.summary.requiredRouteTemplateCount}`,
    `- Trusted origin count: ${report.summary.allowedOriginCount}`,
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
  console.log(`Server runtime readiness report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const result = validateServerRuntimeReadiness();
  const args = parseCliArgs(process.argv.slice(2));
  if (args.format !== "text") {
    const report = buildServerRuntimeReadinessReport(result);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatServerRuntimeReadinessMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!result.valid) {
      process.exit(1);
    }
    process.exit(0);
  }
  if (!result.valid) {
    console.error("Server runtime readiness check failed:");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(
    `Server runtime readiness passed: ${result.activeKeyCount}/${result.keyCount} active trusted key(s), ${result.templateFiles.length} route template(s)`,
  );
}
