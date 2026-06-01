#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
export const DESKTOP_APP_DIR = "dist/electron-app";

export function resolveNpmCommand(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function resolveNpmInstallInvocation({ env = process.env, platform = process.platform } = {}) {
  if (env.npm_execpath && existsSync(env.npm_execpath)) {
    return { command: process.execPath, args: [env.npm_execpath] };
  }
  if (platform === "win32") {
    return { command: "cmd", args: ["/d", "/s", "/c", "npm"] };
  }
  return { command: "npm", args: [] };
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeRemoveDir(root, target) {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved) || path.relative(root, resolved).replace(/\\/g, "/") !== DESKTOP_APP_DIR) {
    throw new Error(`Refusing to remove unsafe desktop app staging directory: ${resolved}`);
  }
  rmSync(resolved, { recursive: true, force: true });
  return resolved;
}

function copyRequiredPath(root, appDir, relativePath) {
  const source = path.join(root, relativePath);
  const target = path.join(appDir, relativePath);
  if (!existsSync(source)) {
    throw new Error(`Desktop staging source missing: ${relativePath}`);
  }
  copyRecursive(source, target);
}

function copyRecursive(source, target) {
  const sourceStat = statSync(source);
  if (sourceStat.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true })) {
      copyRecursive(path.join(source, entry.name), path.join(target, entry.name));
    }
    return;
  }
  if (sourceStat.isFile()) {
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    return;
  }
  throw new Error(`Desktop staging source must be a file or directory: ${source}`);
}

export function buildDesktopAppPackageJson(root = repoRoot) {
  const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const electronUpdaterVersion = rootPackage.dependencies?.["electron-updater"];
  if (!electronUpdaterVersion) {
    throw new Error("Root package.json must declare electron-updater as a runtime dependency.");
  }
  return {
    name: "jium-ai-desktop",
    version: rootPackage.version || "0.1.0",
    private: true,
    description: rootPackage.description || "JiumAI desktop app",
    author: rootPackage.author || "22B Labs",
    main: "desktop/electron-main.cjs",
    dependencies: {
      "electron-updater": electronUpdaterVersion,
    },
  };
}

export function verifyDesktopAppDir({ root = repoRoot, appDir = path.join(root, DESKTOP_APP_DIR) } = {}) {
  const errors = [];
  const packagePath = path.join(appDir, "package.json");
  if (!existsSync(packagePath)) {
    errors.push("desktop app staging package.json missing");
  } else {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    const dependencies = Object.keys(packageJson.dependencies || {});
    for (const forbidden of ["next", "react", "react-dom", "@prisma/client"]) {
      if (dependencies.includes(forbidden)) {
        errors.push(`desktop app staging must not include root web dependency: ${forbidden}`);
      }
    }
    if (!dependencies.includes("electron-updater")) {
      errors.push("desktop app staging missing electron-updater dependency");
    }
  }

  for (const relativePath of [
    "desktop/electron-main.cjs",
    "desktop/electron-preload.cjs",
    "scripts/native-secure-vault-bridge.mjs",
    "out/index.html",
    "out/dashboard/index.html",
  ]) {
    if (!existsSync(path.join(appDir, relativePath))) {
      errors.push(`desktop app staging file missing: ${relativePath}`);
    }
  }

  if (!existsSync(path.join(appDir, "node_modules", "electron-updater", "package.json"))) {
    errors.push("desktop app staging node_modules missing electron-updater");
  }

  return {
    valid: errors.length === 0,
    errors,
    appDir,
  };
}

export function prepareDesktopAppDir({ root = repoRoot, runner = spawnSync, install = true } = {}) {
  const appDir = safeRemoveDir(root, DESKTOP_APP_DIR);
  mkdirSync(appDir, { recursive: true });

  for (const relativePath of ["desktop/electron-main.cjs", "desktop/electron-preload.cjs", "scripts/native-secure-vault-bridge.mjs", "out"]) {
    copyRequiredPath(root, appDir, relativePath);
  }

  writeFileSync(path.join(appDir, "package.json"), `${JSON.stringify(buildDesktopAppPackageJson(root), null, 2)}\n`, "utf8");

  if (install) {
    const npmInvocation = resolveNpmInstallInvocation();
    const result = runner(npmInvocation.command, [...npmInvocation.args, "install", "--omit=dev", "--ignore-scripts", "--package-lock=false", "--no-audit", "--no-fund"], {
      cwd: appDir,
      env: process.env,
      stdio: "inherit",
    });
    if (typeof result?.status === "number" && result.status !== 0) {
      throw new Error(`Desktop app staging dependency install failed with exit code ${result.status}`);
    }
    if (result?.error) {
      throw result.error;
    }
  } else {
    mkdirSync(path.join(appDir, "node_modules", "electron-updater"), { recursive: true });
    writeFileSync(path.join(appDir, "node_modules", "electron-updater", "package.json"), "{\"name\":\"electron-updater\"}\n", "utf8");
  }

  const verification = verifyDesktopAppDir({ root, appDir });
  if (!verification.valid) {
    throw new Error(`Desktop app staging verification failed:\n- ${verification.errors.join("\n- ")}`);
  }
  return verification;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  try {
    const result = prepareDesktopAppDir();
    console.log(`Desktop app staging prepared: ${result.appDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
