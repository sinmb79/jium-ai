#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { auditSecurityHeaders, hasSecurityHeaderFailures } from "./security-headers-runtime.mjs";

const REPORT_SCHEMA = "jium-security-header-url-audit-v1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function usage() {
  return [
    "Usage: npm run security:headers:check -- <url> [--json|--markdown] [--output <path>]",
    "Example: npm run security:headers:check -- https://example.com --json --output dist/security-header-audit.json",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    format: "text",
    outputPath: "",
    targetUrl: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--json") {
      options.format = "json";
      continue;
    }

    if (arg === "--markdown") {
      options.format = "markdown";
      continue;
    }

    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output requires a file path");
      }
      options.outputPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      options.outputPath = arg.slice("--output=".length);
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.targetUrl) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    options.targetUrl = arg;
  }

  options.targetUrl ||= process.env.SECURITY_HEADER_URL || "";
  return options;
}

function isLocalHost(hostname) {
  const normalized = hostname.toLowerCase();
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith(".localhost");
}

function classifyTargetUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const local = isLocalHost(parsed.hostname);

    if (parsed.protocol === "https:") {
      return {
        valid: true,
        fetchAllowed: true,
        targetUrlState: "HTTPS",
        hasPath: parsed.pathname !== "" && parsed.pathname !== "/",
        hasQuery: parsed.search.length > 0,
        hasFragment: parsed.hash.length > 0,
      };
    }

    if (parsed.protocol === "http:" && local) {
      return {
        valid: true,
        fetchAllowed: true,
        targetUrlState: "LOCAL_HTTP",
        hasPath: parsed.pathname !== "" && parsed.pathname !== "/",
        hasQuery: parsed.search.length > 0,
        hasFragment: parsed.hash.length > 0,
      };
    }

    if (parsed.protocol === "http:") {
      return {
        valid: true,
        fetchAllowed: false,
        targetUrlState: "HTTP_NOT_ALLOWED",
        hasPath: parsed.pathname !== "" && parsed.pathname !== "/",
        hasQuery: parsed.search.length > 0,
        hasFragment: parsed.hash.length > 0,
      };
    }

    return {
      valid: true,
      fetchAllowed: false,
      targetUrlState: "UNSUPPORTED_SCHEME",
      hasPath: parsed.pathname !== "" && parsed.pathname !== "/",
      hasQuery: parsed.search.length > 0,
      hasFragment: parsed.hash.length > 0,
    };
  } catch {
    return {
      valid: false,
      fetchAllowed: false,
      targetUrlState: "INVALID",
      hasPath: false,
      hasQuery: false,
      hasFragment: false,
    };
  }
}

function summarizeChecks(results) {
  const passCount = results.filter((result) => result.status === "pass").length;
  const missingCount = results.filter((result) => result.status === "missing").length;
  const mismatchCount = results.filter((result) => result.status === "mismatch").length;

  return {
    checkedHeaderCount: results.length,
    passCount,
    failureCount: results.length - passCount,
    missingCount,
    mismatchCount,
  };
}

function redactCheck(result) {
  const actualState = result.status === "pass" ? "SET_MATCH" : result.status === "missing" ? "MISSING" : "SET_DIFFERENT";
  return {
    key: result.key,
    status: result.status,
    expectedState: "REQUIRED",
    actualState,
  };
}

function buildReport({ targetUrl, response, results, fetchError }) {
  const target = classifyTargetUrl(targetUrl);
  const counts = summarizeChecks(results);
  const errors = [];

  if (!target.valid) {
    errors.push({
      code: "INVALID_TARGET_URL",
      message: "The target URL could not be parsed.",
    });
  }

  if (target.targetUrlState === "HTTP_NOT_ALLOWED") {
    errors.push({
      code: "REMOTE_HTTP_NOT_ALLOWED",
      message: "Remote production targets must use HTTPS. Local HTTP is accepted only for localhost verification.",
    });
  }

  if (target.targetUrlState === "UNSUPPORTED_SCHEME") {
    errors.push({
      code: "UNSUPPORTED_TARGET_SCHEME",
      message: "Only HTTPS targets and local HTTP verification targets are supported.",
    });
  }

  if (fetchError) {
    errors.push({
      code: "FETCH_FAILED",
      message: "The target could not be fetched. The raw target and network error are intentionally omitted from this report.",
    });
  }

  if (response && response.status >= 400) {
    errors.push({
      code: "HTTP_STATUS_NOT_OK",
      message: `The target returned HTTP ${response.status}.`,
    });
  }

  for (const result of results.filter((item) => item.status !== "pass")) {
    errors.push({
      code: `SECURITY_HEADER_${result.status.toUpperCase()}`,
      header: result.key,
      status: result.status,
    });
  }

  const blocked = errors.length > 0 || hasSecurityHeaderFailures(results);

  return {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    status: blocked ? "BLOCKED" : "READY",
    summary: {
      targetUrlState: target.targetUrlState,
      fetchState: fetchError ? "FAILED" : target.fetchAllowed ? "COMPLETED" : "SKIPPED",
      httpStatus: response?.status ?? null,
      hasPath: target.hasPath,
      hasQuery: target.hasQuery,
      hasFragment: target.hasFragment,
      ...counts,
    },
    checks: results.map(redactCheck),
    errors,
    safetyNotes: [
      "The raw target URL, host, path, query, and response header values are intentionally omitted.",
      "Use LOCAL_HTTP only for local automated verification; production evidence should target HTTPS endpoints.",
    ],
  };
}

function renderText(report) {
  const lines = [
    "JiumAI Security Header URL Audit",
    `Schema: ${report.schema}`,
    `Status: ${report.status}`,
    `Target URL state: ${report.summary.targetUrlState}`,
    `Fetch state: ${report.summary.fetchState}`,
    `HTTP status: ${report.summary.httpStatus ?? "n/a"}`,
    `Headers: ${report.summary.passCount} pass, ${report.summary.failureCount} blocked`,
    "",
    ...report.checks.map((check) => `${check.status === "pass" ? "PASS" : "FAIL"} ${check.key}: ${check.status}`),
  ];

  if (report.errors.length > 0) {
    lines.push("", "Blocking reasons:");
    lines.push(...report.errors.map((error) => `- ${error.header ? `${error.header}: ` : ""}${error.code}`));
  }

  return lines.join("\n");
}

function renderMarkdown(report) {
  return [
    "# JiumAI Security Header URL Audit",
    "",
    `- Schema: \`${report.schema}\``,
    `- Status: \`${report.status}\``,
    `- Target URL state: \`${report.summary.targetUrlState}\``,
    `- Fetch state: \`${report.summary.fetchState}\``,
    `- HTTP status: \`${report.summary.httpStatus ?? "n/a"}\``,
    `- Headers: ${report.summary.passCount} pass / ${report.summary.failureCount} blocked`,
    "",
    "| Header | Status | Actual state |",
    "| --- | --- | --- |",
    ...report.checks.map((check) => `| ${check.key} | ${check.status} | ${check.actualState} |`),
    "",
    "## Blocking Reasons",
    "",
    ...(report.errors.length > 0 ? report.errors.map((error) => `- \`${error.code}\`${error.header ? `: ${error.header}` : ""}`) : ["- None"]),
    "",
    "## Safety Notes",
    "",
    ...report.safetyNotes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}

function renderReport(report, format) {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  if (format === "markdown") {
    return renderMarkdown(report);
  }

  return `${renderText(report)}\n`;
}

function writeReport(outputPath, contents) {
  if (!outputPath) {
    return;
  }

  const dir = path.dirname(outputPath);
  if (dir && dir !== ".") {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(outputPath, contents, "utf8");
}

async function fetchTarget(targetUrl) {
  const response = await fetch(targetUrl, { redirect: "follow" });
  await response.arrayBuffer().catch(() => undefined);
  return response;
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage());
  process.exit(2);
}

if (options.help || !options.targetUrl) {
  console.error(usage());
  process.exitCode = options.help ? 0 : 2;
} else {
  const target = classifyTargetUrl(options.targetUrl);
  let response;
  let results = [];
  let fetchError = null;

  if (target.fetchAllowed) {
    try {
      response = await fetchTarget(options.targetUrl);
      results = auditSecurityHeaders(response.headers);
    } catch (error) {
      fetchError = error;
    }
  }

  const report = buildReport({
    targetUrl: options.targetUrl,
    response,
    results,
    fetchError,
  });
  const rendered = renderReport(report, options.format);

  writeReport(options.outputPath, rendered);
  process.stdout.write(rendered);

  if (report.status !== "READY") {
    process.exitCode = 1;
  }
}
