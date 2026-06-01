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
import {
  SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION,
  authorizedOperatorCredentialSigningPayload,
  type SignedAuthorizedOperatorCredential,
  type SignedAuthorizedOperatorCredentialPayload,
} from "@/lib/authorizedOperatorCredential";
import type { AuthorizedFeedBundle } from "@/lib/authorizedIntelligenceFeed";
import type { InstitutionAccountSession } from "@/lib/institutionAuth";

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
      keyId: "authorized-partner-ui-key",
      issuerName: "Authorized NGO Partner",
      algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
      publicKeyJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
    },
  };
}

async function signBundle(privateKey: CryptoKey): Promise<SignedAuthorizedFeedBundle> {
  const envelope: SignedAuthorizedFeedPayload = {
    version: SIGNED_AUTHORIZED_FEED_VERSION,
    keyId: "authorized-partner-ui-key",
    signedAt: "2026-05-31T00:00:00.000Z",
    bundle,
  };
  const signature = await crypto.subtle.sign(
    { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
    privateKey,
    new TextEncoder().encode(authorizedFeedSigningPayload(envelope)),
  );

  return { ...envelope, signature: bytesToBase64Url(signature) };
}

async function signCredential(privateKey: CryptoKey): Promise<SignedAuthorizedOperatorCredential> {
  const envelope: SignedAuthorizedOperatorCredentialPayload = {
    version: SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION,
    keyId: "authorized-partner-ui-key",
    signedAt: "2026-05-31T00:00:01.000Z",
    credential: {
      credentialId: "cred-ui-operator-001",
      subjectId: "operator:ui-caseworker",
      issuerName: "Authorized NGO Partner",
      issuedAt: "2026-05-31T00:00:00.000Z",
      expiresAt: "2027-06-01T00:00:00.000Z",
      capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY", "AUTHORIZED_FEED_PURGE"],
      limitations: ["비식별 승인 피드 수입", "피해자 화면에는 집계만 표시"],
    },
  };
  const signature = await crypto.subtle.sign(
    { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
    privateKey,
    new TextEncoder().encode(authorizedOperatorCredentialSigningPayload(envelope)),
  );

  return { ...envelope, signature: bytesToBase64Url(signature) };
}

function institutionSession(): InstitutionAccountSession {
  return {
    sessionId: "srv-session-ui-001",
    organizationId: "org-authorized-ngo",
    organizationName: "Authorized NGO Partner",
    subjectId: "operator:ui-caseworker",
    role: "PLATFORM_TRUST_SAFETY",
    assuranceLevel: "SERVER_SESSION_MFA",
    issuedAt: "2026-05-31T00:00:00.000Z",
    authenticatedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    mfaVerifiedAt: new Date(Date.now() - 30_000).toISOString(),
    capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY", "AUTHORIZED_FEED_PURGE"],
    evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
    limitations: ["비식별 제한 피드 처리", "배정 사건의 비식별 제출자료 검토"],
  };
}

describe("AuthorizedFeedPanel", () => {
  beforeEach(() => {
    clearAuthorizedFeedIndicators();
  });

  it("imports restricted feed bundles only after a local operator session is opened", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signBundle(privateKey);

    render(<AuthorizedFeedPanel trustedFeedKeys={[trustedKey]} />);

    expect(screen.getByText("제한 지능 피드")).toBeInTheDocument();
    expect(screen.getByText("제한 지표 0건")).toBeInTheDocument();
    expect(screen.getByText("제한 피드 가져오기")).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("네트워크 없는 현장 확인용 긴 문장"), {
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

  it("opens a restricted feed session from a signed operator credential", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signBundle(privateKey);
    const credential = await signCredential(privateKey);

    render(<AuthorizedFeedPanel trustedFeedKeys={[trustedKey]} />);

    fireEvent.change(screen.getByPlaceholderText(/jium-authorized-operator-credential-signed-v1/), {
      target: { value: JSON.stringify(credential) },
    });
    fireEvent.click(screen.getByText("서명 credential 확인"));
    await waitFor(() => expect(screen.getByText(/Authorized NGO Partner credential 확인/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/jium-authorized-feed-signed-v1/), {
      target: { value: JSON.stringify(signed) },
    });
    fireEvent.click(screen.getByText("제한 피드 가져오기"));

    await waitFor(() => expect(screen.getByText("제한 지표 1건")).toBeInTheDocument());
  });

  it("accepts a server institution session as the restricted feed operator gate", async () => {
    const { privateKey, trustedKey } = await generateTrustedKey();
    const signed = await signBundle(privateKey);

    render(<AuthorizedFeedPanel trustedFeedKeys={[trustedKey]} institutionSession={institutionSession()} />);

    await waitFor(() => expect(screen.getByText(/Authorized NGO Partner 서버 세션/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/jium-authorized-feed-signed-v1/), {
      target: { value: JSON.stringify(signed) },
    });
    fireEvent.click(screen.getByText("제한 피드 가져오기"));

    await waitFor(() => expect(screen.getByText("제한 지표 1건")).toBeInTheDocument());
  });
});
