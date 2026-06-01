#!/usr/bin/env node
import { generateKeyPairSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  TRUSTED_KEY_REGISTRY_PATH,
  TRUSTED_KEY_REGISTRY_VERSION,
} from "./check-authorized-feed-keys.mjs";
import {
  formatTrustedKeyCandidateReviewMarkdown,
  reviewTrustedKeyCandidateFile,
} from "./review-trusted-key-candidate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
export const TRUSTED_KEY_ONBOARDING_BUNDLE_DIR = "dist/trusted-key-onboarding";
const DEFAULT_CANDIDATE_DIR = "ops/private/production-onboarding";

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

function safeKeyId(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function present(value) {
  return Boolean(String(value || "").trim());
}

function isIso(value) {
  return Number.isFinite(Date.parse(value || ""));
}

function defaultValidUntil(validFrom) {
  const base = Number.isFinite(Date.parse(validFrom || "")) ? Date.parse(validFrom) : Date.now();
  return new Date(base + 366 * 24 * 60 * 60 * 1000).toISOString();
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

function ensureRegistry(root) {
  const registryPath = path.join(root, TRUSTED_KEY_REGISTRY_PATH);
  if (existsSync(registryPath)) {
    return;
  }
  writeJson(registryPath, { version: TRUSTED_KEY_REGISTRY_VERSION, keys: [] });
}

function buildCandidate({ keyId, issuerName, publicJwk, validFrom, validUntil }) {
  return {
    keyId,
    issuerName,
    algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
    publicKeyJwk: {
      ...publicJwk,
      use: "sig",
      key_ops: ["verify"],
      alg: "RS256",
      kid: keyId,
      ext: true,
    },
    validFrom,
    validUntil,
  };
}

function redactedReviewSummary(reviewReport) {
  return {
    status: reviewReport.status,
    fingerprint: reviewReport.key.fingerprint,
    validationStatus: reviewReport.registry.validationStatus,
    patchWritten: reviewReport.patch.written,
    warningCount: reviewReport.warnings.length,
    errorCount: reviewReport.errors.length,
  };
}

export function validateTrustedKeyOnboardingPlan({
  root = repoRoot,
  privateKeyDir,
  keyId,
  issuerName,
  validFrom = new Date().toISOString(),
  validUntil = defaultValidUntil(validFrom),
  now = Date.now(),
} = {}) {
  const errors = [];
  const normalizedKeyId = safeKeyId(keyId);
  const resolvedRoot = path.resolve(root);
  const resolvedPrivateKeyDir = privateKeyDir ? path.resolve(privateKeyDir) : "";

  if (!present(keyId)) {
    errors.push("trusted key onboarding keyId is required");
  } else if (normalizedKeyId !== String(keyId).trim()) {
    errors.push("trusted key onboarding keyId may contain only letters, numbers, dot, underscore, or dash");
  }
  if (!present(issuerName)) {
    errors.push("trusted key onboarding issuerName is required");
  }
  if (!present(privateKeyDir)) {
    errors.push("trusted key onboarding private key directory is required");
  } else if (!path.isAbsolute(privateKeyDir)) {
    errors.push("trusted key onboarding private key directory must be absolute");
  } else if (isPathInside(resolvedRoot, resolvedPrivateKeyDir)) {
    errors.push("trusted key onboarding private key directory must be outside the repository");
  }
  if (!isIso(validFrom)) {
    errors.push("trusted key onboarding validFrom must be an ISO date");
  }
  if (!isIso(validUntil)) {
    errors.push("trusted key onboarding validUntil must be an ISO date");
  }
  if (isIso(validFrom) && isIso(validUntil) && Date.parse(validUntil) <= Date.parse(validFrom)) {
    errors.push("trusted key onboarding validUntil must be later than validFrom");
  }
  if (isIso(validUntil) && Date.parse(validUntil) <= now) {
    errors.push("trusted key onboarding validUntil must be in the future");
  }

  return {
    valid: errors.length === 0,
    errors,
    keyId: normalizedKeyId,
    issuerName: String(issuerName || "").trim(),
    privateKeyPathState: resolvedPrivateKeyDir && !isPathInside(resolvedRoot, resolvedPrivateKeyDir) ? "REPO_EXTERNAL" : "BLOCKED",
    validFrom,
    validUntil,
  };
}

export async function buildTrustedKeyOnboardingBundle({
  root = repoRoot,
  privateKeyDir,
  keyId,
  issuerName,
  validFrom = new Date().toISOString(),
  validUntil = defaultValidUntil(validFrom),
  candidateOutputPath = "",
  patchOutputPath = "",
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  const plan = validateTrustedKeyOnboardingPlan({ root, privateKeyDir, keyId, issuerName, validFrom, validUntil, now });
  if (!plan.valid) {
    const report = {
      schema: "jium-trusted-key-onboarding-v1",
      generatedAt,
      status: "BLOCKED",
      version: readPackageVersion(root),
      key: {
        keyId: plan.keyId,
        issuerName: plan.issuerName,
        algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
        validFromStatus: isIso(validFrom) ? "SET" : "INVALID_OR_MISSING",
        validUntilStatus: isIso(validUntil) ? "SET" : "INVALID_OR_MISSING",
      },
      privateKey: {
        pathState: plan.privateKeyPathState,
        fileStatus: "NOT_WRITTEN",
      },
      candidate: {
        fileStatus: "NOT_WRITTEN",
        relativePath: "",
      },
      review: {
        status: "BLOCKED",
        fingerprint: "",
        validationStatus: "BLOCKED",
        patchWritten: false,
        warningCount: 0,
        errorCount: plan.errors.length,
      },
      errors: plan.errors,
      warnings: [],
      nextActions: ["Resolve trusted key onboarding plan blockers before generating key material."],
      safetyNotes: [
        "Private key material must be generated outside the repository and must never be committed.",
        "Reports store only key id, issuer name, status, fingerprint, counts, version, and relative public artifact paths.",
      ],
    };
    return { valid: false, bundleDir: "", bundleDirRelative: "", report };
  }

  ensureRegistry(root);
  const bundleDir = path.join(root, TRUSTED_KEY_ONBOARDING_BUNDLE_DIR);
  const resolvedPrivateKeyDir = path.resolve(privateKeyDir);
  const candidateRelativePath = candidateOutputPath || path.join(DEFAULT_CANDIDATE_DIR, `${plan.keyId}.public-candidate.json`);
  const patchRelativePath = patchOutputPath || path.join(TRUSTED_KEY_ONBOARDING_BUNDLE_DIR, `${plan.keyId}.registry-patch.json`);
  const candidatePath = path.resolve(root, candidateRelativePath);
  const privateKeyPath = path.join(resolvedPrivateKeyDir, `${plan.keyId}.private.jwk.json`);

  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicExponent: 0x10001,
  });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = {
    ...privateKey.export({ format: "jwk" }),
    use: "sig",
    key_ops: ["sign"],
    alg: "RS256",
    kid: plan.keyId,
    ext: false,
  };
  const candidate = buildCandidate({
    keyId: plan.keyId,
    issuerName: plan.issuerName,
    publicJwk,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
  });

  writeJson(privateKeyPath, privateJwk);
  try {
    chmodSync(privateKeyPath, 0o600);
  } catch {
    // Windows may not honor POSIX permissions; the path gate is the primary protection here.
  }
  writeJson(candidatePath, candidate);

  const review = await reviewTrustedKeyCandidateFile({
    root,
    candidatePath: relativePath(root, candidatePath),
    patchOutputPath: patchRelativePath,
    generatedAt,
    now,
  });
  const report = {
    schema: "jium-trusted-key-onboarding-v1",
    generatedAt,
    status: review.report.status,
    version: readPackageVersion(root),
    key: {
      keyId: plan.keyId,
      issuerName: plan.issuerName,
      fingerprint: review.report.key.fingerprint,
      algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      validFromStatus: "SET",
      validUntilStatus: "SET",
    },
    privateKey: {
      pathState: "REPO_EXTERNAL",
      fileStatus: "WRITTEN",
      fileName: path.basename(privateKeyPath),
    },
    candidate: {
      fileStatus: "WRITTEN",
      relativePath: relativePath(root, candidatePath),
    },
    patch: {
      fileStatus: review.report.patch.written ? "WRITTEN" : "NOT_WRITTEN",
      relativePath: review.report.patch.written ? patchRelativePath.replace(/\\/g, "/") : "",
    },
    review: redactedReviewSummary(review.report),
    errors: review.report.errors,
    warnings: review.report.warnings,
    nextActions: [
      "Transfer the private JWK through the approved institution secret-management process; do not copy it into the repository.",
      `Run npm run security:trusted-key:review -- --candidate ${relativePath(root, candidatePath)} --patch-output ${patchRelativePath.replace(/\\/g, "/")} before applying the registry patch.`,
      "Compare the fingerprint through a separate trusted channel and record only the pseudonymous evidence reference in approval records.",
      "Apply the registry patch only after institution/legal approval, then run npm run security:feed-keys and npm run security:server-readiness.",
    ],
    safetyNotes: [
      "This report stores only key id, issuer name, fingerprint, status, counts, version, and relative public artifact paths.",
      "It does not store private key values, raw public-key modulus values, private filesystem paths, contacts, URLs, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "The public candidate and registry patch contain public key material only; they still require human approval before registry merge.",
    ],
  };

  writeJson(path.join(bundleDir, "trusted-key-onboarding-report.json"), report);
  writeText(path.join(bundleDir, "trusted-key-onboarding-report.md"), formatTrustedKeyOnboardingMarkdown(report));
  writeText(path.join(bundleDir, "trusted-key-candidate-review.md"), formatTrustedKeyCandidateReviewMarkdown(review.report));

  return {
    valid: review.valid,
    bundleDir,
    bundleDirRelative: relativePath(root, bundleDir),
    report,
  };
}

export function formatTrustedKeyOnboardingMarkdown(report) {
  const lines = [
    "# JiumAI Trusted Key Onboarding",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Key ID: ${report.key.keyId || "MISSING"}`,
    `- Issuer: ${report.key.issuerName || "MISSING"}`,
    `- Fingerprint: ${report.key.fingerprint || "MISSING"}`,
    `- Algorithm: ${report.key.algorithm}`,
    `- Private key: ${report.privateKey.fileStatus} (${report.privateKey.pathState})`,
    `- Candidate: ${report.candidate.fileStatus}${report.candidate.relativePath ? ` ${report.candidate.relativePath}` : ""}`,
    `- Patch: ${report.patch?.fileStatus || "NOT_WRITTEN"}${report.patch?.relativePath ? ` ${report.patch.relativePath}` : ""}`,
    "",
    "## Review",
    `- Status: ${report.review.status}`,
    `- Registry validation: ${report.review.validationStatus}`,
    `- Patch written: ${report.review.patchWritten ? "YES" : "NO"}`,
    `- Warnings: ${report.review.warningCount}`,
    `- Errors: ${report.review.errorCount}`,
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
    format: "text",
    privateKeyDir: "",
    keyId: "",
    issuerName: "",
    validFrom: new Date().toISOString(),
    validUntil: "",
    candidateOutputPath: "",
    patchOutputPath: "",
    outputPath: "",
  };
  args.validUntil = defaultValidUntil(args.validFrom);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--private-key-dir") {
      args.privateKeyDir = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--private-key-dir=")) {
      args.privateKeyDir = arg.slice("--private-key-dir=".length);
    } else if (arg === "--key-id") {
      args.keyId = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--key-id=")) {
      args.keyId = arg.slice("--key-id=".length);
    } else if (arg === "--issuer") {
      args.issuerName = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--issuer=")) {
      args.issuerName = arg.slice("--issuer=".length);
    } else if (arg === "--valid-from") {
      args.validFrom = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--valid-from=")) {
      args.validFrom = arg.slice("--valid-from=".length);
    } else if (arg === "--valid-until") {
      args.validUntil = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--valid-until=")) {
      args.validUntil = arg.slice("--valid-until=".length);
    } else if (arg === "--candidate-output") {
      args.candidateOutputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--candidate-output=")) {
      args.candidateOutputPath = arg.slice("--candidate-output=".length);
    } else if (arg === "--patch-output") {
      args.patchOutputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--patch-output=")) {
      args.patchOutputPath = arg.slice("--patch-output=".length);
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
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const result = await buildTrustedKeyOnboardingBundle(args);
    const content = args.format === "json" ? JSON.stringify(result.report, null, 2) : formatTrustedKeyOnboardingMarkdown(result.report);
    if (args.outputPath) {
      writeText(path.resolve(repoRoot, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Trusted key onboarding report written: ${args.outputPath}`);
    } else {
      console.log(content);
      if (result.bundleDirRelative) {
        console.log(`Trusted key onboarding bundle written: ${result.bundleDirRelative}`);
      }
    }
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
