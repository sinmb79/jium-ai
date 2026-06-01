const { contextBridge, ipcRenderer } = require("electron");

const SECURE_VAULT_CHANNELS = {
  read: "jium-secure-vault:read",
  write: "jium-secure-vault:write",
  delete: "jium-secure-vault:delete",
  has: "jium-secure-vault:has",
  describe: "jium-secure-vault:describe",
};

contextBridge.exposeInMainWorld("jiumSecureVault", {
  async readEncryptedVault(key) {
    return ipcRenderer.invoke(SECURE_VAULT_CHANNELS.read, key);
  },
  async writeEncryptedVault(key, value) {
    await ipcRenderer.invoke(SECURE_VAULT_CHANNELS.write, key, value);
  },
  async deleteEncryptedVault(key) {
    await ipcRenderer.invoke(SECURE_VAULT_CHANNELS.delete, key);
  },
  async hasEncryptedVault(key) {
    return ipcRenderer.invoke(SECURE_VAULT_CHANNELS.has, key);
  },
  async describe() {
    return ipcRenderer.invoke(SECURE_VAULT_CHANNELS.describe);
  },
});
