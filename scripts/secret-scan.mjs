#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_EXCLUDED_DIRS = new Set([".git", ".next", "node_modules", "out", "dist", "coverage", "playwright-report", "test-results"]);
const DEFAULT_EXCLUDED_FILES = new Set(["package-lock.json", "tsconfig.tsbuildinfo"]);

function secretPatterns() {
  const githubShort = ["gh", "[opsu]"].join("");
  const githubFineGrained = ["github", "_pat_"].join("");
  const openai = ["(?<![A-Za-z0-9])sk", "-(?:proj-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{20,})"].join("");
  const anthropic = ["(?<![A-Za-z0-9])sk", "-ant-[A-Za-z0-9_-]{20,}"].join("");
  const google = ["AI", "za[0-9A-Za-z_-]{20,}"].join("");
  return [
    { id: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
    { id: "github-token", pattern: new RegExp(`${githubShort}_[A-Za-z0-9_]{30,}`) },
    { id: "github-fine-grained-token", pattern: new RegExp(`${githubFineGrained}[A-Za-z0-9_]{35,}`) },
    { id: "openai-api-key", pattern: new RegExp(openai) },
    { id: "anthropic-api-key", pattern: new RegExp(anthropic) },
    { id: "google-api-key", pattern: new RegExp(google) },
    { id: "slack-token", pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/ },
    { id: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
  ];
}

function isLikelyBinary(buffer) {
  return buffer.includes(0);
}

function listTrackedFiles(root) {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listAllFiles(root, current = root, output = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (DEFAULT_EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      listAllFiles(root, absolute, output);
    } else if (entry.isFile()) {
      output.push(relative(root, absolute).replace(/\\/g, "/"));
    }
  }
  return output;
}

export function scanTextForSecrets(text, filePath = "input") {
  const findings = [];
  const lines = text.split(/\r?\n/);
  const patterns = secretPatterns();
  lines.forEach((line, index) => {
    for (const { id, pattern } of patterns) {
      if (pattern.test(line)) {
        findings.push({
          id,
          filePath,
          line: index + 1,
          preview: line.replace(/[A-Za-z0-9_/-]{12,}/g, "[REDACTED]").slice(0, 160),
        });
      }
    }
  });
  return findings;
}

export function scanFilesForSecrets(root, files) {
  const findings = [];
  for (const file of files) {
    if (DEFAULT_EXCLUDED_FILES.has(file) || file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg") || file.endsWith(".gif") || file.endsWith(".ico") || file.endsWith(".webp")) {
      continue;
    }
    const absolute = resolve(root, file);
    if (!absolute.startsWith(root) || !existsSync(absolute) || !statSync(absolute).isFile()) {
      continue;
    }
    const buffer = readFileSync(absolute);
    if (isLikelyBinary(buffer)) {
      continue;
    }
    findings.push(...scanTextForSecrets(buffer.toString("utf8"), file));
  }
  return findings;
}

export function runSecretScan({ root = process.cwd(), allFiles = false } = {}) {
  const resolvedRoot = resolve(root);
  const files = allFiles ? listAllFiles(resolvedRoot) : listTrackedFiles(resolvedRoot);
  return scanFilesForSecrets(resolvedRoot, files);
}

function parseArgs(argv) {
  const args = { root: process.cwd(), allFiles: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all-files") {
      args.allFiles = true;
    } else if (arg === "--root") {
      args.root = argv[index + 1] || args.root;
      index += 1;
    }
  }
  return args;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
  const findings = runSecretScan(parseArgs(process.argv.slice(2)));
  if (findings.length) {
    console.error("Secret scan failed. Remove real credentials from tracked files.");
    findings.forEach((finding) => {
      console.error(`- ${finding.filePath}:${finding.line} [${finding.id}] ${finding.preview}`);
    });
    process.exit(1);
  }
  console.log("Secret scan passed. No high-confidence credentials found in scanned files.");
}
