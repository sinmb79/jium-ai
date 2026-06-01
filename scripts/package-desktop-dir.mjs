#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
export const DEFAULT_MAX_DESKTOP_APP_ARCHIVE_BYTES = 80 * 1024 * 1024;

export function desktopPackageDirEnv(env = process.env) {
  return {
    ...env,
    JIUM_DESKTOP_PACKAGE_MODE: "dir",
    CSC_IDENTITY_AUTO_DISCOVERY: "false",
  };
}

export function resolveElectronBuilderCli(root = repoRoot) {
  const cliPath = path.join(root, "node_modules", "electron-builder", "out", "cli", "cli.js");
  if (!existsSync(cliPath)) {
    throw new Error("electron-builder CLI missing. Run npm install first.");
  }
  return cliPath;
}

export function expectedDesktopDirArtifact(root = repoRoot, platform = process.platform) {
  const outputRoot = path.join(root, "dist", "desktop");
  if (platform === "win32") {
    return {
      appDir: path.join(outputRoot, "win-unpacked"),
      executable: path.join(outputRoot, "win-unpacked", "JiumAI.exe"),
      appArchive: path.join(outputRoot, "win-unpacked", "resources", "app.asar"),
    };
  }
  if (platform === "darwin") {
    return {
      appDir: path.join(outputRoot, "mac", "JiumAI.app"),
      executable: path.join(outputRoot, "mac", "JiumAI.app", "Contents", "MacOS", "JiumAI"),
      appArchive: path.join(outputRoot, "mac", "JiumAI.app", "Contents", "Resources", "app.asar"),
    };
  }
  return {
    appDir: path.join(outputRoot, "linux-unpacked"),
    executable: path.join(outputRoot, "linux-unpacked", "jiumai"),
    appArchive: path.join(outputRoot, "linux-unpacked", "resources", "app.asar"),
  };
}

export function verifyDesktopDirPackage({ root = repoRoot, platform = process.platform, maxAppArchiveBytes = DEFAULT_MAX_DESKTOP_APP_ARCHIVE_BYTES } = {}) {
  const artifact = expectedDesktopDirArtifact(root, platform);
  const errors = [];
  let appArchiveBytes = 0;
  if (!existsSync(artifact.appDir)) {
    errors.push(`desktop package directory missing: ${path.relative(root, artifact.appDir).replace(/\\/g, "/")}`);
  }
  if (!existsSync(artifact.executable)) {
    errors.push(`desktop executable missing: ${path.relative(root, artifact.executable).replace(/\\/g, "/")}`);
  }
  if (!existsSync(artifact.appArchive)) {
    errors.push(`desktop app archive missing: ${path.relative(root, artifact.appArchive).replace(/\\/g, "/")}`);
  } else {
    appArchiveBytes = statSync(artifact.appArchive).size;
    if (appArchiveBytes > maxAppArchiveBytes) {
      errors.push(`desktop app archive too large: ${appArchiveBytes} bytes exceeds ${maxAppArchiveBytes} bytes`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    artifact,
    appArchiveBytes,
  };
}

export function packageDesktopDir({ root = repoRoot, runner = spawnSync } = {}) {
  const cliPath = resolveElectronBuilderCli(root);
  const result = runner(process.execPath, [cliPath, "--config", "electron-builder.config.cjs", "--dir", "--publish", "never"], {
    cwd: root,
    env: desktopPackageDirEnv(process.env),
    stdio: "inherit",
  });
  if (typeof result?.status === "number" && result.status !== 0) {
    throw new Error(`Desktop directory package failed with exit code ${result.status}`);
  }
  if (result?.error) {
    throw result.error;
  }
  const verification = verifyDesktopDirPackage({ root });
  if (!verification.valid) {
    throw new Error(`Desktop directory package verification failed:\n- ${verification.errors.join("\n- ")}`);
  }
  return verification;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || "")) {
  try {
    const result = packageDesktopDir();
    console.log(`Desktop directory package passed: ${result.artifact.appDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
