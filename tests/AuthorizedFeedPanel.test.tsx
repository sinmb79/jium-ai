import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizedFeedPanel } from "@/components/AuthorizedFeedPanel";
import { clearAuthorizedFeedIndicators } from "@/lib/authorizedIntelligenceFeed";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  SIGNED_AUTHORIZED_FEED_VERSION,
  authorizedFeedSigningPayload,
  bytesToBase64Url,
  type SignedAuthorizedFeedBundle,
  type SignedAuthorizedFeedPayload,
  type TrustedAuthorizedFeedKey,
} from "@/lib/authorizedFeedSignature";
import type { AuthorizedFeedBundle } from "@/lib/authorizedIntelligenceFeed";

const digest = "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const bundle: AuthorizedFeedBundle = {
  version: "jium-authorized-feed-v1",
  generatedAt: "2026-05-31T00:00:00.000Z",
  sourceName: "Authorized NGO Partner",
  sourceType: "AUTHORIZED_PARTNER_FEED",
  authorizationRef: "MOU-2026-05-PARTNER",
  indicators: [
    {
      id: "partner-feed-001",
      kind: "ROUTE_PATTERN",
      label: "비공개방 유도 반복 패턴",
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
    },
  ],
};

async function signBundle(): Promise<{ signed: SignedAuthorizedFeedBundle; trustedKey: TrustedAuthorizedFeedKey }> {
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
  const envelope: SignedAuthorizedFeedPayload = {
    version: SIGNED_AUTHORIZED_FEED_VERSION,
    keyId: "authorized-partner-ui-key",
    signedAt: "2026-05-31T00:00:00.000Z",
    bundle,
  };
  const signature = await crypto.subtle.sign(
    { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
    pair.privateKey,
    new TextEncoder().encode(authorizedFeedSigningPayload(envelope)),
  );

  return {
    signed: { ...envelope, signature: bytesToBase64Url(signature) },
    trustedKey: {
      keyId: envelope.keyId,
      issuerName: "Authorized NGO Partner",
      algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      publicKeyJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
    },
  };
}

describe("AuthorizedFeedPanel", () => {
  beforeEach(() => {
    clearAuthorizedFeedIndicators();
  });

  it("imports restricted feed bundles only after a local operator session is opened", async () => {
    const { signed, trustedKey } = await signBundle();

    render(<AuthorizedFeedPanel trustedFeedKeys={[trustedKey]} />);

    expect(screen.getByText("제한 지능 피드")).toBeInTheDocument();
    expect(screen.getByText("제한 지표 0건")).toBeInTheDocument();
    expect(screen.getByText("제한 피드 가져오기")).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("승인 피드 담당자 확인용 긴 문장"), {
      target: { value: "authorized feed passphrase" },
    });
    fireEvent.click(screen.getByText("운영자 세션 열기"));
    fireEvent.change(screen.getByPlaceholderText(/jium-authorized-feed-signed-v1/), {
      target: { value: JSON.stringify(signed) },
    });
    fireEvent.click(screen.getByText("제한 피드 가져오기"));

    await waitFor(() => expect(screen.getByText("제한 지표 1건")).toBeInTheDocument());
    expect(screen.getByText("encrypted-private-room: 1건")).toBeInTheDocument();
    expect(screen.getByText("platform-migration-signal: 1건")).toBeInTheDocument();
    expect(screen.queryByText("비공개방 유도 반복 패턴")).not.toBeInTheDocument();
  });
});
