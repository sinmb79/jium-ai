import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildStaticHeadersFile, SECURITY_HEADERS } from "@/lib/securityHeaders";

describe("security headers", () => {
  it("enforces CSP and emits static hosting headers", () => {
    const headers = new Map(SECURITY_HEADERS.map((header) => [header.key, header.value]));
    const staticHeaders = buildStaticHeadersFile();

    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy-Report-Only")).toBe(headers.get("Content-Security-Policy"));
    expect(staticHeaders).toContain("/*");
    expect(staticHeaders).toContain("  Content-Security-Policy: default-src 'self'");
    expect(staticHeaders).toContain("  X-Frame-Options: DENY");
  });

  it("keeps the committed _headers file in sync for static hosts", () => {
    const committed = readFileSync("public/_headers", "utf8").replace(/\r\n/g, "\n");

    expect(committed).toBe(buildStaticHeadersFile());
  });
});
