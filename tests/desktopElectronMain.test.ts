import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const electronMain = require("../desktop/electron-main.cjs") as {
  configureAutoUpdates: (options: {
    autoUpdater?: {
      setFeedURL?: (options: { provider: string; url: string; channel: string }) => void;
      checkForUpdates?: () => Promise<unknown>;
      autoDownload?: boolean;
      autoInstallOnAppQuit?: boolean;
    } | null;
    env?: Record<string, string | undefined>;
    logger?: { warn?: (message: string) => void };
  }) => { configured: boolean; reason: string; summary: { enabled: boolean; releaseChannel: string; updateUrlProtocol: string } };
  extractRawPath: (rawUrl: string) => string;
  isAllowedExternalUrl: (rawUrl: string) => boolean;
  isDesktopAppUrl: (rawUrl: string, devServerUrl?: string) => boolean;
  normalizeDesktopRoutePath: (rawPath: string) => string | null;
  registerSecureVaultIpc: (options: {
    ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => void };
    bridgeLoader: () => Promise<{
      readEncryptedVault: (key: string) => Promise<string | null>;
      writeEncryptedVault: (key: string, value: string) => Promise<void>;
      deleteEncryptedVault: (key: string) => Promise<void>;
      hasEncryptedVault: (key: string) => Promise<boolean>;
      bridgeDescriptor: (platform: NodeJS.Platform) => Record<string, unknown>;
    }>;
    logger?: { info?: (message: string) => void };
  }) => { registered: boolean; channels: Record<string, string> };
  resolveStaticAssetPath: (staticRoot: string, requestUrl: string) => string | null;
  summarizeAutoUpdateEnv: (env?: Record<string, string | undefined>) => { enabled: boolean; releaseChannel: string; updateUrlProtocol: string };
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

  it("configures updater only when explicit HTTPS release settings are present", async () => {
    const feedCalls: Array<{ provider: string; url: string; channel: string }> = [];
    const updater = {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      setFeedURL: (options: { provider: string; url: string; channel: string }) => {
        feedCalls.push(options);
      },
      checkForUpdates: async () => undefined,
    };

    expect(electronMain.summarizeAutoUpdateEnv({ JIUM_DESKTOP_AUTO_UPDATE: "true", JIUM_DESKTOP_UPDATE_URL: "http://updates.example" })).toMatchObject({
      enabled: true,
      updateUrlProtocol: "UNSAFE",
    });

    const blocked = electronMain.configureAutoUpdates({
      autoUpdater: updater,
      env: {
        JIUM_DESKTOP_AUTO_UPDATE: "true",
        JIUM_DESKTOP_RELEASE_CHANNEL: "stable",
        JIUM_DESKTOP_UPDATE_URL: "http://updates.example",
      },
    });
    const configured = electronMain.configureAutoUpdates({
      autoUpdater: updater,
      env: {
        JIUM_DESKTOP_AUTO_UPDATE: "true",
        JIUM_DESKTOP_RELEASE_CHANNEL: "stable",
        JIUM_DESKTOP_UPDATE_URL: "https://updates.example/jium-ai",
      },
    });

    expect(blocked.configured).toBe(false);
    expect(blocked.reason).toContain("HTTPS");
    expect(configured.configured).toBe(true);
    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    expect(feedCalls).toEqual([{ provider: "generic", url: "https://updates.example/jium-ai", channel: "stable" }]);
    expect(JSON.stringify(configured.summary)).not.toContain("updates.example");
  });

  it("registers secure vault IPC handlers in the main process", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const writes: Array<{ key: string; value: string }> = [];
    const registration = electronMain.registerSecureVaultIpc({
      ipcMain: {
        handle: (channel, handler) => {
          handlers.set(channel, handler);
        },
      },
      bridgeLoader: async () => ({
        readEncryptedVault: async (key) => `read:${key}`,
        writeEncryptedVault: async (key, value) => {
          writes.push({ key, value });
        },
        deleteEncryptedVault: async () => undefined,
        hasEncryptedVault: async () => true,
        bridgeDescriptor: (platform) => ({ platform, platformProtected: true }),
      }),
      logger: {},
    });

    expect(registration.registered).toBe(true);
    expect(await handlers.get("jium-secure-vault:read")?.({}, "case-1")).toBe("read:case-1");
    expect(await handlers.get("jium-secure-vault:has")?.({}, "case-1")).toBe(true);
    expect(await handlers.get("jium-secure-vault:describe")?.({})).toMatchObject({ platformProtected: true });
    await handlers.get("jium-secure-vault:write")?.({}, "case-1", "encrypted");
    expect(writes).toEqual([{ key: "case-1", value: "encrypted" }]);
    await expect(handlers.get("jium-secure-vault:write")?.({}, "case-1", 1)).rejects.toThrow("vault value");
  });
});
