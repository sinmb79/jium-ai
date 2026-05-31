import { describe, expect, it } from "vitest";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  TRUSTED_KEY_REGISTRY_VERSION,
  loadTrustedAuthorizedFeedKeyRegistry,
  runTrustedAuthorizedFeedKeyCheck,
  validateTrustedAuthorizedFeedKeyRegistry,
} from "@/scripts/check-authorized-feed-keys.mjs";

describe("authorized feed trusted key registry check", () => {
  it("accepts the current registry scaffold", () => {
    const registry = loadTrustedAuthorizedFeedKeyRegistry();

    expect(registry.version).toBe(TRUSTED_KEY_REGISTRY_VERSION);
    expect(runTrustedAuthorizedFeedKeyCheck()).toEqual([]);
  });

  it("rejects accidental private JWK material and private key usages", () => {
    const errors = validateTrustedAuthorizedFeedKeyRegistry({
      version: TRUSTED_KEY_REGISTRY_VERSION,
      keys: [
        {
          keyId: "partner-key-001",
          issuerName: "Authorized Partner",
          algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
          publicKeyJwk: {
            kty: "RSA",
            n: "public-modulus",
            e: "AQAB",
            d: "private-exponent",
            key_ops: ["sign"],
          },
        },
      ],
    });

    expect(errors.join("\n")).toContain("private JWK field: d");
    expect(errors.join("\n")).toContain("private usage: sign");
  });

  it("rejects duplicate key ids and invalid validity windows", () => {
    const errors = validateTrustedAuthorizedFeedKeyRegistry({
      version: TRUSTED_KEY_REGISTRY_VERSION,
      keys: [
        {
          keyId: "partner-key-001",
          issuerName: "Authorized Partner",
          algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
          publicKeyJwk: { kty: "RSA", n: "public-modulus", e: "AQAB", use: "sig" },
          validFrom: "2026-06-01T00:00:00.000Z",
          validUntil: "2026-05-01T00:00:00.000Z",
        },
        {
          keyId: "partner-key-001",
          issuerName: "Authorized Partner",
          algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
          publicKeyJwk: { kty: "RSA", n: "public-modulus-2", e: "AQAB" },
        },
      ],
    });

    expect(errors.join("\n")).toContain("duplicates partner-key-001");
    expect(errors.join("\n")).toContain("validUntil must be later than validFrom");
  });
});
