import { mkdirSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDesktopExport,
  desktopExportEnv,
  resolveNextBuildInvocation,
  verifyDesktopExport,
} from "../scripts/build-desktop-export.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-desktop-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeExport(root: string, html = "<!doctype html><script src=\"/_next/app.js\"></script>") {
  await mkdir(path.join(root, "out", "dashboard"), { recursive: true });
  await mkdir(path.join(root, "out", "_next"), { recursive: true });
  await writeFile(path.join(root, "out", "index.html"), html, "utf8");
  await writeFile(path.join(root, "out", "dashboard", "index.html"), html, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop static export build", () => {
  it("forces the desktop export env profile and disables the Pages basePath", () => {
    const env = desktopExportEnv({ GITHUB_PAGES: "true", JIUM_DESKTOP_EXPORT: "false" } as unknown as NodeJS.ProcessEnv);

    expect(env.GITHUB_PAGES).toBe("false");
    expect(env.JIUM_DESKTOP_EXPORT).toBe("true");
    expect(env.NEXT_TELEMETRY_DISABLED).toBe("1");
  });

  it("detects missing exports and stale GitHub Pages asset prefixes", async () => {
    const root = await tempRepo();

    expect(verifyDesktopExport({ root }).valid).toBe(false);

    await writeExport(root, "<!doctype html><script src=\"/jium-ai/_next/app.js\"></script>");
    const result = verifyDesktopExport({ root });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("GitHub Pages basePath");
  });

  it("runs Next build through the local binary when available", async () => {
    const root = await tempRepo();
    await mkdir(path.join(root, "node_modules", "next", "dist", "bin"), { recursive: true });
    await writeFile(path.join(root, "node_modules", "next", "dist", "bin", "next"), "", "utf8");

    const invocation = resolveNextBuildInvocation(root);

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args[0]).toContain(path.join("node_modules", "next", "dist", "bin", "next"));
    expect(invocation.args.join(" ")).toContain("build");
  });

  it("builds, verifies, and writes a desktop manifest", async () => {
    const root = await tempRepo();
    const calls: Array<{ command: string; args: string[]; env?: NodeJS.ProcessEnv }> = [];

    const result = buildDesktopExport({
      root,
      runner: (command, args, options) => {
        calls.push({ command, args, env: options?.env as NodeJS.ProcessEnv });
        mkdirSync(path.join(root, "out", "dashboard"), { recursive: true });
        mkdirSync(path.join(root, "out", "_next"), { recursive: true });
        writeFileSync(path.join(root, "out", "index.html"), "<!doctype html><script src=\"/_next/app.js\"></script>", "utf8");
        writeFileSync(path.join(root, "out", "dashboard", "index.html"), "<!doctype html><script src=\"/_next/app.js\"></script>", "utf8");
        return { status: 0 };
      },
    });
    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.env?.JIUM_DESKTOP_EXPORT).toBe("true");
    expect(result.valid).toBe(true);
    expect(manifest.profile).toBe("desktop-static-export");
    expect(manifest.routes).toContain("dashboard/index.html");
  });
});
