import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DESKTOP_APP_DIR,
  buildDesktopAppPackageJson,
  prepareDesktopAppDir,
  resolveNpmInstallInvocation,
  verifyDesktopAppDir,
} from "../scripts/prepare-desktop-app-dir.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-desktop-app-dir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "desktop"), { recursive: true });
  await mkdir(path.join(dir, "scripts"), { recursive: true });
  await mkdir(path.join(dir, "out", "dashboard"), { recursive: true });
  await writeFile(path.join(dir, "desktop", "electron-main.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(dir, "desktop", "electron-preload.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(dir, "scripts", "native-secure-vault-bridge.mjs"), "export {};\n", "utf8");
  await writeFile(path.join(dir, "out", "index.html"), "<!doctype html>\n", "utf8");
  await writeFile(path.join(dir, "out", "dashboard", "index.html"), "<!doctype html>\n", "utf8");
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        version: "0.1.0",
        description: "JiumAI desktop staging test",
        author: "22B Labs",
        dependencies: {
          "@prisma/client": "^6.19.0",
          "electron-updater": "^6.8.3",
          next: "^16.0.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("desktop app staging", () => {
  it("builds a lean Electron app package manifest", async () => {
    const root = await tempRepo();

    const packageJson = buildDesktopAppPackageJson(root);

    expect(packageJson.main).toBe("desktop/electron-main.cjs");
    expect(packageJson.dependencies).toEqual({ "electron-updater": "^6.8.3" });
    expect(JSON.stringify(packageJson)).not.toContain("next");
    expect(JSON.stringify(packageJson)).not.toContain("@prisma/client");
  });

  it("prepares a clean app directory without root web dependencies", async () => {
    const root = await tempRepo();

    const result = prepareDesktopAppDir({ root, install: false });
    const stagedPackage = JSON.parse(await readFile(path.join(root, DESKTOP_APP_DIR, "package.json"), "utf8"));

    expect(result.valid).toBe(true);
    expect(result.appDir.endsWith(path.join("dist", "electron-app"))).toBe(true);
    expect(stagedPackage.dependencies).toEqual({ "electron-updater": "^6.8.3" });
    expect(await readFile(path.join(root, DESKTOP_APP_DIR, "out", "dashboard", "index.html"), "utf8")).toContain("<!doctype html>");
    expect(verifyDesktopAppDir({ root }).valid).toBe(true);
  });

  it("uses a shell-safe npm invocation on Windows for dependency installation", () => {
    expect(resolveNpmInstallInvocation({ platform: "win32", env: {} as NodeJS.ProcessEnv })).toEqual({
      command: "cmd",
      args: ["/d", "/s", "/c", "npm"],
    });
    expect(resolveNpmInstallInvocation({ platform: "linux", env: {} as NodeJS.ProcessEnv })).toEqual({
      command: "npm",
      args: [],
    });
  });
});
