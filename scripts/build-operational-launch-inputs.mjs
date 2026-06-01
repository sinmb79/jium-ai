#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_LAUNCH_INPUTS_SCHEMA = "jium-operational-launch-inputs-v1";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA = "jium-operational-launch-inputs-review-v1";
export const OPERATIONAL_LAUNCH_INPUTS_DIR = "dist/operational-launch-inputs";
export const OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_JSON = "operational-launch-inputs-template.json";
export const OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_MARKDOWN = "operational-launch-inputs-template.md";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_JSON = "operational-launch-inputs-review.json";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_MARKDOWN = "operational-launch-inputs-review.md";

const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
const RELEASE_CHANNEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,32}$/;
const SHA256_DIGEST_PATTERN = /^sha256-[a-f0-9]{64}$/;
const PLACEHOLDER_PATTERN = /<[^>]+>|\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL|sha256-evidence-digest)\b/i;
const UNSAFE_REPORT_PATTERNS = [
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
];

const INPUT_FIELDS = [
  { group: "public-operations", id: "publicBaseUrl", type: "url" },
  { group: "public-operations", id: "publicAppUrl", type: "url" },
  { group: "public-operations", id: "privacyNoticeUrl", type: "url" },
  { group: "public-operations", id: "supportRoute", type: "url" },
  { group: "public-operations", id: "hostedSecurityHeaderAuditReportPath", type: "repo-path" },
  { group: "server-runtime", id: "serverAllowedOrigins", type: "origin-list" },
  { group: "server-runtime", id: "serverOriginApprovalRef", type: "safe-ref" },
  { group: "server-runtime", id: "trustedKeyCandidatePath", type: "repo-path" },
  { group: "server-runtime", id: "trustedKeyRegistryPatchPath", type: "repo-path" },
  { group: "server-runtime", id: "trustedKeyApprovalRef", type: "safe-ref" },
  { group: "server-runtime", id: "auditLedgerDir", type: "absolute-path" },
  { group: "server-runtime", id: "accountRegistryDir", type: "absolute-path" },
  { group: "desktop-release", id: "desktopReleaseChannel", type: "release-channel" },
  { group: "desktop-release", id: "desktopUpdateUrl", type: "url" },
  { group: "desktop-release", id: "desktopPublishApprovalRef", type: "safe-ref" },
  { group: "desktop-release", id: "signedDesktopFeedDir", type: "path" },
  { group: "approval-records", id: "approvedOperationalInputsPath", type: "repo-path" },
  { group: "approval-records", id: "approvalEvidenceDigest", type: "sha256" },
  { group: "go-live", id: "incidentOwnerRef", type: "safe-ref" },
];

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
  } catch {
    return "";
  }
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

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function assertSafeFixedDir(root, target, expectedRelative) {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== expectedRelative) {
    throw new Error(`Refusing to clean unsafe operational launch inputs directory: ${resolved}`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = assertSafeFixedDir(root, OPERATIONAL_LAUNCH_INPUTS_DIR, OPERATIONAL_LAUNCH_INPUTS_DIR);
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function resolveInsideRepo(root, target, label) {
  const resolved = path.resolve(root, target || "");
  if (!isPathInside(root, resolved)) {
    throw new Error(`${label} path must stay inside the repository`);
  }
  return resolved;
}

function scanReportForLeaks(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const findings = UNSAFE_REPORT_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
  }));
  return {
    status: findings.length ? "BLOCKED" : "PASS",
    checkedPatternCount: UNSAFE_REPORT_PATTERNS.length,
    findings,
  };
}

function inputTemplate(version) {
  return {
    schema: OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
    packageVersion: version,
    publicOperations: {
      publicBaseUrl: "<approved-https-public-base-url>",
      publicAppUrl: "<approved-https-public-app-url>",
      privacyNoticeUrl: "<approved-https-privacy-notice-url>",
      supportRoute: "<approved-https-support-route>",
      hostedSecurityHeaderAuditReportPath: "ops/private/production-onboarding/hosted-security-header-audit.json",
    },
    serverRuntime: {
      serverAllowedOrigins: ["<approved-https-operator-origin>"],
      serverOriginApprovalRef: "<pseudonymous-origin-approval-reference>",
      trustedKeyCandidatePath: "ops/private/trusted-key-candidates/<approved-public-key-candidate>.json",
      trustedKeyRegistryPatchPath: "ops/private/trusted-key-registry/<approved-registry-patch>.json",
      trustedKeyApprovalRef: "<pseudonymous-trusted-key-approval-reference>",
      auditLedgerDir: "<approved-repo-external-audit-ledger-dir>",
      accountRegistryDir: "<approved-repo-external-account-registry-dir>",
    },
    desktopRelease: {
      desktopReleaseChannel: "stable",
      desktopUpdateUrl: "<approved-https-desktop-update-url>",
      desktopPublishApprovalRef: "<pseudonymous-desktop-publish-approval-reference>",
      signedDesktopFeedDir: "<approved-signed-desktop-feed-dir>",
    },
    approvalRecords: {
      approvedOperationalInputsPath: "ops/private/production-onboarding/approved-operational-inputs.json",
      approvalEvidenceDigest: "<sha256-evidence-digest>",
    },
    goLive: {
      incidentOwnerRef: "<pseudonymous-incident-owner-reference>",
    },
  };
}

export function buildOperationalLaunchInputsTemplate({
  root = repoRoot,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const version = readPackageVersion(resolvedRoot);
  const report = {
    schema: OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
    generatedAt,
    status: "READY_FOR_PRIVATE_FILL",
    version,
    summary: {
      totalInputCount: INPUT_FIELDS.length,
      groupCounts: INPUT_FIELDS.reduce((counts, field) => {
        counts[field.group] = (counts[field.group] || 0) + 1;
        return counts;
      }, {}),
    },
    input: inputTemplate(version),
    reviewCommand:
      "npm run ops:launch-inputs:review -- --input ops/private/production-onboarding/approved-launch-inputs.json",
    safetyNotes: [
      "This template is safe to review, but the filled input file is private and must not be committed.",
      "Raw approved URLs and storage paths may appear only in the private input file or approved private env files.",
      "Reports generated from this file store only statuses, counts, and SHA-256 digests.",
      "Do not store victim indicators, invite links, onion addresses, emails, phone numbers, passwords, tokens, certificate material, or private keys in this input file.",
    ],
  };
  const reportForScan = {
    ...report,
    input: { schema: report.input.schema, packageVersion: report.input.packageVersion },
  };
  const leakScan = scanReportForLeaks(reportForScan);
  return {
    ...report,
    leakScan,
    errors: leakScan.findings.map((finding) => `launch inputs template contains unsafe ${finding.label}`),
    warnings: [],
  };
}

function fieldValue(input, id) {
  return (
    input?.publicOperations?.[id] ??
    input?.serverRuntime?.[id] ??
    input?.desktopRelease?.[id] ??
    input?.approvalRecords?.[id] ??
    input?.goLive?.[id] ??
    ""
  );
}

function validateUrl(value) {
  const text = String(value || "").trim();
  const errors = [];
  if (!text) {
    errors.push("value missing");
  } else if (PLACEHOLDER_PATTERN.test(text)) {
    errors.push("value contains placeholder");
  } else {
    try {
      if (new URL(text).protocol !== "https:") {
        errors.push("value must be HTTPS");
      }
    } catch {
      errors.push("value must be a valid URL");
    }
  }
  return { errors, evidence: { valueStatus: errors.length ? "BLOCKED" : "SET_HTTPS", valueDigest: errors.length ? "" : sha256Text(text) } };
}

function validateOriginList(value) {
  const values = Array.isArray(value) ? value : [];
  const errors = [];
  if (!Array.isArray(value) || values.length === 0) {
    errors.push("origin list must contain at least one HTTPS origin");
  }
  for (const origin of values) {
    const text = String(origin || "").trim();
    if (!text || PLACEHOLDER_PATTERN.test(text)) {
      errors.push("origin contains placeholder or empty value");
      continue;
    }
    try {
      const parsed = new URL(text);
      if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search || parsed.hash) {
        errors.push("origin must be HTTPS origin-only");
      }
    } catch {
      errors.push("origin must be a valid URL");
    }
  }
  return {
    errors,
    evidence: {
      valueStatus: errors.length ? "BLOCKED" : "SET_HTTPS_ORIGINS",
      valueDigest: errors.length ? "" : sha256Text(values.map((entry) => String(entry || "").trim()).sort().join("\n")),
      count: values.length,
    },
  };
}

function validateSafeRef(value) {
  const text = String(value || "").trim();
  const errors = [];
  if (!text) {
    errors.push("value missing");
  } else {
    if (PLACEHOLDER_PATTERN.test(text)) errors.push("value contains placeholder");
    if (!SAFE_REF_PATTERN.test(text)) errors.push("value must be a short pseudonymous reference");
  }
  return { errors, evidence: { valueStatus: errors.length ? "BLOCKED" : "SET_REDACTED", valueDigest: errors.length ? "" : sha256Text(text) } };
}

function validateReleaseChannel(value) {
  const text = String(value || "").trim();
  const errors = [];
  if (!text) {
    errors.push("value missing");
  } else if (!RELEASE_CHANNEL_PATTERN.test(text) || PLACEHOLDER_PATTERN.test(text)) {
    errors.push("value must be a short release channel");
  }
  return { errors, evidence: { valueStatus: errors.length ? "BLOCKED" : "SET", valueDigest: errors.length ? "" : sha256Text(text) } };
}

function validateSha256(value) {
  const text = String(value || "").trim();
  const errors = SHA256_DIGEST_PATTERN.test(text) ? [] : ["value must be sha256-hex"];
  return { errors, evidence: { valueStatus: errors.length ? "BLOCKED" : "SET_SHA256", valueDigest: errors.length ? "" : text } };
}

function validatePathValue({ root, value, type }) {
  const text = String(value || "").trim();
  const errors = [];
  if (!text) {
    errors.push("path missing");
  } else if (PLACEHOLDER_PATTERN.test(text)) {
    errors.push("path contains placeholder");
  } else if (type === "repo-path" && !isPathInside(root, path.resolve(root, text))) {
    errors.push("path must stay inside the repository");
  } else if (type === "absolute-path" && !path.isAbsolute(text)) {
    errors.push("path must be absolute");
  } else if (type === "absolute-path" && isPathInside(root, path.resolve(text))) {
    errors.push("path must be outside the repository");
  }
  return {
    errors,
    evidence: {
      valueStatus: errors.length ? "BLOCKED" : type === "absolute-path" ? "SET_ABSOLUTE_REPO_EXTERNAL" : "SET_REDACTED_PATH",
      valueDigest: errors.length ? "" : sha256Text(text),
    },
  };
}

function validateField({ root, input, field }) {
  const value = fieldValue(input, field.id);
  const result =
    field.type === "url"
      ? validateUrl(value)
      : field.type === "origin-list"
        ? validateOriginList(value)
        : field.type === "safe-ref"
          ? validateSafeRef(value)
          : field.type === "release-channel"
            ? validateReleaseChannel(value)
            : field.type === "sha256"
              ? validateSha256(value)
              : validatePathValue({ root, value, type: field.type });
  return {
    group: field.group,
    id: field.id,
    type: field.type,
    status: result.errors.length ? "BLOCKED" : "READY",
    errorCount: result.errors.length,
    errors: result.errors,
    evidence: result.evidence,
  };
}

function commandPlan() {
  return [
    "npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env",
    "npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>",
    "npm run security:trusted-key:review -- --candidate <approved-public-key.json> --patch-output <trusted-key-registry.patch.json>",
    "npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>",
    "npm run desktop:release-env:apply -- --channel <approved-release-channel> --update-url <approved-https-update-url> --publish-approval-ref <pseudonymous-desktop-publish-approval-reference>",
    "npm run ops:approvals:apply-inputs -- --input <private-approved-operational-inputs.json> --init",
    "npm run ops:go-live:env:apply -- --incident-owner-ref <pseudonymous-incident-owner-reference>",
    "npm run ops:go-live:check",
  ];
}

export function reviewOperationalLaunchInputs({
  root = repoRoot,
  inputPath = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  if (!inputPath) {
    throw new Error("launch inputs --input is required");
  }
  const resolvedInput = resolveInsideRepo(resolvedRoot, inputPath, "input");
  if (!existsSync(resolvedInput)) {
    throw new Error("launch inputs file is missing");
  }
  const input = readJson(resolvedInput);
  const errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    errors.push("launch inputs file must be a JSON object");
  }
  if (input?.schema !== OPERATIONAL_LAUNCH_INPUTS_SCHEMA) {
    errors.push(`launch inputs schema must be ${OPERATIONAL_LAUNCH_INPUTS_SCHEMA}`);
  }
  const fields = INPUT_FIELDS.map((field) => validateField({ root: resolvedRoot, input, field }));
  const fieldErrors = fields.flatMap((field) => field.errors.map((error) => `${field.group}/${field.id}: ${error}`));
  const baseReport = {
    schema: OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA,
    generatedAt,
    status: errors.length || fieldErrors.length ? "BLOCKED" : "READY_FOR_OPERATOR_APPLY",
    version: readPackageVersion(resolvedRoot),
    summary: {
      totalInputCount: fields.length,
      readyInputCount: fields.filter((field) => field.status === "READY").length,
      blockedInputCount: fields.filter((field) => field.status === "BLOCKED").length,
      groupCounts: INPUT_FIELDS.reduce((counts, field) => {
        counts[field.group] = (counts[field.group] || 0) + 1;
        return counts;
      }, {}),
      inputDigest: sha256Text(readFileSync(resolvedInput)),
    },
    fields,
    commandPlan: commandPlan(),
    errors: [...errors, ...fieldErrors],
    warnings: ["Review only; this command does not write env files, approval files, trusted keys, or desktop release settings."],
    safetyNotes: [
      "This review stores only field statuses, counts, and SHA-256 digests of private values.",
      "It does not store raw URLs, storage paths, feed paths, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "Run the guarded apply commands only after institution/legal approval and separate-channel evidence review.",
    ],
  };
  const leakScan = scanReportForLeaks(baseReport);
  return {
    ...baseReport,
    status: leakScan.status === "PASS" ? baseReport.status : "BLOCKED",
    leakScan,
    errors: [
      ...baseReport.errors,
      ...leakScan.findings.map((finding) => `launch inputs review contains unsafe ${finding.label}`),
    ],
  };
}

export function writeOperationalLaunchInputsTemplateFiles({ root = repoRoot, template, outputPath = "", format = "markdown" } = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const jsonPath = path.join(reportDir, OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_JSON);
  const markdownPath = path.join(reportDir, OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_MARKDOWN);
  writeJson(jsonPath, template);
  writeText(markdownPath, formatOperationalLaunchInputsTemplateMarkdown(template));
  if (outputPath) {
    const resolvedOutput = resolveInsideRepo(resolvedRoot, outputPath, "output");
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(template, null, 2)}\n` : formatOperationalLaunchInputsTemplateMarkdown(template),
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

export function writeOperationalLaunchInputsReviewFiles({ root = repoRoot, review, outputPath = "", format = "markdown" } = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const jsonPath = path.join(reportDir, OPERATIONAL_LAUNCH_INPUTS_REVIEW_JSON);
  const markdownPath = path.join(reportDir, OPERATIONAL_LAUNCH_INPUTS_REVIEW_MARKDOWN);
  writeJson(jsonPath, review);
  writeText(markdownPath, formatOperationalLaunchInputsReviewMarkdown(review));
  if (outputPath) {
    const resolvedOutput = resolveInsideRepo(resolvedRoot, outputPath, "output");
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(review, null, 2)}\n` : formatOperationalLaunchInputsReviewMarkdown(review),
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

export function formatOperationalLaunchInputsTemplateMarkdown(template) {
  const lines = [
    "# JiumAI Operational Launch Inputs Template",
    "",
    `- Generated at: ${template.generatedAt}`,
    `- Status: ${template.status}`,
    `- Version: ${template.version || "MISSING"}`,
    `- Total inputs: ${template.summary.totalInputCount}`,
    `- Leak scan: ${template.leakScan.status}`,
    "",
    "## Required Groups",
    ...Object.entries(template.summary.groupCounts).map(([group, count]) => `- ${group}: ${count}`),
    "",
    "## Review Command",
    `- \`${template.reviewCommand}\``,
    "",
    "## Safety Notes",
    ...template.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function formatOperationalLaunchInputsReviewMarkdown(review) {
  const lines = [
    "# JiumAI Operational Launch Inputs Review",
    "",
    `- Generated at: ${review.generatedAt}`,
    `- Status: ${review.status}`,
    `- Version: ${review.version || "MISSING"}`,
    `- Ready inputs: ${review.summary.readyInputCount}/${review.summary.totalInputCount}`,
    `- Blocked inputs: ${review.summary.blockedInputCount}`,
    `- Input digest: ${review.summary.inputDigest}`,
    `- Leak scan: ${review.leakScan.status}`,
    "",
    "## Fields",
    ...review.fields.map((field) => `- ${field.status} ${field.group}/${field.id}: ${field.errorCount} error(s)`),
    "",
    "## Command Plan",
    ...review.commandPlan.map((command) => `- \`${command}\``),
    "",
    "## Errors",
    ...(review.errors.length ? review.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Warnings",
    ...(review.warnings.length ? review.warnings.map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "## Safety Notes",
    ...review.safetyNotes.map((note) => `- ${note}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseCliArgs(argv) {
  const args = { mode: "template", root: repoRoot, inputPath: "", outputPath: "", format: "text" };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("-")) {
      positional.push(arg);
    } else if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--input") {
      args.inputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--input=")) {
      args.inputPath = arg.slice("--input=".length);
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    }
  }
  if (positional[0] === "template" || positional[0] === "review") {
    args.mode = positional[0];
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    if (args.outputPath) {
      resolveInsideRepo(args.root, args.outputPath, "output");
    }
    if (args.mode === "review") {
      const review = reviewOperationalLaunchInputs({
        root: args.root,
        inputPath: args.inputPath,
      });
      const written = writeOperationalLaunchInputsReviewFiles({
        root: args.root,
        review,
        outputPath: args.outputPath,
        format: args.format === "json" ? "json" : "markdown",
      });
      if (args.format === "json") {
        console.log(JSON.stringify(review, null, 2));
      } else {
        console.log(formatOperationalLaunchInputsReviewMarkdown(review));
      }
      console.log(`Operational launch inputs review written: ${args.outputPath || written.reportDirRelative}`);
      if (review.status === "BLOCKED") {
        process.exit(1);
      }
    } else {
      const template = buildOperationalLaunchInputsTemplate({ root: args.root });
      const written = writeOperationalLaunchInputsTemplateFiles({
        root: args.root,
        template,
        outputPath: args.outputPath,
        format: args.format === "json" ? "json" : "markdown",
      });
      if (args.format === "json") {
        console.log(JSON.stringify(template, null, 2));
      } else {
        console.log(formatOperationalLaunchInputsTemplateMarkdown(template));
      }
      console.log(`Operational launch inputs template written: ${args.outputPath || written.reportDirRelative}`);
      if (template.leakScan.status !== "PASS") {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
