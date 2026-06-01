#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertSafeOutDir(root, outDir) {
  const resolvedRoot = path.resolve(root);
  const resolvedOut = path.resolve(outDir);
  if (!isPathInside(resolvedRoot, resolvedOut) || path.basename(resolvedOut) !== "out") {
    throw new Error(`Refusing to clean unsafe desktop export directory: ${resolvedOut}`);
  }
  return resolvedOut;
}

export function desktopExportEnv(env = process.env) {
  return {
    ...env,
    GITHUB_PAGES: "false",
    JIUM_DESKTOP_EXPORT: "true",
    NEXT_TELEMETRY_DISABLED: env.NEXT_TELEMETRY_DISABLED || "1",
  };
}

export function resolveNextBuildInvocation(root = repoRoot, platform = process.platform) {
  const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
  if (existsSync(nextCli)) {
    return { command: process.execPath, args: [nextCli, "build"] };
  }
  if (platform === "win32") {
    return { command: "cmd", args: ["/d", "/s", "/c", "npx next build"] };
  }
  return { command: "npx", args: ["next", "build"] };
}

export function verifyDesktopExport({ root = repoRoot, outDir = path.join(root, "out") } = {}) {
  const resolvedOut = path.resolve(outDir);
  const errors = [];
  const requiredRoutes = [
    { id: "index", candidates: ["index.html"] },
    { id: "dashboard", candidates: [path.join("dashboard", "index.html"), "dashboard.html"] },
  ];
  const routeFiles = [];

  if (!existsSync(resolvedOut)) {
    errors.push("desktop static export directory missing: out");
  } else {
    for (const route of requiredRoutes) {
      const relativePath = route.candidates.find((candidate) => existsSync(path.join(resolvedOut, candidate)));
      if (!relativePath) {
        errors.push(`desktop static export file missing: ${route.candidates.map((entry) => entry.replace(/\\/g, "/")).join(" or ")}`);
        continue;
      }
      const target = path.join(resolvedOut, relativePath);
      if (!existsSync(target)) {
        errors.push(`desktop static export file missing: ${relativePath.replace(/\\/g, "/")}`);
      } else {
        routeFiles.push(relativePath.replace(/\\/g, "/"));
        const html = readFileSync(target, "utf8");
        if (html.includes("/jium-ai/")) {
          errors.push(`desktop static export contains GitHub Pages basePath: ${relativePath.replace(/\\/g, "/")}`);
        }
      }
    }

    const nextAssets = path.join(resolvedOut, "_next");
    if (!existsSync(nextAssets) || !statSync(nextAssets).isDirectory()) {
      errors.push("desktop static export asset directory missing: _next");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    outDir: resolvedOut,
    routeFiles,
    requiredFiles: requiredRoutes.map((route) => route.candidates.map((entry) => entry.replace(/\\/g, "/")).join(" or ")),
  };
}

export function writeDesktopManifest({ root = repoRoot, outDir = path.join(root, "out"), routes = [] } = {}) {
  const manifestPath = path.join(outDir, "jium-desktop-manifest.json");
  const manifest = {
    profile: "desktop-static-export",
    generatedAt: new Date().toISOString(),
    staticRoot: "out",
    routes,
    safetyNotes: [
      "Desktop export intentionally omits the GitHub Pages /jium-ai basePath.",
      "The Electron shell must load this export through the jium://app protocol.",
    ],
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifestPath, manifest };
}

export function buildDesktopExport({ root = repoRoot, runner = spawnSync, clean = true } = {}) {
  const outDir = path.join(root, "out");
  if (clean) {
    rmSync(assertSafeOutDir(root, outDir), { recursive: true, force: true });
  }

  const invocation = resolveNextBuildInvocation(root);
  const result = runner(invocation.command, invocation.args, {
    cwd: root,
    env: desktopExportEnv(process.env),
    stdio: "inherit",
  });

  if (typeof result?.status === "number" && result.status !== 0) {
    throw new Error(`Desktop static export build failed with exit code ${result.status}`);
  }
  if (result?.error) {
    throw result.error;
  }

  const verification = verifyDesktopExport({ root, outDir });
  if (!verification.valid) {
    throw new Error(`Desktop static export verification failed:\n- ${verification.errors.join("\n- ")}`);
  }

  mkdirSync(outDir, { recursive: true });
  const manifest = writeDesktopManifest({ root, outDir, routes: verification.routeFiles });
  return {
    ...verification,
    manifestPath: manifest.manifestPath,
  };
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  try {
    const result = buildDesktopExport();
    console.log(`Desktop static export passed: ${result.routeFiles.length} route(s), manifest ${result.manifestPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
