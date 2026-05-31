#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { truthy, validateDeploymentProfile } from "./check-deployment-profile.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const SERVER_ROUTE_TEMPLATE_ROOT = path.join(repoRoot, "server-route-templates", "app");
export const GENERATED_SERVER_ROUTE_MARKER =
  "// Generated from server-route-templates by scripts/materialize-server-routes.mjs.";

function posix(value) {
  return value.replace(/\\/g, "/");
}

function assertInsideRoot(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside repository root: ${resolvedTarget}`);
  }
}

function walkFiles(root) {
  if (!existsSync(root)) {
    return [];
  }
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  walk(root);
  return files.sort((a, b) => posix(a).localeCompare(posix(b)));
}

export function listServerRouteTemplates(templateRoot = SERVER_ROUTE_TEMPLATE_ROOT) {
  return walkFiles(templateRoot).map((sourcePath) => ({
    sourcePath,
    relativePath: posix(path.relative(templateRoot, sourcePath)),
  }));
}

function materializedTarget(root, template) {
  const targetPath = path.join(root, "app", template.relativePath);
  assertInsideRoot(root, targetPath);
  return targetPath;
}

function generatedContent(sourceText) {
  return sourceText.startsWith(GENERATED_SERVER_ROUTE_MARKER)
    ? sourceText
    : `${GENERATED_SERVER_ROUTE_MARKER}\n${sourceText}`;
}

export function materializeServerRoutes({
  root = repoRoot,
  templateRoot = SERVER_ROUTE_TEMPLATE_ROOT,
  env = process.env,
  dryRun = false,
} = {}) {
  if (!truthy(env.JIUM_SERVER_ROUTES)) {
    throw new Error("Server route materialization requires JIUM_SERVER_ROUTES=true");
  }
  if (truthy(env.GITHUB_PAGES)) {
    throw new Error("Cannot materialize server routes while GITHUB_PAGES=true");
  }

  const profile = validateDeploymentProfile(env, root);
  if (!profile.valid) {
    throw new Error(`Deployment profile is not ready for server routes:\n- ${profile.errors.join("\n- ")}`);
  }

  const templates = listServerRouteTemplates(templateRoot);
  if (!templates.length) {
    throw new Error(`No server route templates found under ${templateRoot}`);
  }

  const routeFiles = [];
  for (const template of templates) {
    const sourceText = readFileSync(template.sourcePath, "utf8");
    const targetPath = materializedTarget(root, template);
    const content = generatedContent(sourceText);

    if (existsSync(targetPath)) {
      const currentText = readFileSync(targetPath, "utf8");
      if (currentText !== content && !currentText.startsWith(GENERATED_SERVER_ROUTE_MARKER)) {
        throw new Error(`Refusing to overwrite non-generated server route: ${posix(path.relative(root, targetPath))}`);
      }
    }

    if (!dryRun) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, content, "utf8");
    }
    routeFiles.push(posix(path.relative(root, targetPath)));
  }

  return {
    dryRun,
    profile: profile.profile,
    routeFiles: routeFiles.sort(),
    templateFiles: templates.map((template) => template.relativePath).sort(),
  };
}

function removeEmptyDirsUpTo(root, startDir) {
  const stopDir = path.resolve(root, "app");
  let current = path.resolve(startDir);
  while (current.startsWith(stopDir) && current !== stopDir) {
    try {
      if (readdirSync(current).length > 0) {
        return;
      }
      rmdirSync(current);
      current = path.dirname(current);
    } catch {
      return;
    }
  }
}

export function cleanMaterializedServerRoutes({
  root = repoRoot,
  templateRoot = SERVER_ROUTE_TEMPLATE_ROOT,
  dryRun = false,
} = {}) {
  const templates = listServerRouteTemplates(templateRoot);
  const removed = [];
  const skipped = [];
  const removedCaches = [];

  for (const template of templates) {
    const targetPath = materializedTarget(root, template);
    if (!existsSync(targetPath)) {
      if (!dryRun) {
        removeEmptyDirsUpTo(root, path.dirname(targetPath));
      }
      continue;
    }
    const currentText = readFileSync(targetPath, "utf8");
    const relative = posix(path.relative(root, targetPath));
    if (!currentText.startsWith(GENERATED_SERVER_ROUTE_MARKER)) {
      skipped.push(relative);
      continue;
    }
    if (!dryRun) {
      rmSync(targetPath, { force: true });
      removeEmptyDirsUpTo(root, path.dirname(targetPath));
    }
    removed.push(relative);
  }

  for (const cacheDir of [path.join(root, ".next", "types"), path.join(root, ".next", "dev", "types")]) {
    if (!existsSync(cacheDir)) {
      continue;
    }
    if (!dryRun) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
    removedCaches.push(posix(path.relative(root, cacheDir)));
  }

  return { dryRun, removed: removed.sort(), skipped: skipped.sort(), removedCaches: removedCaches.sort() };
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  const isClean = process.argv.includes("--clean");
  try {
    if (isClean) {
      const result = cleanMaterializedServerRoutes();
      console.log(
        `Server route clean complete: ${result.removed.length} removed, ${result.skipped.length} skipped, ${result.removedCaches.length} cache dir(s) cleaned`,
      );
      result.removed.forEach((file) => console.log(`- removed ${file}`));
      result.skipped.forEach((file) => console.log(`- skipped non-generated ${file}`));
      result.removedCaches.forEach((file) => console.log(`- cleaned ${file}`));
    } else {
      const result = materializeServerRoutes();
      console.log(`Server route materialization complete: ${result.routeFiles.length} files`);
      result.routeFiles.forEach((file) => console.log(`- ${file}`));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
