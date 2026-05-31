import { beforeEach, describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import { generateResponsePack } from "@/lib/responsePack";
import {
  buildAnonymizedLearningRecord,
  clearLearningRecords,
  loadLearningRecords,
  saveLearningRecord,
  summarizeLearningRecords,
  unsafeLearningRecordMarkers,
} from "@/lib/learningStore";
import type { CaseInput, SavedCase } from "@/lib/types";

const input: CaseInput = {
  situation: "디지털 성범죄 유포 추적",
  title: "비공개 서버 재유포 의심",
  description: "디스코드 서버와 암호화폐 결제 요구가 언급됐습니다.",
  targetUrl: "https://example.com/post/1",
  platform: "Example Forum",
  keywords: "alias-a",
  evidenceItems: [
    {
      id: "ev-learning",
      url: "https://example.com/post/1",
      platform: "Discord claim",
      location: "private server invite claim",
      posterId: "alias-a",
      foundAt: "2026-05-31T09:00",
      capturedByUser: true,
      status: "DISCOVERED",
      notes: "Discord private server and crypto wallet payment claim",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

function savedCase(): SavedCase {
  const classification = classifyCase(input);
  return {
    id: "case-learning",
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

describe("anonymized learning store", () => {
  beforeEach(() => {
    clearLearningRecords();
  });

  it("stores only pattern ids and aggregate counts", () => {
    const record = buildAnonymizedLearningRecord(savedCase());

    expect(record.routeSignalIds).toEqual(expect.arrayContaining(["route-discord-private-server", "route-crypto-payment-trade"]));
    expect(record.officialOnlyCount).toBeGreaterThan(0);
    expect(unsafeLearningRecordMarkers(record)).toEqual([]);

    saveLearningRecord(record);
    const summary = summarizeLearningRecords(loadLearningRecords());

    expect(summary.total).toBe(1);
    expect(summary.officialOnlyCount).toBeGreaterThan(0);
  });
});
