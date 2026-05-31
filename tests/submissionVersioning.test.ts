import { beforeEach, describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import { buildSubmissionPacket } from "@/lib/submissionPacket";
import {
  buildSubmissionPacketSnapshot,
  clearSubmissionPacketSnapshots,
  compareSubmissionPacketSnapshots,
  latestSubmissionPacketSnapshot,
  saveSubmissionPacketSnapshot,
  submissionPacketDiffToMarkdown,
  submissionSnapshotStorageKey,
} from "@/lib/submissionVersioning";
import type { CaseInput, SavedCase } from "@/lib/types";

const baseInput: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "버전 비교 테스트",
  description: "공개 글에서 비공개방 유도와 결제 요구가 보였습니다.",
  targetUrl: "https://example.com/private/version?secret=true",
  platform: "Example Forum",
  keywords: "alias telegram paid",
  evidenceItems: [
    {
      id: "ev-version",
      url: "https://example.com/private/version?secret=true",
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

function savedCase(input: CaseInput = baseInput): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-version",
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

describe("submission versioning", () => {
  beforeEach(() => {
    clearSubmissionPacketSnapshots();
  });

  it("builds a privacy-minimized snapshot and stores it locally", () => {
    const item = savedCase();
    const packet = buildSubmissionPacket(item.input, item.classification, item.responsePack, "2026-05-31T10:00:00.000Z");
    const snapshot = buildSubmissionPacketSnapshot(item, packet, "2026-05-31T10:01:00.000Z");

    expect(snapshot.packetFingerprint).toMatch(/^JIUM-PACKET-[0-9A-F]{8}$/);
    expect(JSON.stringify(snapshot)).not.toContain("/private/version");
    expect(JSON.stringify(snapshot)).not.toContain("secret=true");

    saveSubmissionPacketSnapshot(snapshot);

    expect(window.localStorage.getItem(submissionSnapshotStorageKey())).toContain(snapshot.packetFingerprint);
    expect(latestSubmissionPacketSnapshot(item.id)?.packetFingerprint).toBe(snapshot.packetFingerprint);
  });

  it("compares the latest stored version with a changed packet", () => {
    const first = savedCase();
    const firstPacket = buildSubmissionPacket(first.input, first.classification, first.responsePack, "2026-05-31T10:00:00.000Z");
    saveSubmissionPacketSnapshot(buildSubmissionPacketSnapshot(first, firstPacket, "2026-05-31T10:01:00.000Z"));

    const changedInput: CaseInput = {
      ...baseInput,
      evidenceItems: [
        ...(baseInput.evidenceItems || []),
        {
          id: "ev-version-2",
          url: "https://example.com/private/version-2",
          platform: "Example Mirror",
          foundAt: "2026-05-31T11:00:00.000Z",
          capturedAt: "2026-05-31T11:05:00.000Z",
          captureMethod: "SEARCH_RESULT",
          capturedByUser: true,
          evidenceHash: "sha256-second",
          submissionTarget: "경찰청 ECRM",
          status: "DISCOVERED",
        },
      ],
    };
    const second = savedCase(changedInput);
    const secondPacket = buildSubmissionPacket(second.input, second.classification, second.responsePack, "2026-05-31T11:10:00.000Z");
    const diff = compareSubmissionPacketSnapshots(latestSubmissionPacketSnapshot(second.id)!, buildSubmissionPacketSnapshot(second, secondPacket, "2026-05-31T11:11:00.000Z"));
    const markdown = submissionPacketDiffToMarkdown(diff);

    expect(diff.status).toBe("CHANGED");
    expect(diff.changes.some((change) => change.field === "evidenceCount")).toBe(true);
    expect(markdown).toContain("제출 패킷 버전 비교");
    expect(markdown).toContain("변경 있음");
  });
});
