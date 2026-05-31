import { readFileSync } from "node:fs";

const securityHeadersData = JSON.parse(readFileSync(new URL("../lib/securityHeadersData.json", import.meta.url), "utf8"));

export function getSecurityHeaders() {
  return [
    ...securityHeadersData.baseHeaders,
    {
      key: "Content-Security-Policy",
      value: securityHeadersData.enforcedCsp,
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: securityHeadersData.reportOnlyCsp,
    },
  ];
}

export function buildStaticHeadersFile(pathPattern = "/*") {
  return [`${pathPattern}`, ...getSecurityHeaders().map((header) => `  ${header.key}: ${header.value}`), ""].join("\n");
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ").trim();
  }
  return value?.trim() || null;
}

function readHeader(headers, key) {
  if (headers && typeof headers.get === "function") {
    return normalizeHeaderValue(headers.get(key));
  }

  const match = Object.entries(headers || {}).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase());
  return normalizeHeaderValue(match?.[1]);
}

export function auditSecurityHeaders(headers, expectedHeaders = getSecurityHeaders()) {
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

export function hasSecurityHeaderFailures(results) {
  return results.some((result) => result.status !== "pass");
}

export function formatSecurityHeaderAudit(results) {
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
