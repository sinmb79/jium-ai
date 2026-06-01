#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DESKTOP_RELEASE_ENV_PATH,
  cleanDesktopEnvValue,
  isPathInside,
  relativePath,
  sha256DesktopReleaseText,
  validateDesktopPublishApprovalRef,
  validateDesktopReleaseChannel,
  validateDesktopReleaseTag,
  validateDesktopUpdateUrl,
} from "./desktop-release-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const DESKTOP_RELEASE_ENV_APPLY_BUNDLE_DIR = "dist/desktop-release-env";

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8").replace(/^\uFEFF/, "")).version || "";
  } catch {
    return "";
  }
}

function parseEnvLines(content) {
  const normalized = String(content || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  return normalized ? normalized.split("\n") : ["# JiumAI private desktop release env"];
}

function upsertEnvLine(lines, key, value) {
  const index = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
  if (index < 0) {
    lines.push(`${key}=${value}`);
    return "ADDED";
  }
  const current = lines[index].slice(lines[index].indexOf("=") + 1);
  if (current === value) {
    return "UNCHANGED";
  }
  lines[index] = `${key}=${value}`;
  return "UPDATED";
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function planDesktopReleaseEnvApply({
  root = repoRoot,
  envPath = DEFAULT_DESKTOP_RELEASE_ENV_PATH,
  channel = "",
  updateUrl = "",
  releaseTag = "",
  publishApprovalRef = "",
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedEnvPath = path.resolve(resolvedRoot, envPath);
  const packageVersion = readPackageVersion(resolvedRoot);
  const effectiveReleaseTag = cleanDesktopEnvValue(releaseTag) || (packageVersion ? `v${packageVersion}` : "");
  const cleaned = {
    channel: cleanDesktopEnvValue(channel),
    updateUrl: cleanDesktopEnvValue(updateUrl),
    releaseTag: effectiveReleaseTag,
    publishApprovalRef: cleanDesktopEnvValue(publishApprovalRef),
  };
  const errors = [
    ...validateDesktopReleaseChannel(cleaned.channel),
    ...validateDesktopUpdateUrl(cleaned.updateUrl),
    ...validateDesktopReleaseTag(cleaned.releaseTag),
    ...validateDesktopPublishApprovalRef(cleaned.publishApprovalRef),
  ];

  if (!packageVersion) {
    errors.push("package version missing: package.json version");
  }
  if (!isPathInside(resolvedRoot, resolvedEnvPath)) {
    errors.push("desktop release env path must stay inside the repository");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    root: resolvedRoot,
    envPath,
    resolvedEnvPath,
    packageVersion,
    values: cleaned,
    evidence: {
      channelStatus: cleaned.channel && !validateDesktopReleaseChannel(cleaned.channel).length ? "SET_REDACTED" : "BLOCKED",
      updateUrlStatus: cleaned.updateUrl && !validateDesktopUpdateUrl(cleaned.updateUrl).length ? "SET_HTTPS_REDACTED" : "BLOCKED",
      releaseTagStatus: cleaned.releaseTag && !validateDesktopReleaseTag(cleaned.releaseTag).length ? "SET" : "BLOCKED",
      publishApprovalRefStatus: cleaned.publishApprovalRef
        ? validateDesktopPublishApprovalRef(cleaned.publishApprovalRef).length
          ? "BLOCKED"
          : "SET_REDACTED"
        : "MISSING",
      channelDigest: cleaned.channel && !validateDesktopReleaseChannel(cleaned.channel).length ? sha256DesktopReleaseText(cleaned.channel) : "",
      updateUrlDigest: cleaned.updateUrl && !validateDesktopUpdateUrl(cleaned.updateUrl).length ? sha256DesktopReleaseText(cleaned.updateUrl) : "",
      publishApprovalRefDigest:
        cleaned.publishApprovalRef && !validateDesktopPublishApprovalRef(cleaned.publishApprovalRef).length
          ? sha256DesktopReleaseText(cleaned.publishApprovalRef)
          : "",
    },
  };
}

export function validateDesktopReleaseEnvApply(options = {}) {
  const plan = planDesktopReleaseEnvApply(options);
  return {
    valid: plan.valid,
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    evidence: { ...plan.evidence },
    summary: {
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
      packageVersion: plan.packageVersion,
      releaseTagStatus: plan.evidence.releaseTagStatus,
      channelStatus: plan.evidence.channelStatus,
      updateUrlStatus: plan.evidence.updateUrlStatus,
      publishApprovalRefStatus: plan.evidence.publishApprovalRefStatus,
    },
  };
}

function buildReport(plan, { generatedAt, applied, envUpdateStatus }) {
  return {
    schema: "jium-desktop-release-env-apply-v1",
    generatedAt,
    status: plan.valid && applied ? "APPLIED" : "BLOCKED",
    summary: {
      packageVersion: plan.packageVersion,
      releaseTag: plan.values.releaseTag,
      envPath: relativePath(plan.root, plan.resolvedEnvPath),
      envUpdateStatus,
      releaseTagStatus: plan.evidence.releaseTagStatus,
      channelStatus: plan.evidence.channelStatus,
      updateUrlStatus: plan.evidence.updateUrlStatus,
      publishApprovalRefStatus: plan.evidence.publishApprovalRefStatus,
    },
    evidence: { ...plan.evidence },
    errors: [...plan.errors],
    warnings: [...plan.warnings],
    nextActions:
      plan.valid && applied
        ? [
            "Run npm run desktop:release:check with signing secrets supplied from the approved local shell or CI secret store.",
            "Run npm run desktop:publish:check after signed artifacts, update metadata, GitHub token, and release approval are ready.",
          ]
        : ["Resolve desktop release env blockers before writing non-secret desktop release settings."],
    safetyNotes: [
      "This helper writes only desktop release lane, HTTPS update endpoint, release tag, and APPROVED publish state to the ignored desktop env file.",
      "It never writes signing certificates, certificate passwords, GitHub tokens, raw approval references, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "The report stores setting states and SHA-256 digests only; keep the ignored env file private because it contains the real updater endpoint.",
    ],
  };
}

export async function applyDesktopReleaseEnv({
  root = repoRoot,
  envPath = DEFAULT_DESKTOP_RELEASE_ENV_PATH,
  channel = "",
  updateUrl = "",
  releaseTag = "",
  publishApprovalRef = "",
  generatedAt = new Date().toISOString(),
} = {}) {
  const plan = planDesktopReleaseEnvApply({ root, envPath, channel, updateUrl, releaseTag, publishApprovalRef });
  let applied = false;
  let envUpdateStatus = "SKIPPED";

  if (plan.valid) {
    const lines = parseEnvLines(existsSync(plan.resolvedEnvPath) ? readFileSync(plan.resolvedEnvPath, "utf8") : "");
    const updates = [
      upsertEnvLine(lines, "JIUM_DESKTOP_RELEASE_CHANNEL", plan.values.channel),
      upsertEnvLine(lines, "JIUM_DESKTOP_UPDATE_URL", plan.values.updateUrl),
      upsertEnvLine(lines, "JIUM_DESKTOP_RELEASE_TAG", plan.values.releaseTag),
    ];
    if (plan.values.publishApprovalRef) {
      updates.push(upsertEnvLine(lines, "JIUM_DESKTOP_PUBLISH_APPROVAL", "APPROVED"));
    }
    envUpdateStatus = updates.some((status) => status === "ADDED" || status === "UPDATED") ? "UPDATED" : "UNCHANGED";
    writeText(plan.resolvedEnvPath, `${lines.filter((line, index) => line || index < lines.length - 1).join("\n")}\n`);
    applied = true;
  }

  const report = buildReport(plan, { generatedAt, applied, envUpdateStatus });
  const bundleDir = path.join(plan.root, DESKTOP_RELEASE_ENV_APPLY_BUNDLE_DIR);
  writeJson(path.join(bundleDir, "desktop-release-env-apply-report.json"), report);
  writeText(path.join(bundleDir, "desktop-release-env-apply-report.md"), formatDesktopReleaseEnvApplyMarkdown(report));

  return {
    valid: plan.valid,
    bundleDir,
    bundleDirRelative: relativePath(plan.root, bundleDir),
    report,
  };
}

export function formatDesktopReleaseEnvApplyMarkdown(report) {
  const lines = [
    "# JiumAI Desktop Release Env Apply",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Package version: ${report.summary.packageVersion || "MISSING"}`,
    `- Release tag: ${report.summary.releaseTag || "MISSING"}`,
    `- Env path: ${report.summary.envPath}`,
    `- Env update: ${report.summary.envUpdateStatus}`,
    `- Release channel: ${report.summary.channelStatus}`,
    `- Update URL: ${report.summary.updateUrlStatus}`,
    `- Publish approval ref: ${report.summary.publishApprovalRefStatus}`,
    `- Channel digest: ${report.evidence.channelDigest || "MISSING"}`,
    `- Update URL digest: ${report.evidence.updateUrlDigest || "MISSING"}`,
    `- Publish approval ref digest: ${report.evidence.publishApprovalRefDigest || "MISSING"}`,
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
    envPath: DEFAULT_DESKTOP_RELEASE_ENV_PATH,
    channel: "",
    updateUrl: "",
    releaseTag: "",
    publishApprovalRef: "",
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
    } else if (arg === "--channel") {
      args.channel = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--channel=")) {
      args.channel = arg.slice("--channel=".length);
    } else if (arg === "--update-url") {
      args.updateUrl = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--update-url=")) {
      args.updateUrl = arg.slice("--update-url=".length);
    } else if (arg === "--release-tag") {
      args.releaseTag = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--release-tag=")) {
      args.releaseTag = arg.slice("--release-tag=".length);
    } else if (arg === "--publish-approval-ref") {
      args.publishApprovalRef = argv[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--publish-approval-ref=")) {
      args.publishApprovalRef = arg.slice("--publish-approval-ref=".length);
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
    const result = await applyDesktopReleaseEnv({
      root: args.root,
      envPath: args.envPath,
      channel: args.channel,
      updateUrl: args.updateUrl,
      releaseTag: args.releaseTag,
      publishApprovalRef: args.publishApprovalRef,
    });
    const content = args.format === "json" ? JSON.stringify(result.report, null, 2) : formatDesktopReleaseEnvApplyMarkdown(result.report);

    if (args.outputPath) {
      writeText(path.resolve(args.root, args.outputPath), `${content.trimEnd()}\n`);
      console.log(`Desktop release env apply report written: ${args.outputPath}`);
    } else {
      console.log(content);
      console.log(`Desktop release env apply report written: ${result.bundleDirRelative}`);
    }

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
