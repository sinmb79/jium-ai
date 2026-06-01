#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
  reviewOperationalLaunchInputs,
} from "./build-operational-launch-inputs.mjs";
import { validateDesktopReleaseEnvApply } from "./apply-desktop-release-env.mjs";
import { validateDesktopPublishReadiness } from "./check-desktop-publish-readiness.mjs";
import { validateDesktopUpdateFeed } from "./check-desktop-update-feed.mjs";
import { validateHostedSecurityHeaderAuditApply } from "./apply-hosted-security-header-audit-env.mjs";
import { validateOperationalGoLiveEnvApply } from "./apply-operational-go-live-env.mjs";
import { validateServerOriginApproval } from "./apply-server-origin-approval.mjs";
import { reviewTrustedKeyCandidateFile } from "./review-trusted-key-candidate.mjs";
import { validateTrustedKeyRegistryPatchApplication } from "./apply-trusted-key-registry-patch.mjs";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_LAUNCH_APPLY_READINESS_SCHEMA = "jium-operational-launch-apply-readiness-v1";
export const OPERATIONAL_LAUNCH_APPLY_READINESS_DIR = "dist/operational-launch-apply-readiness";
export const OPERATIONAL_LAUNCH_APPLY_READINESS_JSON = "operational-launch-apply-readiness.json";
export const OPERATIONAL_LAUNCH_APPLY_READINESS_MARKDOWN = "operational-launch-apply-readiness.md";

const UNSAFE_PATTERNS = [
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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function resolveInsideRepo(root, target, label) {
  const resolved = path.resolve(root, target || "");
  if (!isPathInside(root, resolved)) {
    throw new Error(`${label} path must stay inside the repository`);
  }
  return resolved;
}

function safePrepareReportDir(root) {
  const resolved = path.resolve(root, OPERATIONAL_LAUNCH_APPLY_READINESS_DIR);
  if (!isPathInside(root, resolved) || relativePath(root, resolved) !== OPERATIONAL_LAUNCH_APPLY_READINESS_DIR) {
    throw new Error(`Refusing to clean unsafe operational launch apply readiness directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

function redactText(value, root) {
  return String(value || "")
    .replaceAll(path.resolve(root), "<repo-root>")
    .replace(/https?:\/\/[^\s")]+/gi, "<redacted-url>")
    .replace(/\b(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite)\/[^\s")]+/gi, "<redacted-invite>")
    .replace(/\b[a-z2-7]{16,56}\.onion\b/gi, "<redacted-onion>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>")
    .replace(/\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|(?:sk-proj|sk)-[A-Za-z0-9_\-]{8,})\b/gi, "<redacted-token>")
    .replace(/\b(?:(?:\+82[\s.-]?)?0?1[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|0\d{1,2}[\s.-]\d{3,4}[\s.-]\d{4})\b/g, "<redacted-phone>")
    .replace(/(?:[A-Za-z]:\\|\/(?:Users|home|var|etc|tmp|mnt|opt)\/)[^\s")]+/gi, "<redacted-path>");
}

function redactedErrors(errors, root) {
  return Array.from(new Set((errors || []).map((error) => redactText(error, root))));
}

function scanReportForLeaks(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const findings = UNSAFE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map((pattern) => ({
    id: pattern.id,
    label: pattern.label,
  }));
  return {
    status: findings.length ? "BLOCKED" : "PASS",
    checkedPatternCount: UNSAFE_PATTERNS.length,
    findings,
  };
}

function phase({ id, title, status, evidence = {}, errors = [], nextActions = [] }, root) {
  return {
    id,
    title,
    status,
    evidence,
    errorCount: errors.length,
    errors: redactedErrors(errors, root),
    nextActions,
  };
}

function safeReadInput(resolvedInput) {
  try {
    return { input: readJson(resolvedInput), errors: [] };
  } catch (error) {
    return { input: null, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

function approvalInputStatus({ root, input }) {
  const value = String(input?.approvalRecords?.approvedOperationalInputsPath || "").trim();
  const errors = [];
  let digest = "";
  let schema = "";
  if (!value) {
    errors.push("approved operational inputs path is missing");
  } else {
    const resolved = path.resolve(root, value);
    if (!isPathInside(root, resolved)) {
      errors.push("approved operational inputs path must stay inside the repository");
    } else if (!existsSync(resolved)) {
      errors.push("approved operational inputs file is missing");
    } else {
      digest = sha256Text(readFileSync(resolved));
      try {
        schema = readJson(resolved).schema || "";
      } catch {
        errors.push("approved operational inputs file is not valid JSON");
      }
      if (schema && schema !== "jium-operational-approval-inputs-v1") {
        errors.push("approved operational inputs schema is invalid");
      }
    }
  }
  return {
    status: errors.length ? "BLOCKED" : "READY_TO_APPLY",
    errors,
    evidence: {
      inputPathStatus: value ? "SET_REDACTED" : "MISSING",
      fileStatus: errors.some((error) => error.includes("missing")) ? "MISSING" : value ? "PRESENT" : "MISSING",
      schema: schema || "MISSING",
      inputDigest: digest,
    },
  };
}

function storageRootStatus({ root, input }) {
  const auditLedgerDir = String(input?.serverRuntime?.auditLedgerDir || "").trim();
  const accountRegistryDir = String(input?.serverRuntime?.accountRegistryDir || "").trim();
  const errors = [];
  let storageRoot = "";
  if (!auditLedgerDir || !accountRegistryDir) {
    errors.push("server storage directories are missing");
  } else if (!path.isAbsolute(auditLedgerDir) || !path.isAbsolute(accountRegistryDir)) {
    errors.push("server storage directories must be absolute");
  } else {
    const auditResolved = path.resolve(auditLedgerDir);
    const accountResolved = path.resolve(accountRegistryDir);
    const auditParent = path.dirname(auditResolved);
    const accountParent = path.dirname(accountResolved);
    if (isPathInside(root, auditResolved) || isPathInside(root, accountResolved)) {
      errors.push("server storage directories must stay outside the repository");
    }
    if (auditResolved === accountResolved || isPathInside(auditResolved, accountResolved) || isPathInside(accountResolved, auditResolved)) {
      errors.push("server storage directories must be separate and non-nested");
    }
    if (auditParent !== accountParent) {
      errors.push("server storage directories must share one approved storage root");
    }
    if (path.basename(auditResolved) !== "audit-ledger") {
      errors.push("audit ledger directory must end with audit-ledger");
    }
    if (path.basename(accountResolved) !== "account-registry") {
      errors.push("account registry directory must end with account-registry");
    }
    storageRoot = errors.length ? "" : auditParent;
  }
  return {
    status: errors.length ? "BLOCKED" : "READY_TO_CREATE",
    errors,
    evidence: {
      storageRootStatus: storageRoot ? "SET_REDACTED" : "MISSING",
      storageRootDigest: storageRoot ? sha256Text(storageRoot) : "",
      targetCount: auditLedgerDir && accountRegistryDir ? 2 : 0,
    },
  };
}

function serverEnvStatus(root, envPath) {
  const resolved = path.resolve(root, envPath);
  const errors = [];
  if (!isPathInside(root, resolved)) {
    errors.push("server env path must stay inside the repository");
  } else if (!existsSync(resolved)) {
    errors.push("server runtime env file is missing");
  }
  return {
    status: errors.length ? "BLOCKED" : "READY",
    errors,
    evidence: {
      envPath: isPathInside(root, resolved) ? relativePath(root, resolved) : "INVALID",
      fileStatus: errors.length ? "MISSING_OR_INVALID" : "PRESENT",
    },
  };
}

async function guardedCall(root, fn, fallbackTitle) {
  try {
    return await fn();
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      evidence: {},
      summary: {},
      report: { status: "BLOCKED", errors: [fallbackTitle] },
    };
  }
}

export async function buildOperationalLaunchApplyReadiness({
  root = repoRoot,
  inputPath = "",
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  platform = process.platform,
  generatedAt = new Date().toISOString(),
  now = Date.now(),
} = {}) {
  const resolvedRoot = path.resolve(root);
  if (!inputPath) {
    throw new Error("launch inputs apply-check --input is required");
  }
  const resolvedInput = resolveInsideRepo(resolvedRoot, inputPath, "input");
  if (!existsSync(resolvedInput)) {
    throw new Error("launch inputs file is missing");
  }
  const { input, errors: inputReadErrors } = safeReadInput(resolvedInput);
  const review = reviewOperationalLaunchInputs({ root: resolvedRoot, inputPath, generatedAt });
  const phases = [];

  phases.push(
    phase(
      {
        id: "launch-input-review",
        title: "Launch input review",
        status: review.status === "READY_FOR_OPERATOR_APPLY" && !inputReadErrors.length ? "READY" : "BLOCKED",
        evidence: {
          schema: input?.schema === OPERATIONAL_LAUNCH_INPUTS_SCHEMA ? OPERATIONAL_LAUNCH_INPUTS_SCHEMA : "INVALID_OR_MISSING",
          inputDigest: review.summary.inputDigest,
          readyInputCount: review.summary.readyInputCount,
          blockedInputCount: review.summary.blockedInputCount,
        },
        errors: [...review.errors, ...inputReadErrors],
        nextActions: review.status === "READY_FOR_OPERATOR_APPLY" ? [] : ["Fix the private launch inputs file and rerun apply-check."],
      },
      resolvedRoot,
    ),
  );

  const serverEnv = serverEnvStatus(resolvedRoot, envPath);
  phases.push(phase({ id: "server-env", title: "Private server env file", ...serverEnv }, resolvedRoot));

  if (input) {
    phases.push(
      phase(
        {
          id: "public-operations",
          title: "Public operations env",
          status: review.status === "READY_FOR_OPERATOR_APPLY" ? "READY_TO_APPLY" : "BLOCKED",
          evidence: {
            routeCount: 3,
            baseUrlStatus: review.fields.find((field) => field.id === "publicBaseUrl")?.evidence?.valueStatus || "BLOCKED",
          },
          errors: review.status === "READY_FOR_OPERATOR_APPLY" ? [] : ["launch input review must pass before public operations env apply"],
          nextActions: ["Run npm run ops:public-env:init from the private command packet."],
        },
        resolvedRoot,
      ),
    );

    const hosted = validateHostedSecurityHeaderAuditApply({
      root: resolvedRoot,
      envPath,
      auditReport: input.publicOperations?.hostedSecurityHeaderAuditReportPath,
    });
    phases.push(
      phase(
        {
          id: "hosted-audit",
          title: "Hosted security header audit evidence",
          status: hosted.valid ? "READY_TO_APPLY" : "BLOCKED",
          evidence: hosted.evidence,
          errors: hosted.errors,
          nextActions: hosted.valid ? ["Run npm run ops:hosted-audit:apply from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const storage = storageRootStatus({ root: resolvedRoot, input });
    phases.push(
      phase(
        {
          id: "server-storage",
          title: "Server storage root",
          ...storage,
          nextActions: storage.status === "READY_TO_CREATE" ? ["Run npm run server:storage:init from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const origin = validateServerOriginApproval({
      root: resolvedRoot,
      envPath,
      origins: input.serverRuntime?.serverAllowedOrigins || [],
      approvalRef: input.serverRuntime?.serverOriginApprovalRef || "",
    });
    phases.push(
      phase(
        {
          id: "server-origin",
          title: "Server origin approval",
          status: origin.valid ? "READY_TO_APPLY" : "BLOCKED",
          evidence: origin.evidence,
          errors: origin.errors,
          nextActions: origin.valid ? ["Run npm run server:origin:apply from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const trustedCandidate = await guardedCall(resolvedRoot, () =>
      reviewTrustedKeyCandidateFile({
        root: resolvedRoot,
        candidatePath: input.serverRuntime?.trustedKeyCandidatePath || "",
        patchOutputPath: "",
        generatedAt,
        now,
      }), "trusted key candidate review failed");
    phases.push(
      phase(
        {
          id: "trusted-key-review",
          title: "Trusted key candidate review",
          status: trustedCandidate.valid ? "READY_TO_REVIEW" : "BLOCKED",
          evidence: {
            reviewStatus: trustedCandidate.report?.status || "BLOCKED",
            fingerprintStatus: trustedCandidate.report?.key?.fingerprint ? "SET_REDACTED" : "MISSING",
          },
          errors: trustedCandidate.report?.errors || trustedCandidate.errors || [],
          nextActions: trustedCandidate.valid ? ["Run npm run security:trusted-key:review from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const patchPath = input.serverRuntime?.trustedKeyRegistryPatchPath || "";
    const resolvedPatch = path.resolve(resolvedRoot, patchPath);
    const patchExists = patchPath && isPathInside(resolvedRoot, resolvedPatch) && existsSync(resolvedPatch);
    const trustedPatch = patchExists
      ? validateTrustedKeyRegistryPatchApplication({
          root: resolvedRoot,
          patchPath,
          approvalRef: input.serverRuntime?.trustedKeyApprovalRef || "",
          now,
        })
      : {
          valid: trustedCandidate.valid && Boolean(patchPath) && isPathInside(resolvedRoot, resolvedPatch),
          errors: trustedCandidate.valid ? [] : ["trusted key candidate review must pass before registry patch apply"],
          approval: { approvalRefStatus: "PENDING_REVIEW", approvalRefDigest: "" },
          patch: { validationStatus: patchPath ? "PENDING_REVIEW_OUTPUT" : "MISSING", keyCount: 0, activeKeyCount: 0 },
        };
    phases.push(
      phase(
        {
          id: "trusted-key-apply",
          title: "Trusted key registry patch apply",
          status: trustedPatch.valid ? (patchExists ? "READY_TO_APPLY" : "READY_AFTER_REVIEW") : "BLOCKED",
          evidence: {
            patchFileStatus: patchExists ? "PRESENT" : "WILL_BE_GENERATED_BY_REVIEW",
            approvalRefStatus: trustedPatch.approval?.approvalRefStatus || "UNKNOWN",
            patchValidationStatus: trustedPatch.patch?.validationStatus || "UNKNOWN",
          },
          errors: trustedPatch.errors,
          nextActions: trustedPatch.valid ? ["Run npm run server:trusted-key:apply after the registry patch is generated and approved."] : [],
        },
        resolvedRoot,
      ),
    );

    const desktopEnv = validateDesktopReleaseEnvApply({
      root: resolvedRoot,
      channel: input.desktopRelease?.desktopReleaseChannel || "",
      updateUrl: input.desktopRelease?.desktopUpdateUrl || "",
      publishApprovalRef: input.desktopRelease?.desktopPublishApprovalRef || "",
    });
    phases.push(
      phase(
        {
          id: "desktop-release-env",
          title: "Desktop release env",
          status: desktopEnv.valid ? "READY_TO_APPLY" : "BLOCKED",
          evidence: desktopEnv.evidence,
          errors: desktopEnv.errors,
          nextActions: desktopEnv.valid ? ["Run npm run desktop:release-env:apply from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const updateFeed = await guardedCall(resolvedRoot, () =>
      validateDesktopUpdateFeed({
        root: resolvedRoot,
        feedDir: input.desktopRelease?.signedDesktopFeedDir,
        platform,
      }), "desktop update feed validation failed");
    phases.push(
      phase(
        {
          id: "desktop-update-feed",
          title: "Desktop update feed",
          status: updateFeed.valid ? "READY" : "BLOCKED",
          evidence: {
            metadataFile: updateFeed.metadata?.file || "MISSING",
            versionStatus: updateFeed.valid ? "MATCH" : "BLOCKED",
            artifactCount: updateFeed.artifacts?.length || 0,
          },
          errors: updateFeed.errors,
          nextActions: updateFeed.valid ? ["Run npm run desktop:update-feed:check from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const desktopPublish = await guardedCall(resolvedRoot, () =>
      validateDesktopPublishReadiness({
        root: resolvedRoot,
        feedDir: input.desktopRelease?.signedDesktopFeedDir,
        platform,
      }), "desktop publish readiness validation failed");
    phases.push(
      phase(
        {
          id: "desktop-publish",
          title: "Desktop publish readiness",
          status: desktopPublish.valid ? "READY" : "BLOCKED",
          evidence: {
            releaseTagStatus: desktopPublish.envSummary?.JIUM_DESKTOP_RELEASE_TAG || "MISSING",
            publishApprovalStatus: desktopPublish.envSummary?.JIUM_DESKTOP_PUBLISH_APPROVAL || "MISSING",
            githubContextStatus: desktopPublish.envSummary?.GITHUB_REPOSITORY || "MISSING",
            githubTokenStatus: desktopPublish.envSummary?.GITHUB_TOKEN || "MISSING",
          },
          errors: desktopPublish.errors,
          nextActions: desktopPublish.valid ? ["Run npm run desktop:publish:check from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const approvalInputs = approvalInputStatus({ root: resolvedRoot, input });
    phases.push(
      phase(
        {
          id: "approval-inputs",
          title: "Operational approval input packet",
          ...approvalInputs,
          nextActions: approvalInputs.status === "READY_TO_APPLY" ? ["Run npm run ops:approvals:apply-inputs from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );

    const goLiveEnv = validateOperationalGoLiveEnvApply({
      root: resolvedRoot,
      envPath,
      incidentOwnerRef: input.goLive?.incidentOwnerRef || "",
      now,
    });
    phases.push(
      phase(
        {
          id: "go-live-env",
          title: "Operational go-live env",
          status: goLiveEnv.valid ? "READY_TO_APPLY" : "BLOCKED",
          evidence: goLiveEnv.evidence,
          errors: goLiveEnv.errors,
          nextActions: goLiveEnv.valid ? ["Run npm run ops:go-live:env:apply from the private command packet."] : [],
        },
        resolvedRoot,
      ),
    );
  }

  const blockedPhases = phases.filter((entry) => entry.status === "BLOCKED");
  const baseReport = {
    schema: OPERATIONAL_LAUNCH_APPLY_READINESS_SCHEMA,
    generatedAt,
    status: blockedPhases.length ? "BLOCKED" : "READY_TO_RUN_PRIVATE_COMMAND_PACKET",
    version: readPackageVersion(resolvedRoot),
    summary: {
      phaseCount: phases.length,
      readyPhaseCount: phases.length - blockedPhases.length,
      blockedPhaseCount: blockedPhases.length,
      inputDigest: review.summary.inputDigest,
      launchReviewStatus: review.status,
    },
    phases,
    nextActions: blockedPhases.length
      ? [
          "Resolve blocked phases before running the private launch command packet.",
          "Regenerate the private command packet with npm run ops:launch-inputs:commands after the filled launch input file changes.",
        ]
      : [
          "Run the private command packet generated by npm run ops:launch-inputs:commands from an approved operator shell.",
          "Rerun npm run ops:go-live:check after the private command packet completes.",
        ],
    safetyNotes: [
      "This report stores statuses, counts, relative private paths, and SHA-256 digests only.",
      "It does not store raw URLs, storage paths, feed paths, support contacts, incident owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "This command does not apply env files, approval files, trusted keys, desktop release settings, or go-live flags.",
    ],
  };
  const leakScan = scanReportForLeaks(baseReport);
  return {
    ...baseReport,
    status: leakScan.status === "PASS" ? baseReport.status : "BLOCKED",
    leakScan,
    errors: leakScan.findings.map((finding) => `launch apply readiness report contains unsafe ${finding.label}`),
  };
}

export function writeOperationalLaunchApplyReadinessFiles({
  root = repoRoot,
  report,
  outputPath = "",
  format = "markdown",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const reportDir = safePrepareReportDir(resolvedRoot);
  const jsonPath = path.join(reportDir, OPERATIONAL_LAUNCH_APPLY_READINESS_JSON);
  const markdownPath = path.join(reportDir, OPERATIONAL_LAUNCH_APPLY_READINESS_MARKDOWN);
  writeJson(jsonPath, report);
  writeText(markdownPath, formatOperationalLaunchApplyReadinessMarkdown(report));
  if (outputPath) {
    const resolvedOutput = resolveInsideRepo(resolvedRoot, outputPath, "output");
    writeText(
      resolvedOutput,
      format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatOperationalLaunchApplyReadinessMarkdown(report),
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

export function formatOperationalLaunchApplyReadinessMarkdown(report) {
  const lines = [
    "# JiumAI Operational Launch Apply Readiness",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Version: ${report.version || "MISSING"}`,
    `- Ready phases: ${report.summary.readyPhaseCount}/${report.summary.phaseCount}`,
    `- Blocked phases: ${report.summary.blockedPhaseCount}`,
    `- Launch review: ${report.summary.launchReviewStatus}`,
    `- Input digest: ${report.summary.inputDigest}`,
    `- Leak scan: ${report.leakScan.status}`,
    "",
    "## Phases",
    ...report.phases.map((entry) => `- ${entry.status} ${entry.id}: ${entry.errorCount} error(s)`),
    "",
    "## Errors",
    ...(report.phases.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`)).length
      ? report.phases.flatMap((entry) => entry.errors.map((error) => `- ${entry.id}: ${error}`))
      : ["- None"]),
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
    inputPath: "",
    envPath: DEFAULT_SERVER_RUNTIME_ENV_PATH,
    outputPath: "",
    platform: process.platform,
    format: "text",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1] || args.root);
      index += 1;
    } else if (arg.startsWith("--root=")) {
      args.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--input") {
      args.inputPath = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--input=")) {
      args.inputPath = arg.slice("--input=".length);
    } else if (arg === "--env") {
      args.envPath = argv[index + 1] || args.envPath;
      index += 1;
    } else if (arg.startsWith("--env=")) {
      args.envPath = arg.slice("--env=".length);
    } else if (arg === "--platform") {
      args.platform = argv[index + 1] || args.platform;
      index += 1;
    } else if (arg.startsWith("--platform=")) {
      args.platform = arg.slice("--platform=".length);
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
    if (args.outputPath) {
      resolveInsideRepo(args.root, args.outputPath, "output");
    }
    const report = await buildOperationalLaunchApplyReadiness({
      root: args.root,
      inputPath: args.inputPath,
      envPath: args.envPath,
      platform: args.platform,
    });
    const written = writeOperationalLaunchApplyReadinessFiles({
      root: args.root,
      report,
      outputPath: args.outputPath,
      format: args.format === "json" ? "json" : "markdown",
    });
    if (args.format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatOperationalLaunchApplyReadinessMarkdown(report));
    }
    console.log(`Operational launch apply readiness written: ${args.outputPath || written.reportDirRelative}`);
    if (report.status === "BLOCKED") {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
