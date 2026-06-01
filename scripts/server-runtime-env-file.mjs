import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "./init-server-runtime-env.mjs";

export const SERVER_RUNTIME_ENV_FILE_KEYS = [
  "NODE_ENV",
  "GITHUB_PAGES",
  "JIUM_SERVER_ROUTES",
  "INSTITUTION_SESSION_SECRET",
  "INSTITUTION_SESSION_KEY_ID",
  "INSTITUTION_SESSION_SECRET_VALID_FROM",
  "INSTITUTION_SESSION_SECRET_VALID_UNTIL",
  "NEXT_PUBLIC_INSTITUTION_SESSION_SECRET",
  "INSTITUTION_ALLOWED_ORIGINS",
  "INSTITUTION_SECURE_COOKIES",
  "INSTITUTION_AUDIT_LEDGER_DIR",
  "INSTITUTION_AUDIT_LEDGER_FILE",
  "INSTITUTION_ACCOUNT_REGISTRY_DIR",
  "JIUM_PUBLIC_APP_URL",
  "JIUM_PRIVACY_NOTICE_URL",
  "JIUM_SUPPORT_CONTACT_ROUTE",
  "JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT",
  "JIUM_OPERATIONAL_APPROVAL_RECORDS",
  "JIUM_GO_LIVE_APPROVAL",
  "JIUM_LEGAL_REVIEW_APPROVAL",
  "JIUM_RELEASE_EVIDENCE_REVIEW",
  "JIUM_DATA_RETENTION_POLICY_ACK",
  "JIUM_INCIDENT_RESPONSE_OWNER",
];

function present(value) {
  return Boolean(String(value || "").trim());
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function parseServerRuntimeEnvFile(content) {
  const parsed = {};
  for (const rawLine of String(content || "").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (SERVER_RUNTIME_ENV_FILE_KEYS.includes(key)) {
      parsed[key] = value;
    }
  }
  return parsed;
}

export function loadServerRuntimeEnvFile({
  root = process.cwd(),
  env = process.env,
  envPath = DEFAULT_SERVER_RUNTIME_ENV_PATH,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedEnvPath = path.resolve(resolvedRoot, envPath);
  const fileEnv = isPathInside(resolvedRoot, resolvedEnvPath) && existsSync(resolvedEnvPath)
    ? parseServerRuntimeEnvFile(readFileSync(resolvedEnvPath, "utf8"))
    : {};
  const merged = { ...env };

  for (const key of SERVER_RUNTIME_ENV_FILE_KEYS) {
    if (!present(merged[key]) && present(fileEnv[key])) {
      merged[key] = fileEnv[key];
    }
  }

  return merged;
}
