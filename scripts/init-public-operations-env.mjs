#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const PUBLIC_OPERATIONS_ENDPOINTS = [
  { envKey: "JIUM_PUBLIC_APP_URL", routePath: "/", routeSuffix: "" },
  { envKey: "JIUM_PRIVACY_NOTICE_URL", routePath: "/privacy/", routeSuffix: "privacy/" },
  { envKey: "JIUM_SUPPORT_CONTACT_ROUTE", routePath: "/support/", routeSuffix: "support/" },
];

function clean(value) {
  return String(value || "").trim();
}

function hasPlaceholder(value) {
  return /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|CHANGE[-_ ]?ME)\b/i.test(value);
}

function httpsUrlStatus(value) {
  const text = clean(value);
  if (!text) {
    return "MISSING";
  }
  if (hasPlaceholder(text)) {
    return "PLACEHOLDER";
  }
  try {
    return new URL(text).protocol === "https:" ? "SET_HTTPS" : "SET_NOT_HTTPS";
  } catch {
    return "SET_INVALID";
  }
}

function normalizeRepository(value) {
  const text = clean(value).replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text)) {
    return "";
  }
  return text;
}

function githubPagesBaseUrl(repository) {
  const normalized = normalizeRepository(repository);
  if (!normalized) {
    return "";
  }
  const [owner, repo] = normalized.split("/");
  return `https://${owner}.github.io/${repo}/`;
}

function normalizeBaseUrl(value) {
  const text = clean(value);
  if (!text) {
    return { status: "MISSING", baseUrl: "", error: "A HTTPS public base URL or GITHUB_REPOSITORY is required." };
  }
  if (hasPlaceholder(text)) {
    return { status: "PLACEHOLDER", baseUrl: "", error: "Public base URL still contains a placeholder value." };
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:") {
      return { status: "SET_NOT_HTTPS", baseUrl: "", error: "Public base URL must use HTTPS." };
    }
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return { status: "SET_HTTPS", baseUrl: parsed.toString(), error: "" };
  } catch {
    return { status: "SET_INVALID", baseUrl: "", error: "Public base URL is not a valid URL." };
  }
}

function publicBaseUrl({ baseUrl, env }) {
  const explicitBaseUrl = clean(baseUrl) || clean(env.JIUM_PUBLIC_BASE_URL);
  if (explicitBaseUrl) {
    return normalizeBaseUrl(explicitBaseUrl);
  }
  const fromRepository = githubPagesBaseUrl(env.GITHUB_REPOSITORY);
  if (fromRepository) {
    return normalizeBaseUrl(fromRepository);
  }
  return normalizeBaseUrl("");
}

function endpointValues(baseUrl) {
  return Object.fromEntries(
    PUBLIC_OPERATIONS_ENDPOINTS.map((endpoint) => [endpoint.envKey, new URL(endpoint.routeSuffix, baseUrl).toString()]),
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

function updateEnvFile({ root, envPath, values, forceEnv }) {
  const resolvedEnvPath = path.resolve(root, envPath);
  const existingContent = existsSync(resolvedEnvPath) ? readFileSync(resolvedEnvPath, "utf8") : "";
  const lines = existingContent ? existingContent.replace(/\r\n/g, "\n").split("\n") : ["# JiumAI private public-operations env"];
  const keyStatuses = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, upsertEnvLine(lines, key, value, { force: forceEnv })]),
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

function endpointSummaries(values) {
  return PUBLIC_OPERATIONS_ENDPOINTS.map((endpoint) => ({
    envKey: endpoint.envKey,
    routePath: endpoint.routePath,
    urlStatus: httpsUrlStatus(values[endpoint.envKey]),
  }));
}

function endpointErrors(endpoints) {
  return endpoints
    .filter((endpoint) => endpoint.urlStatus !== "SET_HTTPS")
    .map((endpoint) => `${endpoint.envKey} must resolve to a HTTPS URL before go-live.`);
}

export function buildPublicOperationsEnvPlan({
  root = repoRoot,
  env = process.env,
  baseUrl = "",
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  writeEnv = false,
  forceEnv = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const base = publicBaseUrl({ baseUrl, env });
  const baseErrors = base.error ? [base.error] : [];
  const derivedValues = base.baseUrl ? endpointValues(base.baseUrl) : {};
  const envUpdate =
    writeEnv && base.baseUrl
      ? updateEnvFile({ root: resolvedRoot, envPath, values: derivedValues, forceEnv })
      : {
          envPath,
          envPathRelative: envPath.replace(/\\/g, "/"),
          status: "SKIPPED",
          keyStatuses: Object.fromEntries(PUBLIC_OPERATIONS_ENDPOINTS.map((endpoint) => [endpoint.envKey, "SKIPPED"])),
          updatedEnv: {},
        };
  const finalValues = writeEnv && base.baseUrl ? { ...derivedValues, ...envUpdate.updatedEnv } : derivedValues;
  const endpoints = endpointSummaries(finalValues);
  const errors = [...baseErrors, ...endpointErrors(endpoints)];

  return {
    schema: "jium-public-operations-env-init-v1",
    generatedAt,
    status: errors.length ? "BLOCKED" : "READY",
    summary: {
      endpointCount: PUBLIC_OPERATIONS_ENDPOINTS.length,
      httpsUrlCount: endpoints.filter((endpoint) => endpoint.urlStatus === "SET_HTTPS").length,
      envUpdateStatus: envUpdate.status,
      baseUrlStatus: base.status,
    },
    envFile: {
      path: envUpdate.envPathRelative,
      status: envUpdate.status,
      keyStatuses: envUpdate.keyStatuses,
    },
    endpoints,
    errors,
    nextActions: errors.length
      ? [
          "Review and set the approved HTTPS public base URL before updating production go-live env.",
          "Run npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env after the public pages are deployed.",
        ]
      : [
          "Review the generated private env values with the go-live approver before setting approval flags.",
          "Run npm run ops:go-live:check after legal, support, incident-response, server, and desktop gates are ready.",
        ],
    safetyNotes: [
      "This report redacts raw public URLs and records only route names, URL validity states, counts, and env key statuses.",
      "The private env file may contain the real public app, privacy notice, and support route URLs; keep it out of public reports.",
      "This helper does not approve go-live, legal review, data retention, support staffing, or incident response ownership.",
    ],
  };
}

export function formatPublicOperationsEnvMarkdown(plan) {
  const lines = [
    "# JiumAI Public Operations Env Init Report",
    "",
    `- Generated at: ${plan.generatedAt}`,
    `- Status: ${plan.status}`,
    `- Base URL status: ${plan.summary.baseUrlStatus}`,
    `- HTTPS routes: ${plan.summary.httpsUrlCount}/${plan.summary.endpointCount}`,
    `- Env update: ${plan.summary.envUpdateStatus}`,
    `- Env file: ${plan.envFile.path}`,
    "",
    "## Endpoints",
    ...plan.endpoints.map((endpoint) => `- ${endpoint.envKey}: ${endpoint.routePath} (${endpoint.urlStatus})`),
    "",
    "## Env Key Status",
    ...Object.entries(plan.envFile.keyStatuses).map(([key, status]) => `- ${key}: ${status}`),
    "",
    "## Next Actions",
    ...plan.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...plan.safetyNotes.map((note) => `- ${note}`),
  ];
  if (plan.errors.length) {
    lines.splice(12, 0, "", "## Errors", ...plan.errors.map((error) => `- ${error}`));
  }
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = {
    format: "text",
    outputPath: "",
    root: repoRoot,
    envPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
    baseUrl: "",
    repository: "",
    writeEnv: false,
    forceEnv: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
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
    } else if (arg === "--base-url") {
      args.baseUrl = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      args.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--repository") {
      args.repository = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--repository=")) {
      args.repository = arg.slice("--repository=".length);
    } else if (arg === "--write-env") {
      args.writeEnv = true;
    } else if (arg === "--force-env") {
      args.forceEnv = true;
      args.writeEnv = true;
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
  console.log(`Public operations env init report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  const env = { ...process.env };
  if (args.repository) {
    env.GITHUB_REPOSITORY = args.repository;
  }
  const plan = buildPublicOperationsEnvPlan({ ...args, env, envPath: args.envPath });
  const content = args.format === "json" ? JSON.stringify(plan, null, 2) : formatPublicOperationsEnvMarkdown(plan);
  writeOutput(content, args.outputPath);
  if (plan.status !== "READY") {
    process.exit(1);
  }
}
