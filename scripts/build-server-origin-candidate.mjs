#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";
import { loadServerRuntimeEnvFile } from "./server-runtime-env-file.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const SERVER_ORIGIN_CANDIDATE_SCHEMA = "jium-server-origin-candidate-v1";
export const SERVER_ORIGIN_CANDIDATE_DIR = "dist/server-origin-candidate";
export const SERVER_ORIGIN_CANDIDATE_JSON = "server-origin-candidate-report.json";
export const SERVER_ORIGIN_CANDIDATE_MARKDOWN = "server-origin-candidate-report.md";
export const PRIVATE_SERVER_ORIGIN_CANDIDATE_DIR = "ops/private/server-origin-candidate";
export const PRIVATE_SERVER_ORIGIN_COMMAND = "server-origin-apply-command.md";

const PUBLIC_URL_KEYS = ["JIUM_PUBLIC_APP_URL", "JIUM_PRIVACY_NOTICE_URL", "JIUM_SUPPORT_CONTACT_ROUTE"];
const DEFAULT_APPROVAL_REF_PLACEHOLDER = "SERVER-ORIGIN-APPROVAL-REF";
const PLACEHOLDER_PATTERN = /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL|CHANGE[-_ ]?ME)\b/i;
const CONTACT_OR_INVITE_PATTERN =
  /\b(?:[a-z0-9.-]+\.onion\b|t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite\/)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/i;
const SECRET_PATTERN =
  /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i;

function clean(value) {
  return String(value || "").trim();
}

function present(value) {
  return Boolean(clean(value));
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "")).digest("hex")}`;
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

function assertSafeFixedDir(root, target, expectedRelative) {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== expectedRelative) {
    throw new Error(`Refusing to clean unsafe server origin candidate directory: ${resolved}`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = assertSafeFixedDir(root, SERVER_ORIGIN_CANDIDATE_DIR, SERVER_ORIGIN_CANDIDATE_DIR);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function safeClearPrivateCommandDir(root) {
  const resolved = assertSafeFixedDir(root, PRIVATE_SERVER_ORIGIN_CANDIDATE_DIR, PRIVATE_SERVER_ORIGIN_CANDIDATE_DIR);
  rmSync(resolved, { recursive: true, force: true });
  return resolved;
}

function classifySourceUrl(value) {
  const text = clean(value);
  const errors = [];
  if (!text) {
    return { status: "MISSING", origin: "", errors: ["source URL is missing"] };
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    errors.push("source URL contains placeholder");
  }
  if (CONTACT_OR_INVITE_PATTERN.test(text)) {
    errors.push("source URL contains invite, onion, or contact value");
  }
  if (SECRET_PATTERN.test(text)) {
    errors.push("source URL contains secret-like value");
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:") {
      errors.push("source URL must use HTTPS");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      errors.push("source URL must not include credentials, query, or fragment");
    }
    return {
      status: errors.length ? "BLOCKED" : "SET_HTTPS",
      origin: errors.length ? "" : parsed.origin,
      errors,
    };
  } catch {
    return { status: "SET_INVALID", origin: "", errors: ["source URL must be a valid URL"] };
  }
}

function classifyDirectOrigin(value) {
  const text = clean(value);
  const errors = [];
  if (!text) {
    return { status: "MISSING", origin: "", errors: ["origin is missing"] };
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    errors.push("origin contains placeholder");
  }
  if (CONTACT_OR_INVITE_PATTERN.test(text)) {
    errors.push("origin contains invite, onion, or contact value");
  }
  if (SECRET_PATTERN.test(text)) {
    errors.push("origin contains secret-like value");
  }
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:") {
      errors.push("origin must use HTTPS");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      errors.push("origin must be an origin only, without credentials, query, or fragment");
    }
    if (parsed.pathname && parsed.pathname !== "/") {
      errors.push("origin must be an origin only, without path");
    }
    return {
      status: errors.length ? "BLOCKED" : "SET_HTTPS_ORIGIN",
      origin: errors.length ? "" : parsed.origin,
      errors,
    };
  } catch {
    return { status: "SET_INVALID", origin: "", errors: ["origin must be a valid HTTPS origin"] };
  }
}

function sourceUrlSummaries(env, fromPublicEnv) {
  if (!fromPublicEnv) {
    return [];
  }
  return PUBLIC_URL_KEYS.map((envKey) => {
    const classified = classifySourceUrl(env[envKey]);
    return {
      envKey,
      status: classified.status,
      originDigest: classified.origin ? sha256Text(classified.origin) : "",
      origin: classified.origin,
      errors: classified.errors.map((error) => `${envKey}: ${error}`),
    };
  });
}

function directOriginSummaries(origins) {
  return Array.from(new Set((origins || []).flatMap((origin) => String(origin || "").split(",")).map((origin) => origin.trim()).filter(Boolean))).map(
    (origin, index) => {
      const classified = classifyDirectOrigin(origin);
      return {
        id: `direct-origin-${index + 1}`,
        status: classified.status,
        originDigest: classified.origin ? sha256Text(classified.origin) : "",
        origin: classified.origin,
        errors: classified.errors.map((error) => `direct origin ${index + 1}: ${error}`),
      };
    },
  );
}

function buildPrivateCommand(origins, approvalRefPlaceholder) {
  const originArgs = origins.map((origin) => `--origin "${origin}"`).join(" ");
  const approval = clean(approvalRefPlaceholder) || DEFAULT_APPROVAL_REF_PLACEHOLDER;
  return [
    "# JiumAI Private Server Origin Apply Command",
    "",
    "Review the origin list through the approved institution channel before running this command.",
    "",
    "```bash",
    `npm run server:origin:apply -- ${originArgs} --approval-ref "${approval}"`,
    "```",
    "",
    "This private command file may contain raw approved origins. Keep it inside ops/private.",
    "",
  ].join("\n");
}

function redactSourceUrls(sources) {
  return sources.map(({ envKey, status, originDigest }) => ({ envKey, status, originDigest }));
}

function redactDirectOrigins(sources) {
  return sources.map(({ id, status, originDigest }) => ({ id, status, originDigest }));
}

export async function buildServerOriginCandidate({
  root = repoRoot,
  env = process.env,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  fromPublicEnv = false,
  origins = [],
  approvalRefPlaceholder = DEFAULT_APPROVAL_REF_PLACEHOLDER,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const effectiveEnv = loadServerRuntimeEnvFile({ root: resolvedRoot, env, envPath });
  const reportDir = safePrepareReportDir(resolvedRoot);
  const privateDir = safeClearPrivateCommandDir(resolvedRoot);
  const sourceUrls = sourceUrlSummaries(effectiveEnv, fromPublicEnv);
  const directOrigins = directOriginSummaries(origins);
  const errors = [...sourceUrls.flatMap((source) => source.errors), ...directOrigins.flatMap((source) => source.errors)];
  if (!fromPublicEnv && directOrigins.length === 0) {
    errors.push("at least one source is required: pass --from-public-env or --origin");
  }

  const uniqueOrigins = Array.from(new Set([...sourceUrls.map((source) => source.origin), ...directOrigins.map((source) => source.origin)].filter(Boolean))).sort();
  if (!uniqueOrigins.length) {
    errors.push("at least one HTTPS origin candidate is required");
  }

  const valid = errors.length === 0;
  const commandText = valid ? buildPrivateCommand(uniqueOrigins, approvalRefPlaceholder) : "";
  const commandPath = path.join(privateDir, PRIVATE_SERVER_ORIGIN_COMMAND);
  if (valid) {
    writeText(commandPath, commandText);
  }

  const report = {
    schema: SERVER_ORIGIN_CANDIDATE_SCHEMA,
    generatedAt,
    status: valid ? "READY_FOR_ORIGIN_APPROVAL" : "BLOCKED",
    version: readPackageVersion(resolvedRoot),
    summary: {
      envPath: envPath.replace(/\\/g, "/"),
      sourceUrlKeyCount: sourceUrls.length,
      sourceUrlReadyCount: sourceUrls.filter((source) => source.status === "SET_HTTPS").length,
      directOriginCount: directOrigins.length,
      originCount: uniqueOrigins.length,
    },
    sourceUrls: redactSourceUrls(sourceUrls),
    directOrigins: redactDirectOrigins(directOrigins),
    privateCommand: {
      fileStatus: valid ? "WRITTEN" : "NOT_WRITTEN",
      path: `${PRIVATE_SERVER_ORIGIN_CANDIDATE_DIR}/${PRIVATE_SERVER_ORIGIN_COMMAND}`,
    },
    evidence: {
      originListDigest: uniqueOrigins.length ? sha256Text(uniqueOrigins.join(",")) : "",
      privateCommandDigest: valid ? sha256Text(commandText) : "",
    },
    errors,
    warnings: [],
    nextActions: valid
      ? [
          "Review the private server origin apply command with the institution operator and legal reviewer.",
          "Replace the approval reference placeholder in the private command with a pseudonymous approved reference.",
          "Run the private npm run server:origin:apply command only after the origin list is externally approved.",
          "Run npm run security:server-readiness after approved origins, trusted key, and storage records are prepared.",
        ]
      : [
          "Prepare HTTPS public operation URLs with npm run ops:public-env:init or pass explicit --origin values.",
          "Resolve candidate URL blockers before creating a private server origin apply command.",
        ],
    safetyNotes: [
      "This public report stores URL key status, origin counts, relative private command path, and SHA-256 digests only.",
      "The private command file may contain raw approved origins and must remain under ops/private.",
      "This command does not approve or apply server origins; it prepares a review candidate for the guarded server:origin:apply step.",
      "Do not store raw origins, contacts, owner names, victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or secrets in public reports.",
    ],
  };

  writeJson(path.join(reportDir, SERVER_ORIGIN_CANDIDATE_JSON), report);
  writeText(path.join(reportDir, SERVER_ORIGIN_CANDIDATE_MARKDOWN), formatServerOriginCandidateMarkdown(report));

  return {
    valid,
    report,
    reportDir,
    reportDirRelative: relativePath(resolvedRoot, reportDir),
    privateCommandPath: valid ? commandPath : "",
    privateCommandPathRelative: valid ? relativePath(resolvedRoot, commandPath) : "",
  };
}

export function formatServerOriginCandidateMarkdown(report) {
  const lines = [
    "# JiumAI Server Origin Candidate",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Env path: ${report.summary.envPath}`,
    `- Source URLs: ${report.summary.sourceUrlReadyCount}/${report.summary.sourceUrlKeyCount}`,
    `- Direct origins: ${report.summary.directOriginCount}`,
    `- Origin candidates: ${report.summary.originCount}`,
    `- Private command: ${report.privateCommand.fileStatus} (${report.privateCommand.path})`,
    `- Origin list digest: ${report.evidence.originListDigest || "MISSING"}`,
    `- Private command digest: ${report.evidence.privateCommandDigest || "MISSING"}`,
    "",
    "## Source URL Keys",
    ...(report.sourceUrls.length
      ? report.sourceUrls.map((source) => `- ${source.envKey}: ${source.status}, ${source.originDigest || "digest missing"}`)
      : ["- Not used"]),
    "",
    "## Direct Origin Candidates",
    ...(report.directOrigins.length
      ? report.directOrigins.map((origin) => `- ${origin.id}: ${origin.status}, ${origin.originDigest || "digest missing"}`)
      : ["- Not used"]),
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "## Next Actions",
    ...report.nextActions.map((action) => `- ${action}`),
    "",
    "## Safety Notes",
    ...report.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function writeServerOriginCandidateOutput({ root = repoRoot, report, outputPath = "", format = "markdown" } = {}) {
  if (!outputPath) {
    return { outputPath: "", outputPathRelative: "" };
  }
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(resolvedRoot, outputPath);
  if (!isPathInside(resolvedRoot, resolvedOutput)) {
    throw new Error("output path must stay inside the repository");
  }
  writeText(
    resolvedOutput,
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatServerOriginCandidateMarkdown(report),
  );
  return {
    outputPath: resolvedOutput,
    outputPathRelative: relativePath(resolvedRoot, resolvedOutput),
  };
}

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    envPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
    fromPublicEnv: false,
    origins: [],
    approvalRefPlaceholder: DEFAULT_APPROVAL_REF_PLACEHOLDER,
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
    } else if (arg === "--env") {
      args.envPath = argv[index + 1] || args.envPath;
      index += 1;
    } else if (arg.startsWith("--env=")) {
      args.envPath = arg.slice("--env=".length);
    } else if (arg === "--from-public-env") {
      args.fromPublicEnv = true;
    } else if (arg === "--origin") {
      args.origins.push(argv[index + 1] || "");
      index += 1;
    } else if (arg.startsWith("--origin=")) {
      args.origins.push(arg.slice("--origin=".length));
    } else if (arg === "--approval-ref-placeholder") {
      args.approvalRefPlaceholder = argv[index + 1] || args.approvalRefPlaceholder;
      index += 1;
    } else if (arg.startsWith("--approval-ref-placeholder=")) {
      args.approvalRefPlaceholder = arg.slice("--approval-ref-placeholder=".length);
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
    const result = await buildServerOriginCandidate(args);
    writeServerOriginCandidateOutput({
      root: args.root,
      report: result.report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(result.report, null, 2));
    } else {
      console.log(formatServerOriginCandidateMarkdown(result.report));
    }
    console.log(`Server origin candidate report written: ${args.outputPath || result.reportDirRelative}`);
    if (!result.valid) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
