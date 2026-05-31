import { describe, expect, it } from "vitest";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import {
  buildTrustedKeyRetirementPatch,
  buildTrustedKeyRotationPatch,
  parseTrustedKeyRegistryText,
  reviewTrustedKeyLifecycle,
} from "@/lib/trustedKeyLifecycle";

const now = Date.parse("2026-06-01T00:00:00.000Z");

function key(overrides: Partial<TrustedAuthorizedFeedKey> = {}): TrustedAuthorizedFeedKey {
  return {
    keyId: "partner-key-active",
    issuerName: "Authorized Partner",
    algorithm: "RSASSA-PKCS1-v1_5",
    publicKeyJwk: {
      kty: "RSA",
      n: "public-modulus-lifecycle",
      e: "AQAB",
      use: "sig",
    },
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("trusted key lifecycle", () => {
  it("summarizes active, expiring, expired, not-yet-active, and no-expiry keys", async () => {
    const review = await reviewTrustedKeyLifecycle(
      [
        key(),
        key({ keyId: "partner-key-expiring", validUntil: "2026-06-10T00:00:00.000Z" }),
        key({ keyId: "partner-key-expired", validUntil: "2026-05-01T00:00:00.000Z" }),
        key({ keyId: "partner-key-future", validFrom: "2026-07-01T00:00:00.000Z", validUntil: "2027-07-01T00:00:00.000Z" }),
        key({ keyId: "partner-key-no-expiry", validUntil: undefined }),
      ],
      { now, expiringWithinDays: 30 },
    );

    expect(review.activeCount).toBe(3);
    expect(review.expiringSoonCount).toBe(1);
    expect(review.expiredCount).toBe(1);
    expect(review.notYetActiveCount).toBe(1);
    expect(review.noExpiryCount).toBe(1);
    expect(review.warnings.join("\n")).toContain("만료 30일 이내");
    expect(review.warnings.join("\n")).toContain("validUntil이 없는 공개키");
  });

  it("builds a retirement patch without deleting the audit history of the key", () => {
    const patch = JSON.parse(buildTrustedKeyRetirementPatch("partner-key-active", [key()], "2026-06-02T00:00:00.000Z")) as {
      keys: TrustedAuthorizedFeedKey[];
    };

    expect(patch.keys).toHaveLength(1);
    expect(patch.keys[0]?.keyId).toBe("partner-key-active");
    expect(patch.keys[0]?.validUntil).toBe("2026-06-02T00:00:00.000Z");
  });

  it("builds a rotation patch with a reviewed replacement key", async () => {
    const replacement = key({
      keyId: "partner-key-replacement",
      publicKeyJwk: { kty: "RSA", n: "public-modulus-replacement", e: "AQAB", use: "sig" },
      validFrom: "2026-06-02T00:00:00.000Z",
      validUntil: "2027-06-02T00:00:00.000Z",
    });
    const patch = JSON.parse(
      await buildTrustedKeyRotationPatch("partner-key-active", replacement, [key()], "2026-06-15T00:00:00.000Z", now),
    ) as { keys: TrustedAuthorizedFeedKey[] };

    expect(patch.keys.map((entry) => entry.keyId)).toEqual(["partner-key-active", "partner-key-replacement"]);
    expect(patch.keys.find((entry) => entry.keyId === "partner-key-active")?.validUntil).toBe("2026-06-15T00:00:00.000Z");
  });

  it("parses registry JSON and rejects impossible retirement times", () => {
    expect(parseTrustedKeyRegistryText(JSON.stringify({ version: "jium-authorized-feed-trusted-keys-v1", keys: [key()] }))).toHaveLength(1);
    expect(() => buildTrustedKeyRetirementPatch("partner-key-active", [key()], "2025-01-01T00:00:00.000Z")).toThrow("later than");
  });
});
