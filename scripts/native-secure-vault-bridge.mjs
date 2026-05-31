import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const NATIVE_SECURE_VAULT_BRIDGE_VERSION = "jium-native-secure-vault-bridge-v1";
export const NATIVE_SECURE_VAULT_SERVICE = "jium-ai-secure-vault";

const WINDOWS_PROTECT_SCRIPT = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
$plain = [Console]::In.ReadToEnd()
$bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write([Convert]::ToBase64String($protected))
`;

const WINDOWS_UNPROTECT_SCRIPT = `
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
$blob = [Console]::In.ReadToEnd()
$protected = [Convert]::FromBase64String($blob.Trim())
$bytes = [System.Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($bytes))
`;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function assertVaultKey(key) {
  const value = clean(key);
  if (!value || value.length > 180) {
    throw new Error("vault key must be 1-180 characters");
  }
  if (!/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw new Error("vault key contains unsupported characters");
  }
  return value;
}

export function vaultKeyDigest(key) {
  return createHash("sha256").update(assertVaultKey(key)).digest("hex");
}

export function defaultDataDir(platform = process.platform, env = process.env) {
  if (env.JIUM_SECURE_VAULT_DIR) {
    return env.JIUM_SECURE_VAULT_DIR;
  }
  if (platform === "win32") {
    return join(env.APPDATA || join(homedir(), "AppData", "Roaming"), "JiumAI", "secure-vault");
  }
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "JiumAI", "secure-vault");
  }
  return join(env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "jium-ai", "secure-vault");
}

export function bridgeDescriptor(platform = process.platform) {
  if (platform === "win32") {
    return {
      version: NATIVE_SECURE_VAULT_BRIDGE_VERSION,
      providerName: "Windows DPAPI secure vault bridge",
      platform: "windows-dpapi",
      platformProtected: true,
      storageModel: "DPAPI CurrentUser protected blob stored under the user profile",
      warning: "",
    };
  }
  if (platform === "darwin") {
    return {
      version: NATIVE_SECURE_VAULT_BRIDGE_VERSION,
      providerName: "macOS Keychain secure vault bridge",
      platform: "macos-keychain",
      platformProtected: true,
      storageModel: "Generic password item in the current user's login Keychain",
      warning: "Keychain prompts and access-control policy depend on the local macOS profile.",
    };
  }
  if (platform === "linux") {
    return {
      version: NATIVE_SECURE_VAULT_BRIDGE_VERSION,
      providerName: "Linux Secret Service secure vault bridge",
      platform: "linux-secret-service",
      platformProtected: true,
      storageModel: "secret-tool item in the active Secret Service collection",
      warning: "Requires libsecret secret-tool and an unlocked user Secret Service collection.",
    };
  }
  return {
    version: NATIVE_SECURE_VAULT_BRIDGE_VERSION,
    providerName: "unsupported native secure vault bridge",
    platform: "custom",
    platformProtected: false,
    storageModel: "unsupported platform",
    warning: `Unsupported platform: ${platform}`,
  };
}

export function defaultCommandRunner(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: options.env || process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
    });
    child.stdin.end(options.input || "");
  });
}

function powershellCommand(env = process.env) {
  return env.JIUM_POWERSHELL || "powershell.exe";
}

async function protectWindows(value, runner, env) {
  const result = await runner(powershellCommand(env), ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_PROTECT_SCRIPT], { input: value, env });
  return clean(result.stdout);
}

async function unprotectWindows(value, runner, env) {
  const result = await runner(powershellCommand(env), ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_UNPROTECT_SCRIPT], { input: value, env });
  return result.stdout;
}

function windowsRecordPath(key, dataDir) {
  return join(dataDir, `${vaultKeyDigest(key)}.dpapi.json`);
}

async function writeWindowsVault(key, value, options) {
  const dataDir = options.dataDir || defaultDataDir("win32", options.env);
  const recordPath = windowsRecordPath(key, dataDir);
  const protectedData = await protectWindows(value, options.runner, options.env);
  await mkdir(dirname(recordPath), { recursive: true });
  await writeFile(
    recordPath,
    JSON.stringify(
      {
        version: NATIVE_SECURE_VAULT_BRIDGE_VERSION,
        keyDigest: vaultKeyDigest(key),
        provider: "windows-dpapi",
        protectedAt: new Date().toISOString(),
        protectedData,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function readWindowsVault(key, options) {
  const dataDir = options.dataDir || defaultDataDir("win32", options.env);
  const recordPath = windowsRecordPath(key, dataDir);
  if (!existsSync(recordPath)) {
    return null;
  }
  const parsed = JSON.parse(await readFile(recordPath, "utf8"));
  if (parsed?.provider !== "windows-dpapi" || parsed?.keyDigest !== vaultKeyDigest(key) || typeof parsed?.protectedData !== "string") {
    throw new Error("Windows DPAPI vault record is invalid");
  }
  return unprotectWindows(parsed.protectedData, options.runner, options.env);
}

async function deleteWindowsVault(key, options) {
  const dataDir = options.dataDir || defaultDataDir("win32", options.env);
  await rm(windowsRecordPath(key, dataDir), { force: true });
}

function keychainAccount(key) {
  return `jium-ai:${vaultKeyDigest(key)}`;
}

async function writeMacVault(key, value, options) {
  await options.runner("security", ["add-generic-password", "-U", "-s", NATIVE_SECURE_VAULT_SERVICE, "-a", keychainAccount(key), "-w", value], { env: options.env });
}

async function readMacVault(key, options) {
  try {
    const result = await options.runner("security", ["find-generic-password", "-s", NATIVE_SECURE_VAULT_SERVICE, "-a", keychainAccount(key), "-w"], { env: options.env });
    return result.stdout;
  } catch (error) {
    if (String(error?.message || error).includes("could not be found")) {
      return null;
    }
    throw error;
  }
}

async function deleteMacVault(key, options) {
  try {
    await options.runner("security", ["delete-generic-password", "-s", NATIVE_SECURE_VAULT_SERVICE, "-a", keychainAccount(key)], { env: options.env });
  } catch (error) {
    if (!String(error?.message || error).includes("could not be found")) {
      throw error;
    }
  }
}

function linuxAttributes(key) {
  return ["application", "jium-ai", "vault-key", vaultKeyDigest(key)];
}

async function writeLinuxVault(key, value, options) {
  await options.runner("secret-tool", ["store", "--label", `JiumAI secure vault ${vaultKeyDigest(key).slice(0, 12)}`, ...linuxAttributes(key)], { input: value, env: options.env });
}

async function readLinuxVault(key, options) {
  try {
    const result = await options.runner("secret-tool", ["lookup", ...linuxAttributes(key)], { env: options.env });
    return result.stdout || null;
  } catch (error) {
    if (String(error?.message || error).includes("no such secret") || String(error?.message || error).includes("not found")) {
      return null;
    }
    throw error;
  }
}

async function deleteLinuxVault(key, options) {
  try {
    await options.runner("secret-tool", ["clear", ...linuxAttributes(key)], { env: options.env });
  } catch (error) {
    if (!String(error?.message || error).includes("not found")) {
      throw error;
    }
  }
}

function normalizeOptions(options = {}) {
  return {
    platform: options.platform || process.platform,
    dataDir: options.dataDir,
    env: options.env || process.env,
    runner: options.runner || defaultCommandRunner,
  };
}

export async function writeEncryptedVault(key, value, options = {}) {
  const safeKey = assertVaultKey(key);
  const next = normalizeOptions(options);
  if (typeof value !== "string") {
    throw new Error("vault value must be a string");
  }
  if (next.platform === "win32") {
    await writeWindowsVault(safeKey, value, next);
    return;
  }
  if (next.platform === "darwin") {
    await writeMacVault(safeKey, value, next);
    return;
  }
  if (next.platform === "linux") {
    await writeLinuxVault(safeKey, value, next);
    return;
  }
  throw new Error(`native secure vault bridge is not supported on ${next.platform}`);
}

export async function readEncryptedVault(key, options = {}) {
  const safeKey = assertVaultKey(key);
  const next = normalizeOptions(options);
  if (next.platform === "win32") {
    return readWindowsVault(safeKey, next);
  }
  if (next.platform === "darwin") {
    return readMacVault(safeKey, next);
  }
  if (next.platform === "linux") {
    return readLinuxVault(safeKey, next);
  }
  throw new Error(`native secure vault bridge is not supported on ${next.platform}`);
}

export async function deleteEncryptedVault(key, options = {}) {
  const safeKey = assertVaultKey(key);
  const next = normalizeOptions(options);
  if (next.platform === "win32") {
    await deleteWindowsVault(safeKey, next);
    return;
  }
  if (next.platform === "darwin") {
    await deleteMacVault(safeKey, next);
    return;
  }
  if (next.platform === "linux") {
    await deleteLinuxVault(safeKey, next);
    return;
  }
  throw new Error(`native secure vault bridge is not supported on ${next.platform}`);
}

export async function hasEncryptedVault(key, options = {}) {
  return (await readEncryptedVault(key, options)) !== null;
}

export async function runCli(argv, options = {}) {
  const [command, key, filePath] = argv;
  const next = normalizeOptions(options);
  if (!command || command === "help" || command === "--help") {
    return `Usage:
  node scripts/native-secure-vault-bridge.mjs describe
  node scripts/native-secure-vault-bridge.mjs write <key> [utf8-file]   # omit file to read from stdin
  node scripts/native-secure-vault-bridge.mjs read <key>
  node scripts/native-secure-vault-bridge.mjs has <key>
  node scripts/native-secure-vault-bridge.mjs delete <key>
`;
  }
  if (command === "describe") {
    return `${JSON.stringify(bridgeDescriptor(next.platform), null, 2)}\n`;
  }
  if (!key) {
    throw new Error(`${command} requires a vault key`);
  }
  if (command === "write") {
    const value = filePath
      ? await readFile(filePath, "utf8")
      : await (async () => {
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(Buffer.from(chunk));
          }
          return Buffer.concat(chunks).toString("utf8");
        })();
    await writeEncryptedVault(key, value, next);
    return "OK\n";
  }
  if (command === "read") {
    const value = await readEncryptedVault(key, next);
    return value === null ? "" : value;
  }
  if (command === "has") {
    return `${await hasEncryptedVault(key, next) ? "true" : "false"}\n`;
  }
  if (command === "delete") {
    await deleteEncryptedVault(key, next);
    return "OK\n";
  }
  throw new Error(`Unknown command: ${command}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  runCli(process.argv.slice(2))
    .then((output) => {
      process.stdout.write(output);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
