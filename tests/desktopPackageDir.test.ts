import { mkdirSync, truncateSync, writeFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  desktopPackageDirEnv,
  expectedDesktopDirArtifact,
  packageDesktopDir,
  verifyDesktopDirPackage,
} from "../scripts/package-desktop-dir.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-desktop-package-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "node_modules", "electron-builder", "out", "cli"), { recursive: true });
  await writeFile(path.join(dir, "node_modules", "electron-builder", "out", "cli", "cli.js"), "console.log('builder');\n", "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop directory package helper", () => {
  it("sets unsigned directory-package env without leaking update settings", () => {
    const env = desktopPackageDirEnv({ JIUM_DESKTOP_UPDATE_URL: "https://updates.example/jium-ai" } as unknown as NodeJS.ProcessEnv);

    expect(env.JIUM_DESKTOP_PACKAGE_MODE).toBe("dir");
    expect(env.CSC_IDENTITY_AUTO_DISCOVERY).toBe("false");
    expect(JSON.stringify({ mode: env.JIUM_DESKTOP_PACKAGE_MODE, csc: env.CSC_IDENTITY_AUTO_DISCOVERY })).not.toContain("updates.example");
  });

  it("verifies current-platform package artifacts", async () => {
    const root = await tempRepo();
    const artifact = expectedDesktopDirArtifact(root, "win32");

    expect(verifyDesktopDirPackage({ root, platform: "win32" }).valid).toBe(false);

    await mkdir(path.dirname(artifact.executable), { recursive: true });
    await mkdir(path.dirname(artifact.appArchive), { recursive: true });
    await writeFile(artifact.executable, "exe", "utf8");
    await writeFile(artifact.appArchive, "asar", "utf8");

    const result = verifyDesktopDirPackage({ root, platform: "win32" });

    expect(result.valid).toBe(true);
    expect(result.appArchiveBytes).toBe(4);
    expect(result.artifact.executable.endsWith("JiumAI.exe")).toBe(true);
  });

  it("rejects unexpectedly large app archives", async () => {
    const root = await tempRepo();
    const artifact = expectedDesktopDirArtifact(root, "win32");

    await mkdir(path.dirname(artifact.executable), { recursive: true });
    await mkdir(path.dirname(artifact.appArchive), { recursive: true });
    await writeFile(artifact.executable, "exe", "utf8");
    await writeFile(artifact.appArchive, "x", "utf8");
    truncateSync(artifact.appArchive, 12);

    const result = verifyDesktopDirPackage({ root, platform: "win32", maxAppArchiveBytes: 10 });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("desktop app archive too large");
    expect(result.appArchiveBytes).toBe(12);
  });

  it("runs electron-builder with the local CLI and validates artifacts", async () => {
    const root = await tempRepo();
    const artifact = expectedDesktopDirArtifact(root);
    const calls: Array<{ command: string; args: string[]; env?: NodeJS.ProcessEnv }> = [];

    const result = packageDesktopDir({
      root,
      runner: (command, args, options) => {
        calls.push({ command, args, env: options.env });
        mkdirSync(path.dirname(artifact.executable), { recursive: true });
        mkdirSync(path.dirname(artifact.appArchive), { recursive: true });
        writeFileSync(artifact.executable, "exe", "utf8");
        writeFileSync(artifact.appArchive, "asar", "utf8");
        return { status: 0 };
      },
    });

    expect(result.valid).toBe(true);
    expect(calls[0]?.command).toBe(process.execPath);
    expect(calls[0]?.args).toContain("--dir");
    expect(calls[0]?.env?.JIUM_DESKTOP_PACKAGE_MODE).toBe("dir");
  });
});
