import { describe, expect, it } from "vitest";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  SIGNED_AUTHORIZED_FEED_VERSION,
  authorizedFeedSigningPayload,
  bytesToBase64Url,
  canonicalizeJson,
  importSignedAuthorizedFeedBundleForOperator,
  verifyAuthorizedFeedSignature,
  type SignedAuthorizedFeedBundle,
  type SignedAuthorizedFeedPayload,
  type TrustedAuthorizedFeedKey,
} from "@/lib/authorizedFeedSignature";
import type { AuthorizedFeedBundle, AuthorizedFeedIndicator } from "@/lib/authorizedIntelligenceFeed";
import { openAuthorizedFeedOperatorSession } from "@/lib/authorizedFeedAccess";

const digest = "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const keyId = "authorized-partner-key-2026-05";

function unsignedBundle(): AuthorizedFeedBundle {
  const indicator: Omit<AuthorizedFeedIndicator, "auditLog" | "sourceName" | "sourceType"> = {
    id: "signed-feed-001",
    kind: "ROUTE_PATTERN",
    label: "폐쇄형 채널 유도 반복 패턴",
    publicSummary: "공개 표면에서 폐쇄형 채널 이동과 결제 요구가 함께 나타난 비식별 지표",
    sourceDate: "2026-05-01T00:00:00.000Z",
    lastCheckedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
    accessLevel: "AUTHORIZED_INTEL_ONLY",
    confidence: "HIGH",
    riskLevel: "CRITICAL",
    routePatternId: "encrypted-private-room",
    promotionSurfaceId: "platform-migration-signal",
    indicatorDigest: digest,
    signalTags: ["private-room", "payment", "handoff"],
    allowedUses: ["피해자 사건 증거목록과 비식별 매칭", "공식기관 제출 우선순위 판단"],
    prohibitedUses: ["공개 목록 게시", "비공개방 잠입", "초대 요청", "구매 또는 다운로드"],
    officialHandoff: ["중앙디지털성범죄피해자지원센터", "경찰 ECRM"],
  };

  return {
    version: "jium-authorized-feed-v1",
    generatedAt: "2026-05-31T00:00:00.000Z",
    sourceName: "Authorized NGO Partner",
    sourceType: "AUTHORIZED_PARTNER_FEED",
    authorizationRef: "MOU-2026-05-PARTNER",
    indicators: [indicator],
  };
}

async function generateTrustedKey(): Promise<{ privateKey: CryptoKey; trustedKey: TrustedAuthorizedFeedKey }> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  return {
    privateKey: pair.privateKey,
    trustedKey: {
      keyId,
      issuerName: "Authorized NGO Partner",
      algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      publicKeyJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2027-01-01T00:00:00.000Z",
    },
  };
}

async function signBundle(bundle: AuthorizedFeedBundle, privateKey: CryptoKey): Promise<SignedAuthorizedFeedBundle> {
  const envelope: SignedAuthorizedFeedPayload = {
    version: SIGNED_AUTHORIZED_FEED_VERSION,
    keyId,
    signedAt: "2026-05-31T00:00:00.000Z",
    bundle,
  };
  const signature = await crypto.subtle.sign(
    { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
    privateKey,
    new TextEncoder().encode(authorizedFeedSigningPayload(envelope)),
  );

  return {
    ...envelope,
    signature: bytesToBase64Url(signature),
  };
}

describe("authorized feed signature verification", () => {
  it("verifies a signed feed and imports it only through an operator session", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signBundle(unsignedBundle(), privateKey);
    const now = Date.parse("2026-05-31T01:00:00.000Z");
    const verification = await verifyAuthorizedFeedSignature(signed, [trustedKey], now);

    expect(verification).toEqual({ valid: true, errors: [] });
    await expect(importSignedAuthorizedFeedBundleForOperator(signed, [trustedKey], null, [], "2026-05-31T01:00:00.000Z", now)).rejects.toThrow("operator session");

    const session = openAuthorizedFeedOperatorSession("authorized feed passphrase", now);
    const imported = await importSignedAuthorizedFeedBundleForOperator(signed, [trustedKey], session, [], "2026-05-31T01:00:00.000Z", now + 1);

    expect(imported).toHaveLength(1);
    expect(imported[0]?.id).toBe("signed-feed-001");
    expect(imported[0]?.auditLog[0]?.action).toBe("IMPORTED");
  });

  it("rejects a tampered bundle after signature creation", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signBundle(unsignedBundle(), privateKey);
    const tampered: SignedAuthorizedFeedBundle = {
      ...signed,
      bundle: {
        ...signed.bundle,
        sourceName: "Tampered Partner",
      },
    };

    const verification = await verifyAuthorizedFeedSignature(tampered, [trustedKey], Date.parse("2026-05-31T01:00:00.000Z"));

    expect(verification.valid).toBe(false);
    expect(verification.errors.join("\n")).toContain("signature verification failed");
  });

  it("rejects unknown or inactive signing keys", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signBundle(unsignedBundle(), privateKey);

    const unknown = await verifyAuthorizedFeedSignature(signed, [], Date.parse("2026-05-31T01:00:00.000Z"));
    const expired = await verifyAuthorizedFeedSignature(
      signed,
      [{ ...trustedKey, validUntil: "2026-01-01T00:00:00.000Z" }],
      Date.parse("2026-05-31T01:00:00.000Z"),
    );

    expect(unknown.valid).toBe(false);
    expect(unknown.errors.join("\n")).toContain("unknown or inactive");
    expect(expired.valid).toBe(false);
    expect(expired.errors.join("\n")).toContain("unknown or inactive");
  });

  it("uses stable canonical JSON and rejects ambiguous values", () => {
    expect(canonicalizeJson({ b: 1, a: { d: 4, c: [2, 3] } })).toBe('{"a":{"c":[2,3],"d":4},"b":1}');
    expect(() => canonicalizeJson({ a: undefined })).toThrow("Undefined value");
    expect(() => canonicalizeJson(Number.NaN)).toThrow("Non-finite numbers");
  });
});
