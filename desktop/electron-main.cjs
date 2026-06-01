const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DESKTOP_PROTOCOL = "jium";
const DESKTOP_HOST = "app";
const SECURE_VAULT_CHANNELS = {
  read: "jium-secure-vault:read",
  write: "jium-secure-vault:write",
  delete: "jium-secure-vault:delete",
  has: "jium-secure-vault:has",
  describe: "jium-secure-vault:describe",
};

function isElectronRuntime() {
  return Boolean(process.versions && process.versions.electron);
}

function resolveDesktopStaticRoot(root = process.env.JIUM_DESKTOP_STATIC_DIR || path.join(__dirname, "..", "out")) {
  return path.resolve(root);
}

function extractRawPath(rawUrl) {
  const value = String(rawUrl || "");
  const withoutFragment = value.split("#")[0] || "";
  const withoutQuery = withoutFragment.split("?")[0] || "";
  const protocolNeedle = "://";
  const protocolIndex = withoutQuery.indexOf(protocolNeedle);
  if (protocolIndex === -1) {
    return "/";
  }
  const afterHostIndex = withoutQuery.indexOf("/", protocolIndex + protocolNeedle.length);
  return afterHostIndex === -1 ? "/" : withoutQuery.slice(afterHostIndex);
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeDesktopRoutePath(rawPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath || "/");
  } catch {
    return null;
  }

  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    return null;
  }

  const segments = decodedPath.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  let safeRelative = segments.join("/");
  if (!safeRelative || decodedPath.endsWith("/")) {
    safeRelative = path.join(safeRelative, "index.html");
  } else if (!path.extname(safeRelative)) {
    safeRelative = path.join(safeRelative, "index.html");
  }
  return safeRelative;
}

function resolveStaticAssetPath(staticRoot, requestUrl) {
  const rawPath = extractRawPath(requestUrl);
  const safeRelative = normalizeDesktopRoutePath(rawPath);
  if (!safeRelative) {
    return null;
  }

  const root = resolveDesktopStaticRoot(staticRoot);
  const candidates = [safeRelative];
  if (safeRelative !== "index.html" && safeRelative.endsWith(`${path.sep}index.html`)) {
    candidates.push(`${path.dirname(safeRelative)}.html`);
  }

  for (const candidate of candidates) {
    const target = path.resolve(root, candidate);
    if (!isPathInside(root, target)) {
      return null;
    }
    if (fs.existsSync(target)) {
      return target;
    }
  }

  const fallback = path.resolve(root, safeRelative);
  return isPathInside(root, fallback) ? fallback : null;
}

function isAllowedExternalUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isDesktopAppUrl(rawUrl, devServerUrl = process.env.JIUM_DESKTOP_DEV_SERVER || "") {
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol === `${DESKTOP_PROTOCOL}:` && url.hostname === DESKTOP_HOST) {
      return true;
    }
    if (devServerUrl) {
      const devUrl = new URL(devServerUrl);
      return url.origin === devUrl.origin;
    }
    return false;
  } catch {
    return false;
  }
}

function registerDesktopProtocol({ protocol, net, staticRoot }) {
  protocol.handle(DESKTOP_PROTOCOL, (request) => {
    const assetPath = resolveStaticAssetPath(staticRoot, request.url);
    if (!assetPath || !fs.existsSync(assetPath)) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

function createMainWindow({ BrowserWindow, shell, staticRoot }) {
  const preloadPath = path.join(__dirname, "electron-preload.cjs");
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "지움AI",
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  const devServerUrl = process.env.JIUM_DESKTOP_DEV_SERVER || "";
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isDesktopAppUrl(url, devServerUrl)) {
      return;
    }
    event.preventDefault();
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
  });

  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(staticRoot, "index.html");
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Desktop static export missing: ${indexPath}. Run npm run desktop:export first.`);
    }
    window.loadURL(`${DESKTOP_PROTOCOL}://${DESKTOP_HOST}/index.html`);
  }

  return window;
}

function summarizeAutoUpdateEnv(env = process.env) {
  let updateUrlProtocol = "MISSING";
  if (env.JIUM_DESKTOP_UPDATE_URL) {
    try {
      updateUrlProtocol = new URL(env.JIUM_DESKTOP_UPDATE_URL).protocol === "https:" ? "HTTPS" : "UNSAFE";
    } catch {
      updateUrlProtocol = "INVALID";
    }
  }
  return {
    enabled: env.JIUM_DESKTOP_AUTO_UPDATE === "true",
    releaseChannel: env.JIUM_DESKTOP_RELEASE_CHANNEL ? "SET" : "MISSING",
    updateUrlProtocol,
  };
}

function configureAutoUpdates({ autoUpdater, env = process.env, logger = console } = {}) {
  const summary = summarizeAutoUpdateEnv(env);
  if (!summary.enabled) {
    return { configured: false, reason: "JIUM_DESKTOP_AUTO_UPDATE is not true", summary };
  }
  if (summary.updateUrlProtocol !== "HTTPS") {
    return { configured: false, reason: "JIUM_DESKTOP_UPDATE_URL must be HTTPS", summary };
  }
  if (!env.JIUM_DESKTOP_RELEASE_CHANNEL) {
    return { configured: false, reason: "JIUM_DESKTOP_RELEASE_CHANNEL is missing", summary };
  }
  if (!autoUpdater || typeof autoUpdater.setFeedURL !== "function") {
    return { configured: false, reason: "electron-updater is not available", summary };
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.setFeedURL({
    provider: "generic",
    url: env.JIUM_DESKTOP_UPDATE_URL,
    channel: env.JIUM_DESKTOP_RELEASE_CHANNEL,
  });
  if (typeof autoUpdater.checkForUpdates === "function") {
    autoUpdater.checkForUpdates().catch((error) => {
      logger.warn?.(`Desktop update check failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  return { configured: true, reason: "HTTPS update feed configured", summary };
}

function loadAutoUpdater() {
  try {
    return require("electron-updater").autoUpdater;
  } catch {
    return null;
  }
}

function resolveNativeVaultBridgePath(root = path.join(__dirname, "..")) {
  return path.resolve(root, "scripts", "native-secure-vault-bridge.mjs");
}

async function loadNativeVaultBridge(bridgePath = resolveNativeVaultBridgePath()) {
  return import(pathToFileURL(bridgePath).toString());
}

function registerSecureVaultIpc({ ipcMain, bridgeLoader = loadNativeVaultBridge, logger = console } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new Error("Electron ipcMain is required for the secure vault bridge.");
  }

  const withBridge = async (operation) => {
    const bridge = await bridgeLoader();
    return operation(bridge);
  };

  ipcMain.handle(SECURE_VAULT_CHANNELS.read, async (_event, key) =>
    withBridge((bridge) => bridge.readEncryptedVault(key)),
  );
  ipcMain.handle(SECURE_VAULT_CHANNELS.write, async (_event, key, value) => {
    if (typeof value !== "string") {
      throw new Error("vault value must be a string");
    }
    await withBridge((bridge) => bridge.writeEncryptedVault(key, value));
    return null;
  });
  ipcMain.handle(SECURE_VAULT_CHANNELS.delete, async (_event, key) => {
    await withBridge((bridge) => bridge.deleteEncryptedVault(key));
    return null;
  });
  ipcMain.handle(SECURE_VAULT_CHANNELS.has, async (_event, key) =>
    withBridge((bridge) => bridge.hasEncryptedVault(key)),
  );
  ipcMain.handle(SECURE_VAULT_CHANNELS.describe, async () =>
    withBridge((bridge) => bridge.bridgeDescriptor(process.platform)),
  );

  logger.info?.("Secure vault IPC bridge registered.");
  return { registered: true, channels: { ...SECURE_VAULT_CHANNELS } };
}

function startElectronApp() {
  if (!isElectronRuntime()) {
    throw new Error("desktop/electron-main.cjs must be launched by Electron, not plain Node.js.");
  }

  const { app, BrowserWindow, ipcMain, net, protocol, shell } = require("electron");
  const staticRoot = resolveDesktopStaticRoot();
  registerSecureVaultIpc({ ipcMain });

  protocol.registerSchemesAsPrivileged([
    {
      scheme: DESKTOP_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);

  app.whenReady().then(() => {
    registerDesktopProtocol({ protocol, net, staticRoot });
    createMainWindow({ BrowserWindow, shell, staticRoot });
    configureAutoUpdates({ autoUpdater: loadAutoUpdater() });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow({ BrowserWindow, shell, staticRoot });
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

module.exports = {
  DESKTOP_HOST,
  DESKTOP_PROTOCOL,
  SECURE_VAULT_CHANNELS,
  createMainWindow,
  configureAutoUpdates,
  extractRawPath,
  isAllowedExternalUrl,
  isDesktopAppUrl,
  isElectronRuntime,
  loadNativeVaultBridge,
  loadAutoUpdater,
  normalizeDesktopRoutePath,
  registerSecureVaultIpc,
  registerDesktopProtocol,
  resolveNativeVaultBridgePath,
  resolveDesktopStaticRoot,
  resolveStaticAssetPath,
  summarizeAutoUpdateEnv,
  startElectronApp,
};

if (require.main === module) {
  try {
    startElectronApp();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
