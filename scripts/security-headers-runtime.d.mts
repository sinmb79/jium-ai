export type SecurityHeader = {
  key: string;
  value: string;
};

export type SecurityHeaderAuditResult = {
  key: string;
  expected: string;
  actual: string | null;
  status: "pass" | "missing" | "mismatch";
};

export function getSecurityHeaders(): SecurityHeader[];

export function buildStaticHeadersFile(pathPattern?: string): string;

export function auditSecurityHeaders(
  headers: Headers | Record<string, string | string[] | undefined>,
  expectedHeaders?: SecurityHeader[],
): SecurityHeaderAuditResult[];

export function hasSecurityHeaderFailures(results: SecurityHeaderAuditResult[]): boolean;

export function formatSecurityHeaderAudit(results: SecurityHeaderAuditResult[]): string;
