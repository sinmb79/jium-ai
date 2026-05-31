const { contextBridge } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const bridgeScript = path.join(__dirname, "..", "scripts", "native-secure-vault-bridge.mjs");

function runBridge(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bridgeScript, ...args], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
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
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || stdout || `native secure vault bridge exited with ${code}`));
    });
    child.stdin.end(input);
  });
}

contextBridge.exposeInMainWorld("jiumSecureVault", {
  async readEncryptedVault(key) {
    const value = await runBridge(["read", key]);
    return value || null;
  },
  async writeEncryptedVault(key, value) {
    await runBridge(["write", key], value);
  },
  async deleteEncryptedVault(key) {
    await runBridge(["delete", key]);
  },
  async hasEncryptedVault(key) {
    return (await runBridge(["has", key])).trim() === "true";
  },
  async describe() {
    return JSON.parse(await runBridge(["describe"]));
  },
});
