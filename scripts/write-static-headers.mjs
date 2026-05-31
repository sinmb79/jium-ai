#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildStaticHeadersFile } from "./security-headers-runtime.mjs";

const output = resolve(process.cwd(), process.argv[2] || "public/_headers");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, buildStaticHeadersFile(), "utf8");
console.log(`Wrote static hosting security headers to ${output}`);
