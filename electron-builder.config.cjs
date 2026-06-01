const releaseChannel = process.env.JIUM_DESKTOP_RELEASE_CHANNEL || "manual";
const updateUrl = process.env.JIUM_DESKTOP_UPDATE_URL || "https://updates.invalid/jium-ai";
const packageMode = process.env.JIUM_DESKTOP_PACKAGE_MODE || "release";
const isDirSmokePackage = packageMode === "dir";

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: "ai.jium.desktop",
  productName: "JiumAI",
  executableName: "JiumAI",
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
  copyright: "Copyright (c) 2026 22B Labs",
  directories: {
    app: "dist/electron-app",
    output: "dist/desktop",
    buildResources: "desktop/build",
  },
  asar: true,
  npmRebuild: false,
  extraMetadata: {
    main: "desktop/electron-main.cjs",
  },
  files: [
    "package.json",
    "node_modules/**",
    "desktop/electron-main.cjs",
    "desktop/electron-preload.cjs",
    "scripts/native-secure-vault-bridge.mjs",
    "out/**",
  ],
  publish: [
    {
      provider: "generic",
      url: updateUrl,
      channel: releaseChannel,
    },
  ],
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    signAndEditExecutable: !isDirSmokePackage,
    verifyUpdateCodeSignature: !isDirSmokePackage,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
  },
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.productivity",
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },
  linux: {
    target: ["AppImage"],
    category: "Utility",
  },
};
