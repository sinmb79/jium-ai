#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStaticHostingBundle,
  validateStaticHostingExport,
} from "./build-static-hosting-bundle.mjs";
import { auditSecurityHeaders, hasSecurityHeaderFailures } from "./security-headers-runtime.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_SCHEMA = "jium-public-hosting-go-live-preflight-v1";
export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_DIR = "dist/public-hosting-go-live-preflight";
export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_JSON = "public-hosting-go-live-preflight.json";
export const PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_MARKDOWN = "public-hosting-go-live-preflight.md";
export const HOSTED_AUDIT_CANDIDATE_JSON = "hosted-security-header-audit-candidate.json";
export const HOSTED_AUDIT_CANDIDATE_MARKDOWN = "hosted-security-header-audit-candidate.md";

const HOSTED_AUDIT_SCHEMA = "jium-security-header-url-audit-v1";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PROVIDER_TARGETS = ["Cloudflare Pages", "Netlify"];

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

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
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

function safePreparePreflightDir(root) {
  const resolved = path.resolve(root, PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_DIR);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_DIR) {
    throw new Error(`Refusing to clean unsafe public hosting preflight directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
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

    return {
      valid: true,
      fetchAllowed: false,
      targetUrlState: parsed.protocol === "http:" ? "HTTP_NOT_ALLOWED" : "UNSUPPORTED_SCHEME",
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
  return {
    key: result.key,
    status: result.status,
    expectedState: "REQUIRED",
    actualState: result.status === "pass" ? "SET_MATCH" : result.status === "missing" ? "MISSING" : "SET_DIFFERENT",
  };
}

function buildHostedAuditReport({ targetUrl, response, results, fetchError, generatedAt }) {
  const target = classifyTargetUrl(targetUrl);
  const counts = summarizeChecks(results);
  const errors = [];

  if (!target.valid) {
    errors.push({ code: "INVALID_TARGET_URL", message: "The target URL could not be parsed." });
  }
  if (target.targetUrlState === "HTTP_NOT_ALLOWED") {
    errors.push({ code: "REMOTE_HTTP_NOT_ALLOWED", message: "Remote production targets must use HTTPS." });
  }
  if (target.targetUrlState === "UNSUPPORTED_SCHEME") {
    errors.push({ code: "UNSUPPORTED_TARGET_SCHEME", message: "Only HTTPS targets and local HTTP verification targets are supported." });
  }
  if (fetchError) {
    errors.push({ code: "FETCH_FAILED", message: "The target could not be fetched. The raw target and network error are intentionally omitted." });
  }
  if (response && response.status >= 400) {
    errors.push({ code: "HTTP_STATUS_NOT_OK", message: `The target returned HTTP ${response.status}.` });
  }
  for (const result of results.filter((item) => item.status !== "pass")) {
    errors.push({ code: `SECURITY_HEADER_${result.status.toUpperCase()}`, header: result.key, status: result.status });
  }

  const blocked = errors.length > 0 || hasSecurityHeaderFailures(results);
  return {
    schema: HOSTED_AUDIT_SCHEMA,
    generatedAt,
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

async function defaultFetchTarget(targetUrl) {
  const response = await fetch(targetUrl, { redirect: "follow" });
  await response.arrayBuffer().catch(() => undefined);
  return response;
}

async function runHostedAudit({ targetUrl, generatedAt, fetcher = defaultFetchTarget }) {
  const target = classifyTargetUrl(targetUrl);
  let response;
  let results = [];
  let fetchError = null;

  if (target.fetchAllowed) {
    try {
      response = await fetcher(targetUrl);
      await response?.arrayBuffer?.().catch?.(() => undefined);
      results = auditSecurityHeaders(response?.headers || {});
    } catch (error) {
      fetchError = error;
    }
  }

  return buildHostedAuditReport({ targetUrl, response, results, fetchError, generatedAt });
}

async function resolveStaticHosting({ root, noBuild, generatedAt, runner }) {
  if (noBuild) {
    const readiness = validateStaticHostingExport({ root, outDir: path.join(root, "out") });
    return {
      status: readiness.valid ? "READY" : "BLOCKED",
      requiredFileCount: readiness.requiredFiles.length,
      foundFileCount: readiness.foundFiles.length,
      headerPolicyStatus: readiness.headerPolicyStatus,
      errors: [...readiness.errors],
    };
  }

  const result = await buildStaticHostingBundle({
    root,
    generatedAt,
    runner: runner || undefined,
  });
  return {
    status: result.summary.status,
    requiredFileCount: result.summary.summary.requiredFileCount,
    foundFileCount: result.summary.summary.foundFileCount,
    headerPolicyStatus: result.summary.summary.headerPolicyStatus,
    errors: [...result.summary.errors],
  };
}

function preflightErrors({ targetUrl, staticHosting, hostedAudit }) {
  const errors = [];
  if (!clean(targetUrl)) {
    errors.push("public hosting preflight target URL is required");
  }
  if (staticHosting.status !== "READY") {
    errors.push("static hosting bundle is not READY");
  }
  errors.push(...staticHosting.errors.map((error) => `static hosting: ${error}`));
  if (hostedAudit.summary.targetUrlState !== "HTTPS") {
    errors.push("public hosting preflight target must be an approved HTTPS production URL");
  }
  if (hostedAudit.summary.fetchState !== "COMPLETED") {
    errors.push("hosted response fetch did not complete");
  }
  if (typeof hostedAudit.summary.httpStatus !== "number" || hostedAudit.summary.httpStatus >= 400) {
    errors.push("hosted response HTTP status must be below 400");
  }
  if (hostedAudit.summary.failureCount > 0) {
    errors.push("hosted response is missing or mismatching required security headers");
  }
  return errors;
}

export async function buildPublicHostingGoLivePreflight({
  root = repoRoot,
  targetUrl = "",
  noBuild = false,
  generatedAt = new Date().toISOString(),
  fetcher = defaultFetchTarget,
  runner,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const staticHosting = await resolveStaticHosting({ root: resolvedRoot, noBuild, generatedAt, runner });
  const hostedAudit = clean(targetUrl)
    ? await runHostedAudit({ targetUrl, generatedAt, fetcher })
    : buildHostedAuditReport({ targetUrl, response: undefined, results: [], fetchError: null, generatedAt });
  const errors = preflightErrors({ targetUrl, staticHosting, hostedAudit });
  const status = errors.length ? "BLOCKED" : "READY";
  const preflightDir = safePreparePreflightDir(resolvedRoot);
  const auditCandidateRelative = `${PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_DIR}/${HOSTED_AUDIT_CANDIDATE_JSON}`;
  const applyCommand = `npm run ops:hosted-audit:apply -- --audit-report ${auditCandidateRelative}`;

  const report = {
    schema: PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_SCHEMA,
    generatedAt,
    status,
    version: readPackageVersion(resolvedRoot),
    providerTargets: [...PROVIDER_TARGETS],
    summary: {
      staticHostingStatus: staticHosting.status,
      staticRequiredFileCount: staticHosting.requiredFileCount,
      staticFoundFileCount: staticHosting.foundFileCount,
      staticHeaderPolicyStatus: staticHosting.headerPolicyStatus,
      hostedAuditStatus: hostedAudit.status,
      targetUrlState: hostedAudit.summary.targetUrlState,
      fetchState: hostedAudit.summary.fetchState,
      httpStatus: hostedAudit.summary.httpStatus,
      headerFailureCount: hostedAudit.summary.failureCount,
      hostedAuditCandidateStatus: "WRITTEN_REDACTED",
    },
    checks: [
      {
        id: "static-hosting-bundle",
        status: staticHosting.status === "READY" ? "PASS" : "BLOCKED",
        label: "Static export and _headers bundle are ready for a supported host.",
      },
      {
        id: "production-https-target",
        status: hostedAudit.summary.targetUrlState === "HTTPS" ? "PASS" : "BLOCKED",
        label: "The hosted target is an HTTPS production URL.",
      },
      {
        id: "hosted-security-headers",
        status: hostedAudit.status === "READY" ? "PASS" : "BLOCKED",
        label: "The hosted response enforces the repository security header policy.",
      },
    ],
    hostedAuditCandidate: {
      path: auditCandidateRelative,
      digest: sha256Text(JSON.stringify(hostedAudit)),
      schema: hostedAudit.schema,
      status: hostedAudit.status,
    },
    applyCommand: status === "READY" ? applyCommand : "",
    errors,
    nextActions:
      status === "READY"
        ? [
            `Apply the READY hosted audit evidence with ${applyCommand}.`,
            "Run npm run ops:onboarding:check and npm run ops:go-live:check after the public route approvals are recorded.",
          ]
        : [
            "Deploy dist/static-hosting-bundle/site to an approved _headers-capable provider such as Cloudflare Pages or Netlify.",
            "Run npm run public:hosting:preflight -- <approved-https-public-app-url> after DNS and HTTPS are active.",
            "Apply only a READY hosted audit candidate with npm run ops:hosted-audit:apply.",
          ],
    safetyNotes: [
      "This preflight stores status, counts, header names, and SHA-256 digests only.",
      "It does not store raw public URLs, host names, paths, query values, response header values, contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "A READY preflight proves the public host enforces required headers; it is not legal, support, institution, or final go-live approval.",
    ],
  };

  writeJson(path.join(preflightDir, HOSTED_AUDIT_CANDIDATE_JSON), hostedAudit);
  writeText(path.join(preflightDir, HOSTED_AUDIT_CANDIDATE_MARKDOWN), formatHostedAuditCandidateMarkdown(hostedAudit));
  writeJson(path.join(preflightDir, PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_JSON), report);
  writeText(path.join(preflightDir, PUBLIC_HOSTING_GO_LIVE_PREFLIGHT_MARKDOWN), formatPublicHostingGoLivePreflightMarkdown(report));

  return {
    valid: report.status === "READY",
    bundleDir: preflightDir,
    bundleDirRelative: relativePath(resolvedRoot, preflightDir),
    report,
    hostedAudit,
  };
}

function formatHostedAuditCandidateMarkdown(report) {
  const lines = [
    "# JiumAI Hosted Security Header Audit Candidate",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Target URL state: ${report.summary.targetUrlState}`,
    `- Fetch state: ${report.summary.fetchState}`,
    `- HTTP status: ${report.summary.httpStatus ?? "n/a"}`,
    `- Headers: ${report.summary.passCount}/${report.summary.checkedHeaderCount}`,
    `- Header failures: ${report.summary.failureCount}`,
    "",
    "## Blocking Reasons",
    ...(report.errors.length ? report.errors.map((error) => `- ${error.code}${error.header ? `: ${error.header}` : ""}`) : ["- None"]),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatPublicHostingGoLivePreflightMarkdown(report) {
  const lines = [
    "# JiumAI Public Hosting Go-Live Preflight",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Provider targets: ${report.providerTargets.join(", ")}`,
    `- Static hosting: ${report.summary.staticHostingStatus}`,
    `- Static files: ${report.summary.staticFoundFileCount}/${report.summary.staticRequiredFileCount}`,
    `- Static header policy: ${report.summary.staticHeaderPolicyStatus}`,
    `- Hosted audit: ${report.summary.hostedAuditStatus}`,
    `- Target URL state: ${report.summary.targetUrlState || "MISSING"}`,
    `- Fetch state: ${report.summary.fetchState || "MISSING"}`,
    `- HTTP status: ${report.summary.httpStatus ?? "n/a"}`,
    `- Header failures: ${report.summary.headerFailureCount}`,
    `- Hosted audit candidate: ${report.hostedAuditCandidate.path}`,
    `- Apply command: ${report.applyCommand || "BLOCKED"}`,
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

function writeOutputPath({ root, outputPath, format, report }) {
  if (!outputPath) {
    return;
  }
  const resolvedOutput = path.resolve(root, outputPath);
  if (!isPathInside(root, resolvedOutput)) {
    throw new Error("output path must stay inside the repository");
  }
  writeText(
    resolvedOutput,
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatPublicHostingGoLivePreflightMarkdown(report),
  );
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    targetUrl: "",
    noBuild: false,
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
    } else if (arg === "--url") {
      args.targetUrl = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--url=")) {
      args.targetUrl = arg.slice("--url=".length);
    } else if (arg === "--no-build") {
      args.noBuild = true;
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (!arg.startsWith("-") && !args.targetUrl) {
      args.targetUrl = arg;
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
    const result = await buildPublicHostingGoLivePreflight({
      root: args.root,
      targetUrl: args.targetUrl,
      noBuild: args.noBuild,
    });
    writeOutputPath({ root: args.root, outputPath: args.outputPath, format: args.format, report: result.report });
    const rendered = args.format === "json" ? `${JSON.stringify(result.report, null, 2)}\n` : formatPublicHostingGoLivePreflightMarkdown(result.report);
    process.stdout.write(rendered);
    if (args.outputPath) {
      console.log(`Public hosting go-live preflight written: ${args.outputPath}`);
    } else {
      console.log(`Public hosting go-live preflight written: ${result.bundleDirRelative}`);
    }
    if (!result.valid) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
