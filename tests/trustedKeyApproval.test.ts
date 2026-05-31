import { describe, expect, it } from "vitest";
import {
  buildTrustedKeyRegistryPatch,
  fingerprintTrustedAuthorizedFeedKey,
  reviewTrustedAuthorizedFeedKeyCandidate,
} from "@/lib/trustedKeyApproval";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";

const validKey: TrustedAuthorizedFeedKey = {
  keyId: "partner-key-2026-06",
  issuerName: "Authorized Partner",
  algorithm: "RSASSA-PKCS1-v1_5",
  publicKeyJwk: {
    kty: "RSA",
    n: "public-modulus-for-approval",
    e: "AQAB",
    use: "sig",
  },
  validFrom: "2026-06-01T00:00:00.000Z",
  validUntil: "2027-06-01T00:00:00.000Z",
};

describe("trusted key approval", () => {
  it("reviews a public key candidate and creates a registry patch", async () => {
    const review = await reviewTrustedAuthorizedFeedKeyCandidate(validKey, [], Date.parse("2026-05-31T00:00:00.000Z"));
    const patch = buildTrustedKeyRegistryPatch(validKey, []);

    expect(review.status).toBe("READY_FOR_APPROVAL");
    expect(review.fingerprint).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(review.checklist.join("\n")).toContain("security:server-readiness");
    expect(patch).toContain("partner-key-2026-06");
    expect(JSON.parse(patch).keys).toHaveLength(1);
  });

  it("produces a stable fingerprint for the approval record", async () => {
    await expect(fingerprintTrustedAuthorizedFeedKey(validKey)).resolves.toBe(await fingerprintTrustedAuthorizedFeedKey(validKey));
  });

  it("blocks duplicate key ids and private key material", async () => {
    const review = await reviewTrustedAuthorizedFeedKeyCandidate(
      {
        ...validKey,
        publicKeyJwk: {
          ...validKey.publicKeyJwk,
          d: "private-exponent",
          key_ops: ["sign"],
        },
      },
      [validKey],
      Date.parse("2026-05-31T00:00:00.000Z"),
    );

    expect(review.status).toBe("BLOCKED");
    expect(review.errors.join("\n")).toContain("already exists");
    expect(review.errors.join("\n")).toContain("private JWK field: d");
    expect(review.errors.join("\n")).toContain("private usage: sign");
  });

  it("requires a future validity window when present", async () => {
    const review = await reviewTrustedAuthorizedFeedKeyCandidate(
      {
        ...validKey,
        validUntil: "2026-01-01T00:00:00.000Z",
      },
      [],
      Date.parse("2026-05-31T00:00:00.000Z"),
    );

    expect(review.status).toBe("BLOCKED");
    expect(review.errors.join("\n")).toContain("validUntil must be in the future");
  });
});
