import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertVaultKey,
  bridgeDescriptor,
  deleteEncryptedVault,
  hasEncryptedVault,
  readEncryptedVault,
  runCli,
  vaultKeyDigest,
  writeEncryptedVault,
  type NativeSecureVaultCommandRunner,
} from "../scripts/native-secure-vault-bridge.mjs";

function windowsMockRunner(calls: Array<{ command: string; args: string[]; input?: string }>): NativeSecureVaultCommandRunner {
  return async (command, args, options = {}) => {
    calls.push({ command, args, input: options.input });
    const script = args.join("\n");
    if (script.includes("ProtectedData]::Protect")) {
      return { stdout: Buffer.from(options.input || "", "utf8").toString("base64") };
    }
    if (script.includes("ProtectedData]::Unprotect")) {
      return { stdout: Buffer.from((options.input || "").trim(), "base64").toString("utf8") };
    }
    throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
  };
}

describe("native secure vault bridge", () => {
  it("describes platform-backed providers for desktop vault integration", () => {
    expect(bridgeDescriptor("win32")).toMatchObject({
      providerName: "Windows DPAPI secure vault bridge",
      platform: "windows-dpapi",
      platformProtected: true,
    });
    expect(bridgeDescriptor("darwin")).toMatchObject({ platform: "macos-keychain", platformProtected: true });
    expect(bridgeDescriptor("linux")).toMatchObject({ platform: "linux-secret-service", platformProtected: true });
    expect(bridgeDescriptor("freebsd")).toMatchObject({ platform: "custom", platformProtected: false });
  });

  it("stores Windows vault records as DPAPI protected blobs without plaintext payloads", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "jium-native-vault-"));
    const calls: Array<{ command: string; args: string[]; input?: string }> = [];
    const runner = windowsMockRunner(calls);
    const key = "jium-ai.encrypted-cases.v1";
    const secretPayload = "{\"case\":\"sensitive victim evidence\"}";

    await writeEncryptedVault(key, secretPayload, { platform: "win32", dataDir, runner });

    const recordPath = path.join(dataDir, `${vaultKeyDigest(key)}.dpapi.json`);
    const recordText = await readFile(recordPath, "utf8");
    expect(recordText).not.toContain("sensitive victim evidence");
    expect(recordText).toContain("windows-dpapi");
    expect(await hasEncryptedVault(key, { platform: "win32", dataDir, runner })).toBe(true);
    expect(await readEncryptedVault(key, { platform: "win32", dataDir, runner })).toBe(secretPayload);

    await deleteEncryptedVault(key, { platform: "win32", dataDir, runner });
    expect(await hasEncryptedVault(key, { platform: "win32", dataDir, runner })).toBe(false);
    expect(calls.some((call) => call.command.includes("powershell"))).toBe(true);
  });

  it("rejects unsafe vault keys before reaching a platform command", async () => {
    expect(() => assertVaultKey("../escape")).toThrow("unsupported");
    await expect(writeEncryptedVault("../escape", "value", { platform: "linux" })).rejects.toThrow("unsupported");
  });

  it("uses Secret Service stdin for Linux writes and returns null for missing records", async () => {
    const calls: Array<{ command: string; args: string[]; input?: string }> = [];
    const runner: NativeSecureVaultCommandRunner = async (command, args, options = {}) => {
      calls.push({ command, args, input: options.input });
      if (args[0] === "store") {
        return { stdout: "" };
      }
      if (args[0] === "lookup") {
        throw new Error("not found");
      }
      if (args[0] === "clear") {
        return { stdout: "" };
      }
      throw new Error("unexpected secret-tool call");
    };

    await writeEncryptedVault("jium-ai.encrypted-cases.v1", "secret", { platform: "linux", runner });
    expect(calls[0]).toMatchObject({ command: "secret-tool", input: "secret" });
    expect(calls[0]?.args.join(" ")).not.toContain("secret ");
    expect(await readEncryptedVault("jium-ai.encrypted-cases.v1", { platform: "linux", runner })).toBeNull();
  });

  it("supports CLI file-based writes for PowerShell-safe manual checks", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "jium-native-vault-cli-"));
    const payloadPath = path.join(dataDir, "payload.json");
    const calls: Array<{ command: string; args: string[]; input?: string }> = [];
    const runner = windowsMockRunner(calls);
    await writeFile(payloadPath, "{\"ok\":true,\"message\":\"file-write\"}", "utf8");

    expect(await runCli(["write", "jium-ai.cli-test", payloadPath], { platform: "win32", dataDir, runner })).toBe("OK\n");
    expect(await runCli(["read", "jium-ai.cli-test"], { platform: "win32", dataDir, runner })).toBe("{\"ok\":true,\"message\":\"file-write\"}");
  });

  it("prints a CLI descriptor for preload integration", async () => {
    const output = await runCli(["describe"], { platform: "win32", runner: windowsMockRunner([]) });
    expect(JSON.parse(output)).toMatchObject({ platform: "windows-dpapi", platformProtected: true });
  });
});
