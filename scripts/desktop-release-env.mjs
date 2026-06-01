import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_DESKTOP_RELEASE_ENV_PATH = ".env.desktop.local";

export const DESKTOP_RELEASE_ENV_KEYS = [
  "JIUM_DESKTOP_RELEASE_CHANNEL",
  "JIUM_DESKTOP_UPDATE_URL",
  "JIUM_DESKTOP_RELEASE_TAG",
  "JIUM_DESKTOP_PUBLISH_APPROVAL",
];

const PLACEHOLDER_PATTERN = /\b(?:REPLACE[-_ ]?ME|TODO|TBD|PLACEHOLDER|PENDING[-_ ]?APPROVAL|CHANGE[-_ ]?ME)\b/i;
const URL_OR_CONTACT_PATTERN =
  /\b(?:https?:\/\/|www\.|[a-z0-9.-]+\.onion\b|t\.me\/|telegram\.me\/|discord\.gg\/|discord\.com\/invite\/)|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?[\s.-])\d{3,4}[\s.-]\d{4}\b|\b\d{3}[\s.-]\d{3,4}[\s.-]\d{4}\b/i;
const SECRET_PATTERN =
  /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,})/i;
const RELEASE_CHANNEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,48}$/;
const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,96}$/;
const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function cleanDesktopEnvValue(value) {
  return String(value || "").trim();
}

export function presentDesktopEnvValue(value) {
  return Boolean(cleanDesktopEnvValue(value));
}

export function sha256DesktopReleaseText(value) {
  return `sha256-${createHash("sha256").update(cleanDesktopEnvValue(value)).digest("hex")}`;
}

export function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function relativePath(root, target) {
  return path.relative(root, target).replace(/\\/g, "/");
}

export function parseDesktopReleaseEnvFile(content) {
  const parsed = {};
  for (const rawLine of String(content || "").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (DESKTOP_RELEASE_ENV_KEYS.includes(key)) {
      parsed[key] = value;
    }
  }
  return parsed;
}

export function loadDesktopReleaseEnv({
  root = process.cwd(),
  env = process.env,
  envPath = DEFAULT_DESKTOP_RELEASE_ENV_PATH,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedEnvPath = path.resolve(resolvedRoot, envPath);
  const fileEnv = isPathInside(resolvedRoot, resolvedEnvPath) && existsSync(resolvedEnvPath)
    ? parseDesktopReleaseEnvFile(readFileSync(resolvedEnvPath, "utf8"))
    : {};
  const merged = { ...env };

  for (const key of DESKTOP_RELEASE_ENV_KEYS) {
    if (!presentDesktopEnvValue(merged[key]) && presentDesktopEnvValue(fileEnv[key])) {
      merged[key] = fileEnv[key];
    }
  }

  return merged;
}

export function validateDesktopReleaseChannel(channel) {
  const value = cleanDesktopEnvValue(channel);
  const errors = [];
  if (!value) {
    errors.push("channel is required");
    return errors;
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    errors.push("channel contains placeholder");
  }
  if (!RELEASE_CHANNEL_PATTERN.test(value)) {
    errors.push("channel must be a short release lane");
  }
  if (URL_OR_CONTACT_PATTERN.test(value)) {
    errors.push("channel contains raw URL or contact value");
  }
  if (SECRET_PATTERN.test(value)) {
    errors.push("channel contains secret-like value");
  }
  return errors;
}

export function validateDesktopUpdateUrl(updateUrl) {
  const value = cleanDesktopEnvValue(updateUrl);
  const errors = [];
  if (!value) {
    errors.push("updateUrl is required");
    return errors;
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    errors.push("updateUrl contains placeholder");
  }
  if (SECRET_PATTERN.test(value)) {
    errors.push("updateUrl contains secret-like value");
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      errors.push("updateUrl must use HTTPS");
    }
    if (parsed.username || parsed.password) {
      errors.push("updateUrl must not include credentials");
    }
    if (parsed.hash) {
      errors.push("updateUrl must not include a fragment");
    }
  } catch {
    errors.push("updateUrl must be a valid URL");
  }
  return errors;
}

export function validateDesktopReleaseTag(releaseTag) {
  const value = cleanDesktopEnvValue(releaseTag);
  const errors = [];
  if (!value) {
    errors.push("releaseTag is required");
    return errors;
  }
  if (!RELEASE_TAG_PATTERN.test(value)) {
    errors.push("releaseTag must use vMAJOR.MINOR.PATCH");
  }
  return errors;
}

export function validateDesktopPublishApprovalRef(publishApprovalRef) {
  const value = cleanDesktopEnvValue(publishApprovalRef);
  const errors = [];
  if (!value) {
    return errors;
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    errors.push("publishApprovalRef contains placeholder");
  }
  if (!SAFE_REF_PATTERN.test(value)) {
    errors.push("publishApprovalRef must be a short pseudonymous reference");
  }
  if (URL_OR_CONTACT_PATTERN.test(value)) {
    errors.push("publishApprovalRef contains raw URL or contact value");
  }
  if (SECRET_PATTERN.test(value)) {
    errors.push("publishApprovalRef contains secret-like value");
  }
  return errors;
}
