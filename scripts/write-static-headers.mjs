#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const securityHeadersData = JSON.parse(readFileSync(new URL("../lib/securityHeadersData.json", import.meta.url), "utf8"));
const securityHeaders = [
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

function buildStaticHeadersFile(pathPattern = "/*") {
  return [`${pathPattern}`, ...securityHeaders.map((header) => `  ${header.key}: ${header.value}`), ""].join("\n");
}

const output = resolve(process.cwd(), process.argv[2] || "public/_headers");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, buildStaticHeadersFile(), "utf8");
console.log(`Wrote static hosting security headers to ${output}`);
