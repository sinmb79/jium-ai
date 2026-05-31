import { describe, expect, it } from "vitest";
import { formatVaultRemainingTime, shouldAutoLockVault, vaultAutoLockPolicyText, vaultRemainingLockMs } from "@/lib/vaultSessionSecurity";

describe("vault session security", () => {
  it("auto-locks only after the idle timeout", () => {
    const session = { unlockedAt: 1_000, lastActivityAt: 2_000 };

    expect(shouldAutoLockVault(session, 2_000 + 299_999)).toBe(false);
    expect(shouldAutoLockVault(session, 2_000 + 300_000)).toBe(true);
  });

  it("formats the remaining lock time for the user", () => {
    const session = { unlockedAt: 1_000, lastActivityAt: 2_000 };

    expect(vaultRemainingLockMs(session, 2_000 + 125_000)).toBe(175_000);
    expect(formatVaultRemainingTime(175_000)).toBe("2분 55초");
    expect(vaultAutoLockPolicyText()).toContain("자동으로 잠기고");
  });
});
