#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TRUSTED_KEY_REGISTRY_PATH = "data/trusted-authorized-feed-keys.json";
export const TRUSTED_KEY_REGISTRY_VERSION = "jium-authorized-feed-trusted-keys-v1";
export const AUTHORIZED_FEED_SIGNATURE_ALGORITHM = "RSASSA-PKCS1-v1_5";

const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);
const PRIVATE_KEY_USAGES = new Set(["sign", "decrypt", "deriveBits", "deriveKey", "unwrapKey"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasPrivateKeyBanner(value) {
  return JSON.stringify(value).includes("PRIVATE KEY");
}

function parseIsoDate(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function loadTrustedAuthorizedFeedKeyRegistry(filePath = resolve(process.cwd(), TRUSTED_KEY_REGISTRY_PATH)) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateTrustedAuthorizedFeedKeyRegistry(registry) {
  const errors = [];
  const seenKeyIds = new Set();

  if (!isPlainObject(registry)) {
    return ["trusted key registry must be a JSON object"];
  }
  if (registry.version !== TRUSTED_KEY_REGISTRY_VERSION) {
    errors.push(`registry version must be ${TRUSTED_KEY_REGISTRY_VERSION}`);
  }
  if (!Array.isArray(registry.keys)) {
    errors.push("registry keys must be an array");
    return errors;
  }

  registry.keys.forEach((key, index) => {
    const prefix = `keys[${index}]`;
    if (!isPlainObject(key)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    if (!key.keyId || typeof key.keyId !== "string") {
      errors.push(`${prefix}.keyId is required`);
    } else if (seenKeyIds.has(key.keyId)) {
      errors.push(`${prefix}.keyId duplicates ${key.keyId}`);
    } else {
      seenKeyIds.add(key.keyId);
    }
    if (!key.issuerName || typeof key.issuerName !== "string") {
      errors.push(`${prefix}.issuerName is required`);
    }
    if (key.algorithm !== AUTHORIZED_FEED_SIGNATURE_ALGORITHM) {
      errors.push(`${prefix}.algorithm must be ${AUTHORIZED_FEED_SIGNATURE_ALGORITHM}`);
    }
    if (!isPlainObject(key.publicKeyJwk)) {
      errors.push(`${prefix}.publicKeyJwk is required`);
    } else {
      if (key.publicKeyJwk.kty !== "RSA") {
        errors.push(`${prefix}.publicKeyJwk.kty must be RSA`);
      }
      for (const privateField of PRIVATE_JWK_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(key.publicKeyJwk, privateField)) {
          errors.push(`${prefix}.publicKeyJwk must not include private JWK field: ${privateField}`);
        }
      }
      if (Array.isArray(key.publicKeyJwk.key_ops)) {
        key.publicKeyJwk.key_ops.forEach((usage) => {
          if (PRIVATE_KEY_USAGES.has(usage)) {
            errors.push(`${prefix}.publicKeyJwk.key_ops must not include private usage: ${usage}`);
          }
        });
      }
      if (key.publicKeyJwk.use && key.publicKeyJwk.use !== "sig") {
        errors.push(`${prefix}.publicKeyJwk.use must be sig when present`);
      }
    }
    if (hasPrivateKeyBanner(key)) {
      errors.push(`${prefix} must not contain PEM private key material`);
    }
    if (key.validFrom && !Number.isFinite(parseIsoDate(key.validFrom))) {
      errors.push(`${prefix}.validFrom must be an ISO date when present`);
    }
    if (key.validUntil && !Number.isFinite(parseIsoDate(key.validUntil))) {
      errors.push(`${prefix}.validUntil must be an ISO date when present`);
    }
    if (key.validFrom && key.validUntil && parseIsoDate(key.validUntil) <= parseIsoDate(key.validFrom)) {
      errors.push(`${prefix}.validUntil must be later than validFrom`);
    }
  });

  return errors;
}

export function runTrustedAuthorizedFeedKeyCheck({ root = process.cwd() } = {}) {
  const registry = loadTrustedAuthorizedFeedKeyRegistry(resolve(root, TRUSTED_KEY_REGISTRY_PATH));
  return validateTrustedAuthorizedFeedKeyRegistry(registry);
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || "")) {
  const errors = runTrustedAuthorizedFeedKeyCheck();
  if (errors.length) {
    console.error("Authorized feed trusted key registry check failed.");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log("Authorized feed trusted key registry passed.");
}
