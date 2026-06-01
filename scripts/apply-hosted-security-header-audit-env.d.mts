export const HOSTED_SECURITY_HEADER_AUDIT_ENV_APPLY_BUNDLE_DIR: "dist/hosted-security-header-audit-env";

export type HostedSecurityHeaderAuditApplyReport = {
  schema: "jium-hosted-security-header-audit-env-apply-v1";
  generatedAt: string;
  status: "APPLIED" | "BLOCKED";
  summary: {
    envPath: string;
    envUpdateStatus: "UPDATED" | "UNCHANGED" | "SKIPPED" | string;
    auditReportPathStatus: "SET_REDACTED" | "MISSING" | string;
    auditStatus: string;
    targetUrlState: string;
    fetchState: string;
    failureCount: number;
  };
  evidence: {
    auditReportPathStatus: "SET_REDACTED" | "MISSING" | string;
    auditReportDigest: string;
    auditStatus: string;
    targetUrlState: string;
    fetchState: string;
    failureCount: number;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateHostedSecurityHeaderAuditApply(options?: {
  root?: string;
  envPath?: string;
  auditReport?: string;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidence: HostedSecurityHeaderAuditApplyReport["evidence"];
  summary: {
    envPath: string;
    auditReportPathStatus: string;
    auditStatus: string;
    targetUrlState: string;
    fetchState: string;
    failureCount: number;
  };
};

export function applyHostedSecurityHeaderAuditEnv(options?: {
  root?: string;
  envPath?: string;
  auditReport?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: HostedSecurityHeaderAuditApplyReport;
}>;

export function formatHostedSecurityHeaderAuditApplyMarkdown(report: HostedSecurityHeaderAuditApplyReport): string;
