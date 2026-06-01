#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const DEFAULT_SERVER_RUNTIME_ENV_PATH = ".env.server.local";

function generatedSecret() {
  return randomBytes(48).toString("base64url");
}

function todayKeyId(date = new Date()) {
  return `server-session-${date.toISOString().slice(0, 10).replace(/-/g, "")}`;
}

export function buildServerRuntimeEnvTemplate({
  generatedAt = new Date().toISOString(),
  secret = generatedSecret(),
} = {}) {
  return [
    "# JiumAI private server runtime env",
    "# Keep this file out of git. Replace the origin and storage placeholders before go-live.",
    `# Generated at: ${generatedAt}`,
    "JIUM_SERVER_ROUTES=true",
    "NODE_ENV=production",
    `INSTITUTION_SESSION_SECRET=${secret}`,
    `INSTITUTION_SESSION_KEY_ID=${todayKeyId(new Date(generatedAt))}`,
    `INSTITUTION_SESSION_SECRET_VALID_FROM=${generatedAt}`,
    "INSTITUTION_SESSION_SECRET_VALID_UNTIL=",
    "INSTITUTION_ALLOWED_ORIGINS=REPLACE-ME-https-origin",
    "INSTITUTION_SECURE_COOKIES=true",
    "INSTITUTION_AUDIT_LEDGER_DIR=REPLACE-ME-ABSOLUTE-SECURE-AUDIT-LEDGER-DIR",
    "INSTITUTION_AUDIT_LEDGER_FILE=institution-auth-audit-ledger.jsonl",
    "INSTITUTION_ACCOUNT_REGISTRY_DIR=REPLACE-ME-ABSOLUTE-SECURE-ACCOUNT-REGISTRY-DIR",
    "",
  ].join("\n");
}

export function writeServerRuntimeEnvTemplate({
  root = repoRoot,
  outputPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
  force = false,
  generatedAt = new Date().toISOString(),
  secret,
} = {}) {
  const resolvedOutputPath = path.resolve(root, outputPath);
  if (existsSync(resolvedOutputPath) && !force) {
    throw new Error("server runtime env file already exists; pass --force to overwrite");
  }
  mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  const content = buildServerRuntimeEnvTemplate({ generatedAt, secret });
  writeFileSync(resolvedOutputPath, content, "utf8");
  return {
    outputPath: resolvedOutputPath,
    outputPathRelative: path.relative(root, resolvedOutputPath).replace(/\\/g, "/"),
    secretStatus: "GENERATED",
    originStatus: "PLACEHOLDER_BLOCKED",
  };
}

function parseCliArgs(argv) {
  const args = { outputPath: DEFAULT_SERVER_RUNTIME_ENV_PATH, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") {
      args.force = true;
    } else if (arg === "--output") {
      args.outputPath = argv[index + 1] || args.outputPath;
      index += 1;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    }
  }
  return args;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const args = parseCliArgs(process.argv.slice(2));
  try {
    const result = writeServerRuntimeEnvTemplate(args);
    console.log(`Server runtime env template written: ${result.outputPathRelative}`);
    console.log("Secret status: GENERATED");
    console.log("Origin status: PLACEHOLDER_BLOCKED");
    console.log(
      "Replace INSTITUTION_ALLOWED_ORIGINS and the server storage directories with approved deployment values, then run npm run security:server-readiness.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
