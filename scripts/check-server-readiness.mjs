#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  TRUSTED_KEY_REGISTRY_PATH,
  loadTrustedAuthorizedFeedKeyRegistry,
  validateTrustedAuthorizedFeedKeyRegistry,
} from "./check-authorized-feed-keys.mjs";
import { truthy, validateDeploymentProfile } from "./check-deployment-profile.mjs";
import { listServerRouteTemplates } from "./materialize-server-routes.mjs";

export const REQUIRED_SERVER_ROUTE_TEMPLATES = [
  "api/institution/audit-ledger/route.ts",
  "api/institution/login/route.ts",
  "api/institution/logout/route.ts",
  "api/institution/session/route.ts",
];

export function validateServerRuntimeReadiness({
  root = process.cwd(),
  templateRoot = path.join(root, "server-route-templates", "app"),
  env = process.env,
} = {}) {
  const errors = [];
  const deployment = validateDeploymentProfile(env, root);

  if (!truthy(env.JIUM_SERVER_ROUTES)) {
    errors.push("JIUM_SERVER_ROUTES=true is required for server runtime readiness");
  }
  if (truthy(env.GITHUB_PAGES)) {
    errors.push("GITHUB_PAGES=true cannot be used for server runtime readiness");
  }
  deployment.errors.forEach((error) => errors.push(`deployment profile: ${error}`));

  let keyCount = 0;
  try {
    const registry = loadTrustedAuthorizedFeedKeyRegistry(path.resolve(root, TRUSTED_KEY_REGISTRY_PATH));
    const keyErrors = validateTrustedAuthorizedFeedKeyRegistry(registry);
    keyErrors.forEach((error) => errors.push(`trusted key registry: ${error}`));
    keyCount = Array.isArray(registry.keys) ? registry.keys.length : 0;
    if (keyCount < 1) {
      errors.push(
        `trusted key registry: at least one ${AUTHORIZED_FEED_SIGNATURE_ALGORITHM} institution public key is required`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`trusted key registry: could not load ${TRUSTED_KEY_REGISTRY_PATH}: ${message}`);
  }

  const templateFiles = listServerRouteTemplates(templateRoot).map((template) => template.relativePath).sort();
  for (const required of REQUIRED_SERVER_ROUTE_TEMPLATES) {
    if (!templateFiles.includes(required)) {
      errors.push(`server route template missing: ${required}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    profile: deployment.profile,
    keyCount,
    templateFiles,
  };
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const result = validateServerRuntimeReadiness();
  if (!result.valid) {
    console.error("Server runtime readiness check failed:");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(
    `Server runtime readiness passed: ${result.keyCount} trusted key(s), ${result.templateFiles.length} route template(s)`,
  );
}
