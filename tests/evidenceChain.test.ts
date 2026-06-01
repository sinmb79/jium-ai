import { describe, expect, it } from "vitest";
import { buildEvidenceChain, evidenceChainToMarkdown } from "@/lib/evidenceChain";
import type { CaseInput } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "증거 체인 테스트",
  description: "공개 글과 비공개방 유도 단서가 있습니다.",
  targetUrl: "https://example.com/post/chain",
  platform: "Example Forum",
  keywords: "alias",
  evidenceItems: [
    {
      id: "ev-chain",
      url: "https://example.com/post/chain",
      platform: "Example Forum",
      location: "게시판",
      posterId: "alias",
      foundAt: "2026-05-31T09:00:00.000Z",
      capturedAt: "2026-05-31T09:05:00.000Z",
      captureMethod: "USER_SCREENSHOT",
      collectorRef: "support-worker-ref-01",
      deviceRef: "trusted-device-ref-01",
      capturedByUser: true,
      evidenceHash: "sha256-placeholder",
      hashAlgorithm: "SHA-256",
      verifiedAt: "2026-05-31T09:08:00.000Z",
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      handoffRecipientRef: "agency-intake-ref-01",
      status: "DISCOVERED",
      requestLogs: [
        {
          id: "req-chain",
          target: "플랫폼 신고함",
          requestedAt: "2026-05-31T10:00:00.000Z",
          status: "SENT",
          receiptId: "R-CHAIN",
        },
      ],
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

describe("evidence chain", () => {
  it("builds a deterministic manifest and handoff timeline", () => {
    const chain = buildEvidenceChain(input, "2026-05-31T11:00:00.000Z");
    const markdown = evidenceChainToMarkdown(chain);

    expect(chain.manifestFingerprint).toMatch(/^JIUM-CHAIN-[0-9A-F]{8}$/);
    expect(chain.events.map((event) => event.action)).toEqual(["OBSERVED", "CAPTURED", "REQUESTED", "PACKET_CREATED"]);
    expect(chain.missingForOperationalUse).toEqual([]);
    expect(markdown).toContain("증거 체인");
    expect(markdown).toContain("R-CHAIN");
  });

  it("adds custody metadata to chain events while redacting unsafe custody refs", () => {
    const custodyInput: CaseInput = {
      ...input,
      evidenceItems: [
        {
          ...input.evidenceItems![0],
          collectorRef: "support-worker-ref-01",
          deviceRef: "trusted-device-ref-01",
          hashAlgorithm: "SHA-256",
          verifiedAt: "2026-05-31T09:08:00.000Z",
          handoffRecipientRef: "agency-intake-ref-01",
        },
      ],
    };

    const chain = buildEvidenceChain(custodyInput, "2026-05-31T11:00:00.000Z");
    const captured = chain.events.find((event) => event.id === "chain-ev-chain-captured");

    expect(captured?.custody).toMatchObject({
      collectorRef: "support-worker-ref-01",
      deviceRef: "trusted-device-ref-01",
      captureMethod: "USER_SCREENSHOT",
      hashAlgorithm: "SHA-256",
      verifiedAt: "2026-05-31T09:08:00.000Z",
      handoffRecipientRef: "agency-intake-ref-01",
    });
    expect(chain.missingForOperationalUse).toEqual([]);
    expect(chain.custodyWarnings).toEqual([]);

    const unsafeInput: CaseInput = {
      ...input,
      evidenceItems: [
        {
          ...input.evidenceItems![0],
          collectorRef: "010-1234-5678",
          deviceRef: "https://example.com/device",
          handoffRecipientRef: "victim@example.com",
        },
      ],
    };

    const unsafeChain = buildEvidenceChain(unsafeInput, "2026-05-31T11:00:00.000Z");
    const serialized = JSON.stringify(unsafeChain);

    expect(unsafeChain.custodyWarnings).toEqual(expect.arrayContaining(["custody refs must be pseudonymous and cannot contain raw contact or URL values"]));
    expect(serialized).not.toContain("010-1234-5678");
    expect(serialized).not.toContain("https://example.com/device");
    expect(serialized).not.toContain("victim@example.com");
  });
});
