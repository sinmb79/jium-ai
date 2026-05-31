import { describe, expect, it } from "vitest";
import { decryptJsonWithPassphrase, encryptJsonWithPassphrase, isEncryptedJsonPayload } from "@/lib/localCrypto";

describe("local crypto", () => {
  it("encrypts and decrypts JSON without exposing plaintext in the payload", async () => {
    const payload = await encryptJsonWithPassphrase({ title: "민감 사건", url: "https://example.com/private" }, "long passphrase for test", 1_000);

    expect(isEncryptedJsonPayload(payload)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("민감 사건");
    expect(JSON.stringify(payload)).not.toContain("example.com/private");

    const decrypted = await decryptJsonWithPassphrase<{ title: string; url: string }>(payload, "long passphrase for test");
    expect(decrypted.title).toBe("민감 사건");
    expect(decrypted.url).toBe("https://example.com/private");
  });

  it("rejects a wrong passphrase", async () => {
    const payload = await encryptJsonWithPassphrase({ ok: true }, "long passphrase for test", 1_000);

    await expect(decryptJsonWithPassphrase(payload, "wrong passphrase text")).rejects.toThrow();
  });
});
