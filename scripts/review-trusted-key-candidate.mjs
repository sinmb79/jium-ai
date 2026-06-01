#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  TRUSTED_KEY_REGISTRY_PATH,
  TRUSTED_KEY_REGISTRY_VERSION,
  loadTrustedAuthorizedFeedKeyRegistry,
  validateTrustedAuthorizedFeedKeyRegistry,
} from "./check-authorized-feed-keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);
const PRIVATE_KEY_USAGES = new Set(["sign", "decrypt", "deriveBits", "deriveKey", "unwrapKey"]);
const ALLOWED_CANDIDATE_KEYS = new Set(["keyId", "issuerName", "algorithm", "publicKeyJwk", "validFrom", "validUntil"]);
const ALLOWED_PUBLIC_JWK_KEYS = new Set(["kty", "n", "e", "use", "key_ops", "alg", "kid", "ext"]);
const SENSITIVE_VALUE_PATTERNS = [
  { label: "raw URL", pattern: /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|discord\.gg\/)/i },
  { label: "email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { label: "phone-like value", pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/ },
  { label: "secret-like value", pattern: /(gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i },
];

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseIso(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function present(value) {
  return Boolean(String(value || "").trim());
}

function canonicalizeJson(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("non-finite numbers cannot be canonicalized");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeJson(entry)}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported JSON value for canonicalization: ${typeof value}`);
}

function sha256Text(value) {
  return `sha256-${createHash("sha256").update(value).digest("hex")}`;
}

function fingerprintCandidateKey(candidate) {
  return sha256Text(
    canonicalizeJson({
      algorithm: candidate.algorithm,
      issuerName: candidate.issuerName,
      keyId: candidate.keyId,
      publicKeyJwk: candidate.publicKeyJwk,
    }),
  );
}

function sensitiveFindings(value, location = "$", findings = []) {
  if (typeof value === "string") {
    for (const { label, pattern } of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        findings.push(`${location} contains ${label}`);
      }
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => sensitiveFindings(entry, `${location}[${index}]`, findings));
    return findings;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => sensitiveFindings(entry, `${location}.${key}`, findings));
  }
  return findings;
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function loadRegistry(registryPath) {
  const registry = loadTrustedAuthorizedFeedKeyRegistry(registryPath);
  const errors = validateTrustedAuthorizedFeedKeyRegistry(registry);
  return {
    registry,
    errors,
    keys: Array.isArray(registry.keys) ? registry.keys : [],
  };
}

function reviewCandidate(candidate, existingKeys, now = Date.now()) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(candidate)) {
    return {
      status: "BLOCKED",
      keyId: "",
      issuerName: "",
      errors: ["trusted key candidate must be a JSON object"],
      warnings: [],
      fingerprint: "",
    };
  }

  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_CANDIDATE_KEYS.has(key)) {
      errors.push(`candidate contains unsupported field: ${key}`);
    }
  }

  if (!present(candidate.keyId)) {
    errors.push("candidate keyId is required");
  }
  if (!present(candidate.issuerName)) {
    errors.push("candidate issuerName is required");
  }
  if (candidate.algorithm !== AUTHORIZED_FEED_SIGNATURE_ALGORITHM) {
    errors.push(`candidate algorithm must be ${AUTHORIZED_FEED_SIGNATURE_ALGORITHM}`);
  }
  if (existingKeys.some((key) => key.keyId === candidate.keyId)) {
    errors.push(`candidate keyId already exists in trusted registry: ${candidate.keyId}`);
  }

  if (!isPlainObject(candidate.publicKeyJwk)) {
    errors.push("candidate publicKeyJwk is required");
  } else {
    for (const key of Object.keys(candidate.publicKeyJwk)) {
      if (!ALLOWED_PUBLIC_JWK_KEYS.has(key)) {
        errors.push(`candidate publicKeyJwk contains unsupported field: ${key}`);
      }
    }
    if (candidate.publicKeyJwk.kty !== "RSA") {
      errors.push("candidate publicKeyJwk.kty must be RSA");
    }
    if (!present(candidate.publicKeyJwk.n)) {
      errors.push("candidate publicKeyJwk.n is required");
    }
    if (!present(candidate.publicKeyJwk.e)) {
      errors.push("candidate publicKeyJwk.e is required");
    }
    for (const privateField of PRIVATE_JWK_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(candidate.publicKeyJwk, privateField)) {
        errors.push(`candidate publicKeyJwk must not include private JWK field: ${privateField}`);
      }
    }
    if (Array.isArray(candidate.publicKeyJwk.key_ops)) {
      candidate.publicKeyJwk.key_ops.forEach((usage) => {
        if (PRIVATE_KEY_USAGES.has(String(usage))) {
          errors.push(`candidate publicKeyJwk.key_ops must not include private usage: ${usage}`);
        }
      });
    }
    if (candidate.publicKeyJwk.use && candidate.publicKeyJwk.use !== "sig") {
      errors.push("candidate publicKeyJwk.use must be sig when present");
    }
  }

  if (!present(candidate.validUntil)) {
    warnings.push("candidate validUntil is missing; record a rotation plan before approval");
  }
  if (present(candidate.validFrom) && !Number.isFinite(parseIso(candidate.validFrom))) {
    errors.push("candidate validFrom must be an ISO date when present");
  }
  if (present(candidate.validUntil) && !Number.isFinite(parseIso(candidate.validUntil))) {
    errors.push("candidate validUntil must be an ISO date when present");
  }
  if (present(candidate.validFrom) && present(candidate.validUntil) && parseIso(candidate.validUntil) <= parseIso(candidate.validFrom)) {
    errors.push("candidate validUntil must be later than validFrom");
  }
  if (present(candidate.validUntil) && parseIso(candidate.validUntil) <= now) {
    errors.push("candidate validUntil must be in the future");
  }

  sensitiveFindings(candidate).forEach((finding) => errors.push(`candidate ${finding}`));

  const status = errors.length ? "BLOCKED" : warnings.length ? "NEEDS_REVIEW" : "READY_FOR_APPROVAL";
  return {
    status,
    keyId: String(candidate.keyId || ""),
    issuerName: String(candidate.issuerName || ""),
    fingerprint: errors.length ? "" : fingerprintCandidateKey(candidate),
    errors,
    warnings,
  };
}

function buildTrustedKeyRegistryPatch(candidate, existingKeys) {
  const keys = [...existingKeys.filter((key) => key.keyId !== candidate.keyId), candidate].sort((left, right) =>
    left.keyId.localeCompare(right.keyId),
  );
  return {
    version: TRUSTED_KEY_REGISTRY_VERSION,
    keys,
  };
}

function checklistFor(status) {
  const prefix = status === "READY_FOR_APPROVAL" ? "APPROVAL" : status === "NEEDS_REVIEW" ? "REVIEW" : "BLOCKED";
  return [
    `${prefix}: verify issuer identity and authorization through an official channel`,
    `${prefix}: compare the fingerprint with the value provided through a separate trusted channel`,
    `${prefix}: confirm that no private key material, raw URLs, contacts, or victim indicators are present`,
    `${prefix}: record validUntil and the future rotation owner before merging the registry patch`,
    `${prefix}: run npm run security:feed-keys and npm run security:server-readiness after applying the patch`,
  ];
}

function nextActionsFor(review, patchWritten) {
  if (review.status === "BLOCKED") {
    return ["Resolve blocked candidate-key errors before creating a registry patch."];
  }
  const actions = [
    "Store the fingerprint in the private approval record and compare it through a separate trusted channel.",
    "Apply the registry patch only after institution/legal approval.",
    "Run npm run security:feed-keys and npm run security:server-readiness after applying the patch.",
  ];
  if (review.status === "NEEDS_REVIEW") {
    actions.unshift("Resolve warnings or document the exception before approval.");
  }
  if (!patchWritten) {
    actions.unshift("Pass --patch-output <path> to write the approved registry patch.");
  }
  return actions;
}

export async function reviewTrustedKeyCandidateFile({
  root = repoRoot,
  candidatePath,
  registryPath = path.join(root, TRUSTED_KEY_REGISTRY_PATH),
  patchOutputPath = "",
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  if (!candidatePath) {
    throw new Error("candidatePath is required");
  }
  const resolvedCandidatePath = path.resolve(root, candidatePath);
  const resolvedRegistryPath = path.resolve(root, registryPath);
  const candidate = readJsonFile(resolvedCandidatePath);
  const { registry, errors: registryErrors, keys } = loadRegistry(resolvedRegistryPath);
  const review = reviewCandidate(candidate, keys, now);
  const errors = [...registryErrors.map((error) => `registry: ${error}`), ...review.errors];
  const status = errors.length ? "BLOCKED" : review.status;
  let patchWritten = false;

  if (patchOutputPath && status !== "BLOCKED") {
    const patch = buildTrustedKeyRegistryPatch(candidate, keys);
    const resolvedPatchOutputPath = path.resolve(root, patchOutputPath);
    mkdirSync(path.dirname(resolvedPatchOutputPath), { recursive: true });
    writeFileSync(resolvedPatchOutputPath, `${JSON.stringify(patch, null, 2)}\n`, "utf8");
    patchWritten = true;
  }

  const report = {
    generatedAt,
    status,
    key: {
      keyId: review.keyId,
      issuerName: review.issuerName,
      fingerprint: status === "BLOCKED" ? "" : review.fingerprint,
      algorithm: candidate.algorithm === AUTHORIZED_FEED_SIGNATURE_ALGORITHM ? AUTHORIZED_FEED_SIGNATURE_ALGORITHM : "INVALID_OR_MISSING",
      validFromStatus: present(candidate.validFrom) ? "SET" : "MISSING",
      validUntilStatus: present(candidate.validUntil) ? "SET" : "MISSING",
    },
    registry: {
      version: registry.version === TRUSTED_KEY_REGISTRY_VERSION ? TRUSTED_KEY_REGISTRY_VERSION : "INVALID_OR_MISSING",
      keyCount: keys.length,
      validationStatus: registryErrors.length ? "BLOCKED" : "PASS",
    },
    patch: {
      requested: Boolean(patchOutputPath),
      written: patchWritten,
    },
    errors,
    warnings: review.warnings,
    checklist: checklistFor(status),
    nextActions: nextActionsFor({ ...review, status }, patchWritten),
    safetyNotes: [
      "This report stores only key id, issuer name, fingerprint, status, counts, and setting presence.",
      "It does not store raw public-key modulus values, private keys, contacts, URLs, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "The optional patch output contains public key material only and must be reviewed before it is applied to the trusted registry.",
    ],
  };

  return {
    valid: status !== "BLOCKED",
    report,
  };
}

export function formatTrustedKeyCandidateReviewMarkdown(report) {
  const lines = [
    "# JiumAI Trusted Key Candidate Review",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Key ID: ${report.key.keyId || "MISSING"}`,
    `- Issuer: ${report.key.issuerName || "MISSING"}`,
    `- Fingerprint: ${report.key.fingerprint || "MISSING"}`,
    `- Algorithm: ${report.key.algorithm}`,
    `- Registry keys: ${report.registry.keyCount}`,
    `- Patch requested: ${report.patch.requested ? "YES" : "NO"}`,
    `- Patch written: ${report.patch.written ? "YES" : "NO"}`,
    "",
    "## Errors",
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ["- None"]),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "## Checklist",
    ...report.checklist.map((item) => `- ${item}`),
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
    candidatePath: "",
    registryPath: path.join(repoRoot, TRUSTED_KEY_REGISTRY_PATH),
    patchOutputPath: "",
    format: "text",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--candidate") {
      args.candidatePath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--candidate=")) {
      args.candidatePath = arg.slice("--candidate=".length);
    } else if (arg === "--registry") {
      args.registryPath = argv[index + 1] || args.registryPath;
      index += 1;
    } else if (arg.startsWith("--registry=")) {
      args.registryPath = arg.slice("--registry=".length);
    } else if (arg === "--patch-output") {
      args.patchOutputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--patch-output=")) {
      args.patchOutputPath = arg.slice("--patch-output=".length);
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      args.format = "markdown";
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    if (!args.candidatePath) {
      throw new Error("Pass --candidate <candidate-key.json>");
    }
    if (!existsSync(path.resolve(repoRoot, args.candidatePath))) {
      throw new Error("candidate key file missing");
    }
    const result = await reviewTrustedKeyCandidateFile(args);
    const content =
      args.format === "json" ? JSON.stringify(result.report, null, 2) : formatTrustedKeyCandidateReviewMarkdown(result.report);
    console.log(content);
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
