#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRUSTED_KEY_REGISTRY_PATH,
  TRUSTED_KEY_REGISTRY_VERSION,
  validateTrustedAuthorizedFeedKeyRegistry,
} from "./check-authorized-feed-keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const TRUSTED_KEY_REGISTRY_APPLY_BUNDLE_DIR = "dist/trusted-key-onboarding";

const APPROVAL_REF_SENSITIVE_PATTERNS = [
  { label: "raw URL", pattern: /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite\/)/i },
  { label: "email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { label: "phone-like value", pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/ },
  { label: "secret-like value", pattern: /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i },
];

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function present(value) {
  return Boolean(String(value || "").trim());
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(String(value || "").trim()).digest("hex")}`;
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
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

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function resolveRepoPath(root, value) {
  if (!present(value)) {
    return "";
  }
  return path.resolve(root, value);
}

function readJsonSafe(filePath, errors, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${label}: could not read valid JSON (${message})`);
    return null;
  }
}

function parseIso(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isActiveKey(key, now) {
  if (!isPlainObject(key)) {
    return false;
  }
  if (present(key.validFrom) && parseIso(key.validFrom) > now) {
    return false;
  }
  if (present(key.validUntil) && parseIso(key.validUntil) <= now) {
    return false;
  }
  return true;
}

function validateApprovalRef(approvalRef) {
  const errors = [];
  const normalized = String(approvalRef || "").trim();
  if (!normalized) {
    errors.push("approval reference is required before applying a trusted key registry patch");
    return { errors, status: "MISSING", digest: "" };
  }
  if (/^(?:todo|tbd|change-?me|replace-?me|placeholder|pending|none)$/i.test(normalized)) {
    errors.push("approval reference must be a real pseudonymous approval record, not a placeholder");
  }
  for (const { label, pattern } of APPROVAL_REF_SENSITIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      errors.push(`approval reference must not contain ${label}`);
    }
  }
  return {
    errors,
    status: errors.length ? "BLOCKED" : "SET_REDACTED",
    digest: errors.length ? "" : sha256Text(normalized),
  };
}

function planTrustedKeyRegistryPatchApplication({
  root = repoRoot,
  patchPath,
  approvalRef = "",
  now = Date.now(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const errors = [];
  const warnings = [];
  const approval = validateApprovalRef(approvalRef);
  errors.push(...approval.errors);

  const resolvedPatchPath = resolveRepoPath(resolvedRoot, patchPath);
  let patchPathRelative = "";
  let patchRegistry = null;
  let currentRegistry = null;
  let currentKeyCount = 0;
  let currentValidationErrors = [];

  if (!present(patchPath)) {
    errors.push("trusted key registry patch path is required");
  } else if (!isPathInside(resolvedRoot, resolvedPatchPath)) {
    errors.push("trusted key registry patch path must stay inside the repository");
  } else if (!existsSync(resolvedPatchPath)) {
    errors.push("trusted key registry patch file is missing");
  } else {
    patchPathRelative = relativePath(resolvedRoot, resolvedPatchPath);
    patchRegistry = readJsonSafe(resolvedPatchPath, errors, "trusted key registry patch");
  }

  const registryPath = path.join(resolvedRoot, TRUSTED_KEY_REGISTRY_PATH);
  if (existsSync(registryPath)) {
    currentRegistry = readJsonSafe(registryPath, errors, "current trusted key registry");
    if (currentRegistry) {
      currentValidationErrors = validateTrustedAuthorizedFeedKeyRegistry(currentRegistry);
      currentKeyCount = Array.isArray(currentRegistry.keys) ? currentRegistry.keys.length : 0;
      errors.push(...currentValidationErrors.map((error) => `current registry: ${error}`));
    }
  } else {
    warnings.push("current trusted key registry is missing and will be created if the approved patch is valid");
  }

  let patchValidationErrors = [];
  let patchKeys = [];
  if (patchRegistry) {
    patchValidationErrors = validateTrustedAuthorizedFeedKeyRegistry(patchRegistry);
    errors.push(...patchValidationErrors.map((error) => `patch registry: ${error}`));
    patchKeys = Array.isArray(patchRegistry.keys) ? patchRegistry.keys : [];
    if (!patchKeys.length) {
      errors.push("trusted key registry patch must contain at least one trusted public key");
    }
  }

  const activeKeyCount = patchKeys.filter((key) => isActiveKey(key, now)).length;
  if (patchKeys.length && activeKeyCount === 0) {
    errors.push("trusted key registry patch must contain at least one currently active trusted public key");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    approval,
    root: resolvedRoot,
    patchPathRelative,
    patchRegistry,
    registryPath,
    currentKeyCount,
    newKeyCount: patchKeys.length,
    activeKeyCount,
    keyIds: patchKeys
      .map((key) => (isPlainObject(key) && present(key.keyId) ? String(key.keyId) : "INVALID_OR_MISSING"))
      .filter(Boolean),
  };
}

export function validateTrustedKeyRegistryPatchApplication(options = {}) {
  const plan = planTrustedKeyRegistryPatchApplication(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    approval: {
      approvalRefStatus: plan.approval.status,
      approvalRefDigest: plan.approval.digest,
    },
    patch: {
      source: plan.patchPathRelative,
      keyCount: plan.newKeyCount,
      activeKeyCount: plan.activeKeyCount,
      validationStatus: plan.errors.some((error) => error.startsWith("patch registry:")) ? "BLOCKED" : "PASS",
    },
  };
}

function buildReport(plan, { generatedAt, applied }) {
  const status = plan.valid && applied ? "APPLIED" : "BLOCKED";
  return {
    schema: "jium-trusted-key-registry-apply-v1",
    generatedAt,
    status,
    version: readPackageVersion(plan.root),
    summary: {
      previousKeyCount: plan.currentKeyCount,
      newKeyCount: plan.newKeyCount,
      activeKeyCount: plan.activeKeyCount,
      changedKeyCount: plan.keyIds.length,
    },
    approval: {
      approvalRefStatus: plan.approval.status,
      approvalRefDigest: plan.approval.digest,
    },
    patch: {
      source: plan.patchPathRelative,
      validationStatus: plan.errors.some((error) => error.startsWith("patch registry:")) ? "BLOCKED" : "PASS",
      applied: Boolean(applied),
    },
    registry: {
      target: TRUSTED_KEY_REGISTRY_PATH,
      fileStatus: applied ? "WRITTEN" : "UNCHANGED",
      validationStatus: plan.errors.some((error) => error.startsWith("current registry:")) ? "BLOCKED" : "PASS",
    },
    changedKeyIds: [...plan.keyIds],
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions: status === "APPLIED"
      ? [
          "Run npm run security:feed-keys to validate the updated trusted-key registry.",
          "Run npm run security:server-readiness to confirm the server runtime now sees an active trusted key.",
          "Record the approval reference digest, key fingerprint, and command output in the private approval packet.",
        ]
      : ["Resolve trusted key registry apply blockers before writing data/trusted-authorized-feed-keys.json."],
    safetyNotes: [
      "This report stores only counts, key ids, statuses, a SHA-256 approval digest, and repository-relative artifact names.",
      "It does not store raw public-key modulus values, private keys, raw approval references, private filesystem paths, contacts, URLs, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "Apply patches only after official institution/legal approval and separate-channel fingerprint comparison.",
    ],
  };
}

function writeRegistryAtomically(registryPath, registry) {
  mkdirSync(path.dirname(registryPath), { recursive: true });
  const tempPath = `${registryPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  renameSync(tempPath, registryPath);
}

export async function applyTrustedKeyRegistryPatch({
  root = repoRoot,
  patchPath,
  approvalRef = "",
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  const plan = planTrustedKeyRegistryPatchApplication({ root, patchPath, approvalRef, now });
  let applied = false;

  if (plan.valid) {
    writeRegistryAtomically(plan.registryPath, plan.patchRegistry);
    applied = true;
  }

  const report = buildReport(plan, { generatedAt, applied });
  const bundleDir = path.join(plan.root, TRUSTED_KEY_REGISTRY_APPLY_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "trusted-key-apply-report.json"), report);
  writeText(path.join(bundleDir, "trusted-key-apply-report.md"), formatTrustedKeyRegistryApplyMarkdown(report));

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatTrustedKeyRegistryApplyMarkdown(report) {
  const lines = [
    "# JiumAI Trusted Key Registry Apply",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Previous keys: ${report.summary.previousKeyCount}`,
    `- New keys: ${report.summary.newKeyCount}`,
    `- Active keys: ${report.summary.activeKeyCount}`,
    `- Approval: ${report.approval.approvalRefStatus}`,
    `- Approval digest: ${report.approval.approvalRefDigest || "MISSING"}`,
    `- Patch source: ${report.patch.source || "MISSING"}`,
    `- Registry target: ${report.registry.target}`,
    `- Registry file: ${report.registry.fileStatus}`,
    "",
    "## Changed Key IDs",
    ...(report.changedKeyIds.length ? report.changedKeyIds.map((keyId) => `- ${keyId}`) : ["- None"]),
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

function parseCliArgs(argv) {
  const args = {
    root: repoRoot,
    patchPath: "",
    approvalRef: "",
    format: "text",
    outputPath: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--patch" || arg === "--patch-path") {
      args.patchPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--patch=")) {
      args.patchPath = arg.slice("--patch=".length);
    } else if (arg.startsWith("--patch-path=")) {
      args.patchPath = arg.slice("--patch-path=".length);
    } else if (arg === "--approval-ref") {
      args.approvalRef = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--approval-ref=")) {
      args.approvalRef = arg.slice("--approval-ref=".length);
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
    if (args.outputPath) {
      const resolvedOutput = path.resolve(args.root, args.outputPath);
      if (!isPathInside(args.root, resolvedOutput)) {
        throw new Error("output path must stay inside the repository");
      }
    }
    const result = await applyTrustedKeyRegistryPatch({
      root: args.root,
      patchPath: args.patchPath,
      approvalRef: args.approvalRef,
    });
    const content =
      args.format === "json" ? JSON.stringify(result.report, null, 2) : formatTrustedKeyRegistryApplyMarkdown(result.report);

    if (args.outputPath) {
      const resolvedOutput = path.resolve(args.root, args.outputPath);
      writeText(resolvedOutput, `${content.trimEnd()}\n`);
      console.log(`Trusted key registry apply report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Trusted key registry apply report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
