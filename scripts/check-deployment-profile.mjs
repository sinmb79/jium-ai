import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export function truthy(value) {
  return String(value || "").toLowerCase() === "true";
}

export function findAppRouteFiles(root = repoRoot) {
  const appDir = path.join(root, "app");
  const results = [];
  if (!existsSync(appDir)) {
    return results;
  }

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/^route\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        results.push(path.relative(root, fullPath).replace(/\\/g, "/"));
      }
    }
  }

  walk(appDir);
  return results.sort();
}

export function validateDeploymentProfile(env = process.env, root = repoRoot) {
  const errors = [];
  const isGithubPages = truthy(env.GITHUB_PAGES);
  const serverRoutes = truthy(env.JIUM_SERVER_ROUTES);
  const routeFiles = findAppRouteFiles(root);

  if (isGithubPages && serverRoutes) {
    errors.push("GITHUB_PAGES=true cannot be combined with JIUM_SERVER_ROUTES=true");
  }
  if (isGithubPages && routeFiles.length) {
    errors.push(`GitHub Pages static export cannot include app route handlers: ${routeFiles.join(", ")}`);
  }
  if (serverRoutes) {
    if (!env.INSTITUTION_SESSION_SECRET?.trim()) {
      errors.push("JIUM_SERVER_ROUTES=true requires INSTITUTION_SESSION_SECRET");
    }
    if (env.NEXT_PUBLIC_INSTITUTION_SESSION_SECRET?.trim()) {
      errors.push("NEXT_PUBLIC_INSTITUTION_SESSION_SECRET must never be set");
    }
    if (!env.INSTITUTION_ALLOWED_ORIGINS?.trim()) {
      errors.push("JIUM_SERVER_ROUTES=true requires INSTITUTION_ALLOWED_ORIGINS");
    }
    if (!env.INSTITUTION_AUDIT_LEDGER_DIR?.trim()) {
      errors.push("JIUM_SERVER_ROUTES=true requires INSTITUTION_AUDIT_LEDGER_DIR");
    }
    if (env.NODE_ENV === "production" && String(env.INSTITUTION_SECURE_COOKIES || "").toLowerCase() === "false") {
      errors.push("INSTITUTION_SECURE_COOKIES=false is not allowed in production server routes");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    profile: isGithubPages ? "github-pages-static" : serverRoutes ? "server-routes" : "local-build",
    routeFiles,
  };
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const result = validateDeploymentProfile();
  if (!result.valid) {
    console.error("Deployment profile check failed:");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(`Deployment profile check passed: ${result.profile}`);
}
