#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATIONAL_APPROVAL_RECORDS_SCHEMA,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
  resolveOperationalApprovalRecordsPath,
  validateOperationalApprovalRecords,
  buildOperationalApprovalRecordsReport,
} from "./check-operational-approval-records.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function parseDesktopReleaseTag(tag, fallbackVersion) {
  const value = String(tag || "").trim();
  return value || (fallbackVersion ? `v${fallbackVersion}` : "");
}

function templateScope(type, releaseTag) {
  return `${releaseTag || "release"}-${type.toLowerCase().replaceAll("_", "-")}`;
}

export function buildOperationalApprovalRecordsTemplate({
  root = repoRoot,
  env = process.env,
  generatedAt = new Date().toISOString(),
} = {}) {
  const packageVersion = readPackageVersion(root);
  const releaseTag = parseDesktopReleaseTag(env.JIUM_DESKTOP_RELEASE_TAG, packageVersion);
  return {
    schema: OPERATIONAL_APPROVAL_RECORDS_SCHEMA,
    generatedAt,
    packageVersion,
    releaseTag,
    publicAppUrlStatus: "SET_HTTPS",
    privacyNoticeUrlStatus: "SET_HTTPS",
    records: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type, index) => ({
      id: `REPLACE-ME-approval-${String(index + 1).padStart(2, "0")}`,
      type,
      status: "PENDING_APPROVAL",
      approvedAt: generatedAt,
      approvedByRef: `REPLACE-ME-approver-${String(index + 1).padStart(2, "0")}`,
      referenceId: `REPLACE-ME-OPS-${String(index + 1).padStart(4, "0")}`,
      scope: `REPLACE-ME-${templateScope(type, releaseTag)}`,
      evidenceDigest: `sha256-${"0".repeat(64)}`,
      expiresAt: "",
    })),
  };
}

export function writeOperationalApprovalRecordsTemplate({
  root = repoRoot,
  env = process.env,
  outputPath = "",
  force = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const resolved = outputPath
    ? { filePath: path.resolve(root, outputPath), sourceStatus: "SET", configured: true }
    : resolveOperationalApprovalRecordsPath({ root, env });
  if (existsSync(resolved.filePath) && !force) {
    throw new Error("operational approval records template already exists; pass --force to overwrite");
  }
  const template = buildOperationalApprovalRecordsTemplate({ root, env, generatedAt });
  mkdirSync(path.dirname(resolved.filePath), { recursive: true });
  writeFileSync(resolved.filePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
  const readiness = validateOperationalApprovalRecords({
    root,
    env: { ...env, JIUM_OPERATIONAL_APPROVAL_RECORDS: resolved.filePath },
  });
  const report = buildOperationalApprovalRecordsReport(readiness, { generatedAt });
  return {
    filePath: resolved.filePath,
    sourceStatus: resolved.sourceStatus,
    template,
    report,
  };
}

function parseCliArgs(argv) {
  const args = { outputPath: "", force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") {
      args.force = true;
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
    const result = writeOperationalApprovalRecordsTemplate({
      outputPath: args.outputPath,
      force: args.force,
    });
    console.log(`Operational approval records template written: ${path.relative(repoRoot, result.filePath).replace(/\\/g, "/")}`);
    console.log(`Template status: ${result.report.status}`);
    console.log("Replace all REPLACE-ME placeholders, set approved records to APPROVED only after human approval, then run npm run ops:approvals:check.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
