const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DESKTOP_PROTOCOL = "jium";
const DESKTOP_HOST = "app";

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

function startElectronApp() {
  if (!isElectronRuntime()) {
    throw new Error("desktop/electron-main.cjs must be launched by Electron, not plain Node.js.");
  }

  const { app, BrowserWindow, net, protocol, shell } = require("electron");
  const staticRoot = resolveDesktopStaticRoot();

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
  createMainWindow,
  extractRawPath,
  isAllowedExternalUrl,
  isDesktopAppUrl,
  isElectronRuntime,
  normalizeDesktopRoutePath,
  registerDesktopProtocol,
  resolveDesktopStaticRoot,
  resolveStaticAssetPath,
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
