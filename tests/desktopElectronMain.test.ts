import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const electronMain = require("../desktop/electron-main.cjs") as {
  extractRawPath: (rawUrl: string) => string;
  isAllowedExternalUrl: (rawUrl: string) => boolean;
  isDesktopAppUrl: (rawUrl: string, devServerUrl?: string) => boolean;
  normalizeDesktopRoutePath: (rawPath: string) => string | null;
  resolveStaticAssetPath: (staticRoot: string, requestUrl: string) => string | null;
};

const tempDirs: string[] = [];

async function tempStaticRoot() {
  const dir = path.join(os.tmpdir(), `jium-electron-main-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "dashboard"), { recursive: true });
  await writeFile(path.join(dir, "index.html"), "<!doctype html>\n", "utf8");
  await writeFile(path.join(dir, "dashboard", "index.html"), "<!doctype html>\n", "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Electron desktop main process helpers", () => {
  it("resolves desktop app URLs to files inside the static export", async () => {
    const root = await tempStaticRoot();

    expect(electronMain.resolveStaticAssetPath(root, "jium://app/index.html")).toBe(path.join(root, "index.html"));
    expect(electronMain.resolveStaticAssetPath(root, "jium://app/dashboard/")).toBe(path.join(root, "dashboard", "index.html"));
    expect(electronMain.resolveStaticAssetPath(root, "jium://app/dashboard")).toBe(path.join(root, "dashboard", "index.html"));
  });

  it("rejects path traversal, encoded traversal, and non-app routes", async () => {
    const root = await tempStaticRoot();

    expect(electronMain.extractRawPath("jium://app/../secret")).toBe("/../secret");
    expect(electronMain.normalizeDesktopRoutePath("/../secret")).toBeNull();
    expect(electronMain.resolveStaticAssetPath(root, "jium://app/../secret")).toBeNull();
    expect(electronMain.resolveStaticAssetPath(root, "jium://app/%2e%2e/secret")).toBeNull();
    expect(electronMain.resolveStaticAssetPath(root, "jium://app/%5Csecret")).toBeNull();
  });

  it("keeps navigation in the desktop app and only permits HTTPS external links", () => {
    expect(electronMain.isDesktopAppUrl("jium://app/index.html")).toBe(true);
    expect(electronMain.isDesktopAppUrl("http://127.0.0.1:3000/dashboard", "http://127.0.0.1:3000")).toBe(true);
    expect(electronMain.isDesktopAppUrl("http://127.0.0.1:3001/dashboard", "http://127.0.0.1:3000")).toBe(false);

    expect(electronMain.isAllowedExternalUrl("https://official.example/help")).toBe(true);
    expect(electronMain.isAllowedExternalUrl("http://official.example/help")).toBe(false);
    expect(electronMain.isAllowedExternalUrl("file:///C:/Users/sinmb/secrets.txt")).toBe(false);
    expect(electronMain.isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
  });
});
