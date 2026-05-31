import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";
import { auditSecurityHeaders, formatSecurityHeaderAudit, hasSecurityHeaderFailures } from "@/lib/securityHeaderAudit";

describe("security header audit", () => {
  it("passes when hosted response headers match the enforced policy", () => {
    const headers = Object.fromEntries(SECURITY_HEADERS.map((header) => [header.key.toLowerCase(), header.value]));
    const results = auditSecurityHeaders(headers);

    expect(results.every((result) => result.status === "pass")).toBe(true);
    expect(hasSecurityHeaderFailures(results)).toBe(false);
    expect(formatSecurityHeaderAudit(results)).toContain("PASS Content-Security-Policy");
  });

  it("reports missing and mismatched hosted response headers", () => {
    const results = auditSecurityHeaders({
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
    });

    expect(results.find((result) => result.key === "X-Frame-Options")?.status).toBe("mismatch");
    expect(results.find((result) => result.key === "Content-Security-Policy")?.status).toBe("missing");
    expect(hasSecurityHeaderFailures(results)).toBe(true);
    expect(formatSecurityHeaderAudit(results)).toContain("FAIL X-Frame-Options");
  });
});
