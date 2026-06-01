#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const OPERATIONAL_APPROVAL_RECORDS_SCHEMA = "jium-operational-approval-records-v1";
export const DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH = "ops/private/operational-approval-records.json";

export const REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES = [
  "GO_LIVE_APPROVAL",
  "LEGAL_REVIEW_APPROVAL",
  "RELEASE_EVIDENCE_REVIEW",
  "DATA_RETENTION_POLICY_ACK",
  "SUPPORT_CONTACT_ROUTE_ASSIGNED",
  "INCIDENT_RESPONSE_OWNER_ASSIGNED",
];

const ALLOWED_PACKET_KEYS = new Set([
  "schema",
  "generatedAt",
  "packageVersion",
  "releaseTag",
  "publicAppUrlStatus",
  "privacyNoticeUrlStatus",
  "records",
]);

const ALLOWED_RECORD_KEYS = new Set([
  "id",
  "type",
  "status",
  "approvedAt",
  "approvedByRef",
  "referenceId",
  "scope",
  "evidenceDigest",
  "expiresAt",
]);

const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
const SHA256_DIGEST_PATTERN = /^sha256-[a-f0-9]{64}$/;
const REQUIRED_URL_STATUS = "SET_HTTPS";

const SENSITIVE_VALUE_PATTERNS = [
  { label: "raw URL", pattern: /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|discord\.gg\/)/i },
  { label: "email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { label: "phone-like value", pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/ },
  { label: "secret-like value", pattern: /(gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/i },
  { label: "placeholder value", pattern: /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL)\b/i },
];

function present(value) {
  return Boolean(String(value || "").trim());
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version || "";
  } catch {
    return "";
  }
}

function parseIso(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function resolveOperationalApprovalRecordsPath({ root = repoRoot, env = process.env } = {}) {
  const configured = String(env.JIUM_OPERATIONAL_APPROVAL_RECORDS || "").trim();
  const relativeOrAbsolutePath = configured || DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH;
  return {
    configured: Boolean(configured),
    sourceStatus: configured ? "SET" : "DEFAULT_PRIVATE_PATH",
    filePath: path.resolve(root, relativeOrAbsolutePath),
  };
}

function unsafeStringFindings(value, location = "$", findings = []) {
  if (typeof value === "string") {
    for (const { label, pattern } of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        findings.push(`${location} contains ${label}`);
      }
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => unsafeStringFindings(entry, `${location}[${index}]`, findings));
    return findings;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => unsafeStringFindings(entry, `${location}.${key}`, findings));
  }
  return findings;
}

function unknownKeyErrors(value, allowedKeys, label) {
  if (!isPlainObject(value)) {
    return [`${label} must be a JSON object`];
  }
  return Object.keys(value)
    .filter((key) => !allowedKeys.has(key))
    .map((key) => `${label} contains unsupported field: ${key}`);
}

function safeRefErrors(record, fieldName) {
  const value = record[fieldName];
  if (!present(value)) {
    return [`approval record ${record.type || record.id || "UNKNOWN"} missing ${fieldName}`];
  }
  if (!SAFE_REF_PATTERN.test(String(value))) {
    return [`approval record ${record.type || record.id || "UNKNOWN"} ${fieldName} must be a short pseudonymous reference`];
  }
  return [];
}

function approvalNextActionFor(error) {
  if (error.includes("file missing")) {
    return "Create the private operational approval records JSON and point JIUM_OPERATIONAL_APPROVAL_RECORDS to it.";
  }
  if (error.includes("schema")) {
    return `Use schema ${OPERATIONAL_APPROVAL_RECORDS_SCHEMA} for the approval records packet.`;
  }
  if (error.includes("unsupported field") || error.includes("contains raw") || error.includes("contains email") || error.includes("contains phone")) {
    return "Remove raw URLs, contacts, owner names, secrets, and free-form sensitive fields from the approval records packet.";
  }
  if (error.includes("packageVersion") || error.includes("releaseTag")) {
    return "Align the approval records packet with package.json version and the approved release tag.";
  }
  if (error.includes("publicAppUrlStatus") || error.includes("privacyNoticeUrlStatus")) {
    return "Confirm the public app and privacy notice URLs externally, then store only SET_HTTPS status in the packet.";
  }
  if (error.includes("missing required approval record")) {
    return "Add one approved pseudonymous record for every required operating approval type.";
  }
  if (error.includes("expired")) {
    return "Refresh expired approval evidence before go-live.";
  }
  return "Resolve this operational approval record blocker before go-live.";
}

export function validateOperationalApprovalRecords({
  root = repoRoot,
  env = process.env,
  now = Date.now(),
} = {}) {
  const errors = [];
  const packageVersion = readPackageVersion(root);
  const expectedReleaseTag = present(env.JIUM_DESKTOP_RELEASE_TAG) ? String(env.JIUM_DESKTOP_RELEASE_TAG).trim() : packageVersion ? `v${packageVersion}` : "";
  const source = resolveOperationalApprovalRecordsPath({ root, env });
  const sourceSummary = {
    JIUM_OPERATIONAL_APPROVAL_RECORDS: source.sourceStatus,
    fileStatus: existsSync(source.filePath) ? "FOUND" : "MISSING",
  };

  let packet = null;
  if (!existsSync(source.filePath)) {
    errors.push("operational approval records file missing");
  } else {
    try {
      packet = JSON.parse(readFileSync(source.filePath, "utf8"));
    } catch {
      errors.push("operational approval records file is not valid JSON");
    }
  }

  const recordTypesPresent = [];
  const requiredRecordStatus = Object.fromEntries(REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type) => [type, "MISSING"]));

  if (packet) {
    errors.push(...unknownKeyErrors(packet, ALLOWED_PACKET_KEYS, "approval records packet"));
    unsafeStringFindings(packet).forEach((finding) => errors.push(`approval records packet ${finding}`));

    if (packet.schema !== OPERATIONAL_APPROVAL_RECORDS_SCHEMA) {
      errors.push(`approval records packet schema must be ${OPERATIONAL_APPROVAL_RECORDS_SCHEMA}`);
    }
    if (!Number.isFinite(parseIso(packet.generatedAt))) {
      errors.push("approval records packet generatedAt must be an ISO date");
    }
    if (packet.packageVersion !== packageVersion) {
      errors.push("approval records packet packageVersion must match package.json version");
    }
    if (packet.releaseTag !== expectedReleaseTag) {
      errors.push("approval records packet releaseTag must match the approved release tag");
    }
    if (packet.publicAppUrlStatus !== REQUIRED_URL_STATUS) {
      errors.push("approval records packet publicAppUrlStatus must be SET_HTTPS");
    }
    if (packet.privacyNoticeUrlStatus !== REQUIRED_URL_STATUS) {
      errors.push("approval records packet privacyNoticeUrlStatus must be SET_HTTPS");
    }
    if (!Array.isArray(packet.records)) {
      errors.push("approval records packet records must be an array");
    } else {
      const seenTypes = new Set();
      packet.records.forEach((record, index) => {
        if (!isPlainObject(record)) {
          errors.push(`approval record at index ${index} must be a JSON object`);
          return;
        }
        errors.push(...unknownKeyErrors(record, ALLOWED_RECORD_KEYS, `approval record ${record.type || index}`));
        if (!REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.includes(record.type)) {
          errors.push(`approval record ${record.id || index} has unsupported type`);
        } else {
          recordTypesPresent.push(record.type);
          if (seenTypes.has(record.type)) {
            errors.push(`approval record type duplicated: ${record.type}`);
          }
          seenTypes.add(record.type);
          requiredRecordStatus[record.type] = record.status === "APPROVED" ? "APPROVED" : "MISSING_OR_NOT_APPROVED";
        }
        ["id", "approvedByRef", "referenceId", "scope"].forEach((fieldName) => {
          errors.push(...safeRefErrors(record, fieldName));
        });
        if (record.status !== "APPROVED") {
          errors.push(`approval record ${record.type || record.id || index} must be APPROVED`);
        }
        if (!Number.isFinite(parseIso(record.approvedAt))) {
          errors.push(`approval record ${record.type || record.id || index} approvedAt must be an ISO date`);
        }
        if (present(record.evidenceDigest) && !SHA256_DIGEST_PATTERN.test(String(record.evidenceDigest))) {
          errors.push(`approval record ${record.type || record.id || index} evidenceDigest must be sha256-hex`);
        }
        if (present(record.expiresAt)) {
          const expiresAt = parseIso(record.expiresAt);
          if (!Number.isFinite(expiresAt)) {
            errors.push(`approval record ${record.type || record.id || index} expiresAt must be an ISO date`);
          } else if (expiresAt <= now) {
            errors.push(`approval record ${record.type || record.id || index} is expired`);
          }
        }
      });
    }
  }

  for (const requiredType of REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES) {
    if (requiredRecordStatus[requiredType] !== "APPROVED") {
      errors.push(`missing required approval record: ${requiredType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    packageVersion,
    expectedReleaseTag,
    sourceSummary,
    recordTypesPresent: Array.from(new Set(recordTypesPresent)).sort(),
    requiredRecordStatus,
  };
}

export function buildOperationalApprovalRecordsReport(readiness, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const approvedRecordCount = Object.values(readiness.requiredRecordStatus).filter((status) => status === "APPROVED").length;
  const requiredRecordCount = REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.length;
  const checks = [
    {
      id: "private-record-source",
      label: "Private approval records file is present",
      status: readiness.sourceSummary.fileStatus === "FOUND" ? "PASS" : "BLOCKED",
    },
    {
      id: "required-approval-records",
      label: "All required approval record types are approved",
      status: approvedRecordCount === requiredRecordCount ? "PASS" : "BLOCKED",
    },
    {
      id: "release-alignment",
      label: "Approval packet release tag and package version match the build",
      status: readiness.errors.some((error) => error.includes("packageVersion") || error.includes("releaseTag")) ? "BLOCKED" : "PASS",
    },
    {
      id: "url-statuses",
      label: "Public app and privacy notice URL checks are recorded as HTTPS statuses only",
      status: readiness.errors.some((error) => error.includes("publicAppUrlStatus") || error.includes("privacyNoticeUrlStatus")) ? "BLOCKED" : "PASS",
    },
    {
      id: "redaction-safety",
      label: "Approval packet avoids raw URLs, contacts, names, and secrets",
      status: readiness.errors.some((error) => error.includes("unsupported field") || error.includes("contains ")) ? "BLOCKED" : "PASS",
    },
  ];

  return {
    generatedAt,
    status: readiness.valid ? "READY" : "BLOCKED",
    summary: {
      errorCount: readiness.errors.length,
      packageVersion: readiness.packageVersion,
      expectedReleaseTag: readiness.expectedReleaseTag,
      requiredRecordCount,
      approvedRecordCount,
      sourceStatus: readiness.sourceSummary.JIUM_OPERATIONAL_APPROVAL_RECORDS,
      fileStatus: readiness.sourceSummary.fileStatus,
    },
    sourceSummary: readiness.sourceSummary,
    requiredRecordStatus: readiness.requiredRecordStatus,
    checks,
    errors: [...readiness.errors],
    nextActions: readiness.errors.length
      ? Array.from(new Set(readiness.errors.map(approvalNextActionFor)))
      : ["Archive this redacted approval records report with the release handoff bundle."],
    safetyNotes: [
      "This report stores only approval type status, package version, release tag, counts, and source/file presence.",
      "The private approval records packet must not contain raw public URLs, support contacts, owner names, secrets, tokens, certificate material, victim indicators, invite links, onion addresses, emails, or phone numbers.",
      "The report is evidence of approval-record completeness, not a substitute for legal or institutional approval.",
    ],
  };
}

export function formatOperationalApprovalRecordsMarkdown(report) {
  const lines = [
    "# JiumAI Operational Approval Records Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Status: ${report.status}`,
    `- Package version: ${report.summary.packageVersion || "MISSING"}`,
    `- Expected release tag: ${report.summary.expectedReleaseTag || "MISSING"}`,
    `- Approval records: ${report.summary.approvedRecordCount}/${report.summary.requiredRecordCount}`,
    `- Source: ${report.summary.sourceStatus}`,
    `- File: ${report.summary.fileStatus}`,
    "",
    "## Checks",
    ...report.checks.map((check) => `- ${check.status} ${check.id}: ${check.label}`),
    "",
    "## Required Records",
    ...Object.entries(report.requiredRecordStatus).map(([type, status]) => `- ${status} ${type}`),
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

function parseCliArgs(argv) {
  const args = { format: "text", outputPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
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

function writeOutput(content, outputPath) {
  if (!outputPath) {
    console.log(content);
    return;
  }
  mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  writeFileSync(outputPath, content, "utf8");
  console.log(`Operational approval records report written: ${outputPath}`);
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const readiness = validateOperationalApprovalRecords();
    const report = buildOperationalApprovalRecordsReport(readiness);
    const content = args.format === "json" ? JSON.stringify(report, null, 2) : formatOperationalApprovalRecordsMarkdown(report);
    writeOutput(content, args.outputPath);
    if (!readiness.valid) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
