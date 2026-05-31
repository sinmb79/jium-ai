#!/usr/bin/env node
import { auditSecurityHeaders, formatSecurityHeaderAudit, hasSecurityHeaderFailures } from "./security-headers-runtime.mjs";

const targetUrl = process.argv[2] || process.env.SECURITY_HEADER_URL;

if (!targetUrl) {
  console.error("Usage: npm run security:headers:check -- <url>");
  console.error("Example: npm run security:headers:check -- https://example.com");
  process.exitCode = 2;
} else {
  const response = await fetch(targetUrl, { redirect: "follow" });
  const results = auditSecurityHeaders(response.headers);

  console.log(`Checked ${targetUrl}`);
  console.log(`HTTP ${response.status}`);
  console.log(formatSecurityHeaderAudit(results));

  if (hasSecurityHeaderFailures(results)) {
    process.exitCode = 1;
  }
}
