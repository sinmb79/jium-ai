import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const HOSTED_SECURITY_HEADER_AUDIT_SCHEMA = "jium-security-header-url-audit-v1";
export const HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY = "JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT";

function resolvePrivateEvidencePath(root, candidate) {
  const value = String(candidate || "").trim();
  if (!value) {
    return "";
  }
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function summarizeHostedSecurityHeaderAudit(report) {
  return {
    schema: typeof report?.schema === "string" ? report.schema : "",
    status: typeof report?.status === "string" ? report.status : "",
    targetUrlState: typeof report?.summary?.targetUrlState === "string" ? report.summary.targetUrlState : "",
    fetchState: typeof report?.summary?.fetchState === "string" ? report.summary.fetchState : "",
    httpStatus: typeof report?.summary?.httpStatus === "number" ? report.summary.httpStatus : null,
    checkedHeaderCount:
      typeof report?.summary?.checkedHeaderCount === "number" ? report.summary.checkedHeaderCount : 0,
    passCount: typeof report?.summary?.passCount === "number" ? report.summary.passCount : 0,
    failureCount: typeof report?.summary?.failureCount === "number" ? report.summary.failureCount : 0,
  };
}

function missingSummary(envStatus, fileStatus = "MISSING") {
  return {
    [HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY]: envStatus,
    fileStatus,
    schema: "",
    status: "MISSING",
    targetUrlState: "",
    fetchState: "",
    httpStatus: null,
    checkedHeaderCount: 0,
    passCount: 0,
    failureCount: 0,
  };
}

export function validateHostedSecurityHeaderAuditEvidence({ root, env = process.env } = {}) {
  const reportPath = resolvePrivateEvidencePath(root || process.cwd(), env[HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY]);
  const errors = [];

  if (!reportPath) {
    errors.push(`hosted security header audit evidence missing: ${HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY}`);
    return {
      valid: false,
      errors,
      sourceSummary: missingSummary("MISSING"),
    };
  }

  if (!existsSync(reportPath)) {
    errors.push("hosted security header audit report file missing");
    return {
      valid: false,
      errors,
      sourceSummary: missingSummary("SET"),
    };
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    errors.push("hosted security header audit report is not valid JSON");
    return {
      valid: false,
      errors,
      sourceSummary: missingSummary("SET", "INVALID_JSON"),
    };
  }

  const summary = summarizeHostedSecurityHeaderAudit(report);

  if (summary.schema !== HOSTED_SECURITY_HEADER_AUDIT_SCHEMA) {
    errors.push("hosted security header audit report schema is invalid");
  }
  if (summary.status !== "READY") {
    errors.push("hosted security header audit report is not READY");
  }
  if (summary.targetUrlState !== "HTTPS") {
    errors.push("hosted security header audit report must target HTTPS production hosting");
  }
  if (summary.fetchState !== "COMPLETED") {
    errors.push("hosted security header audit report fetch state must be COMPLETED");
  }
  if (typeof summary.httpStatus !== "number" || summary.httpStatus >= 400) {
    errors.push("hosted security header audit report HTTP status must be below 400");
  }
  if (summary.failureCount !== 0) {
    errors.push("hosted security header audit report has blocking header failures");
  }

  return {
    valid: errors.length === 0,
    errors,
    sourceSummary: {
      [HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY]: "SET",
      fileStatus: "FOUND",
      ...summary,
    },
  };
}
