import { SECURITY_HEADERS, type SecurityHeader } from "@/lib/securityHeaders";

export type HeaderReader =
  | Headers
  | {
      get(name: string): string | null;
    }
  | Record<string, string | string[] | undefined>;

export type SecurityHeaderAuditStatus = "pass" | "missing" | "mismatch";

export type SecurityHeaderAuditResult = {
  key: string;
  expected: string;
  actual: string | null;
  status: SecurityHeaderAuditStatus;
};

function normalizeHeaderValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.join(", ").trim();
  }
  return value?.trim() || null;
}

function readHeader(headers: HeaderReader, key: string) {
  if ("get" in headers && typeof headers.get === "function") {
    return normalizeHeaderValue(headers.get(key));
  }

  const match = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
  return normalizeHeaderValue(match?.[1]);
}

export function auditSecurityHeaders(headers: HeaderReader, expectedHeaders: SecurityHeader[] = SECURITY_HEADERS): SecurityHeaderAuditResult[] {
  return expectedHeaders.map((header) => {
    const actual = readHeader(headers, header.key);

    if (!actual) {
      return {
        key: header.key,
        expected: header.value,
        actual,
        status: "missing",
      };
    }

    if (actual !== header.value) {
      return {
        key: header.key,
        expected: header.value,
        actual,
        status: "mismatch",
      };
    }

    return {
      key: header.key,
      expected: header.value,
      actual,
      status: "pass",
    };
  });
}

export function hasSecurityHeaderFailures(results: SecurityHeaderAuditResult[]) {
  return results.some((result) => result.status !== "pass");
}

export function formatSecurityHeaderAudit(results: SecurityHeaderAuditResult[]) {
  return results
    .map((result) => {
      if (result.status === "pass") {
        return `PASS ${result.key}`;
      }
      if (result.status === "missing") {
        return `FAIL ${result.key}: missing`;
      }
      return `FAIL ${result.key}: expected ${result.expected}, received ${result.actual}`;
    })
    .join("\n");
}
