export const HOSTED_SECURITY_HEADER_AUDIT_SCHEMA: "jium-security-header-url-audit-v1";
export const HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY: "JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT";

export type HostedSecurityHeaderAuditReadiness = {
  valid: boolean;
  errors: string[];
  sourceSummary: {
    JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: "SET" | "MISSING";
    fileStatus: "FOUND" | "MISSING" | "INVALID_JSON";
    schema: string;
    status: string;
    targetUrlState: string;
    fetchState: string;
    httpStatus: number | null;
    checkedHeaderCount: number;
    passCount: number;
    failureCount: number;
  };
};

export function validateHostedSecurityHeaderAuditEvidence(options?: {
  root?: string;
  env?: Record<string, string | undefined>;
}): HostedSecurityHeaderAuditReadiness;
