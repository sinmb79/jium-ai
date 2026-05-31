import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import { buildEvidenceChainManifest, buildPrintableSubmissionHtml, buildSubmissionPackageFiles, buildSubmissionPackageZip } from "@/lib/submissionPackage";
import { buildSubmissionPacket } from "@/lib/submissionPacket";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "제출 패키지 테스트",
  description: "공개 글에서 비공개방 유도와 결제 요구가 보였습니다.",
  targetUrl: "https://example.com/post/package",
  platform: "Example Forum",
  keywords: "alias telegram paid",
  evidenceItems: [
    {
      id: "ev-package",
      url: "https://example.com/post/package",
      platform: "Example Forum",
      location: "게시판",
      posterId: "alias",
      foundAt: "2026-05-31T09:00:00.000Z",
      capturedAt: "2026-05-31T09:05:00.000Z",
      captureMethod: "USER_SCREENSHOT",
      capturedByUser: true,
      evidenceHash: "sha256-placeholder",
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-package",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
    storageMode: "LOCAL_FIRST",
    input,
    redactedPreview: "",
    classification,
    draft: generateRequestDraft(input, classification),
    responsePack: generateResponsePack(input, classification),
    status: "READY",
    notes: [],
  };
}

describe("submission package", () => {
  it("builds printable HTML and manifest JSON for agency handoff", () => {
    const item = savedCase();
    const packet = buildSubmissionPacket(item.input, item.classification, item.responsePack, "2026-05-31T10:00:00.000Z");
    const manifest = buildEvidenceChainManifest(item, packet);
    const html = buildPrintableSubmissionHtml(item, packet);

    expect(manifest.packageVersion).toBe("1.0.0");
    expect(manifest.chain.manifestFingerprint).toMatch(/^JIUM-CHAIN-/);
    expect(html).toContain("지움AI 제출용 인쇄본");
    expect(html).toContain(packet.evidenceChain.manifestFingerprint);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick=");
  });

  it("builds a zip package with the expected handoff files", () => {
    const item = savedCase();
    const files = buildSubmissionPackageFiles(item);
    const zip = buildSubmissionPackageZip(item, new Date("2026-05-31T00:00:00.000Z"));
    const zipText = new TextDecoder().decode(zip);

    expect(files.map((file) => file.name)).toEqual(
      expect.arrayContaining([
        "00-README.txt",
        expect.stringContaining("submission-packet.md"),
        expect.stringContaining("printable-submission.html"),
        expect.stringContaining("officer-readonly.html"),
        expect.stringContaining("evidence-chain-manifest.json"),
        expect.stringContaining("submission-version-snapshot.json"),
        expect.stringContaining("trace-diagram.mmd"),
        expect.stringContaining("checklist.txt"),
      ]),
    );
    expect(zipText).toContain("evidence-chain-manifest.json");
    expect(zipText).toContain("submission-version-snapshot.json");
    expect(zipText).toContain("submission-packet.md");
  });
});
