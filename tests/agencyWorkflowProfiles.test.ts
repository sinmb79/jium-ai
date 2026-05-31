import { describe, expect, it } from "vitest";
import { buildAgencyWorkflowPlan, buildAgencyWorkflowReadiness, agencyWorkflowPlanToMarkdown, AGENCY_WORKFLOW_PROFILES } from "@/lib/agencyWorkflowProfiles";
import { classifyCase } from "@/lib/classifier";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput } from "@/lib/types";

const digitalSexCrimeInput: CaseInput = {
  situation: "디지털 성범죄 피해",
  title: "비공개방 유도 게시글 신고 준비",
  description: "딥페이크 이미지가 공개 게시판에 올라왔고 유포 협박과 결제 요구가 있었습니다.",
  targetUrl: "https://example.com/post/agency",
  platform: "Example Forum",
  keywords: "alias telegram paid",
  evidenceItems: [
    {
      id: "ev-agency-1",
      url: "https://example.com/post/agency",
      platform: "Example Forum",
      location: "게시판",
      posterId: "alias",
      foundAt: "2026-05-31T09:00:00.000Z",
      capturedAt: "2026-05-31T09:05:00.000Z",
      captureMethod: "USER_SCREENSHOT",
      capturedByUser: true,
      evidenceHash: "sha256-agency-placeholder",
      submissionTarget: "중앙디지털성범죄피해자지원센터",
      status: "DISCOVERED",
      notes: "초대 링크 문구와 결제 요구가 있었음",
    },
  ],
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

describe("agency workflow profiles", () => {
  it("digital sex crime cases prioritize victim support, police, and content review routes", () => {
    const classification = classifyCase(digitalSexCrimeInput);
    const responsePack = generateResponsePack(digitalSexCrimeInput, classification);
    const plan = buildAgencyWorkflowPlan(digitalSexCrimeInput, classification, responsePack, "2026-05-31T00:00:00.000Z");
    const ids = plan.recommendations.map((item) => item.profile.id);

    expect(ids).toEqual(expect.arrayContaining(["d4u", "ecrm", "kcsc", "online365"]));
    expect(plan.recommendations[0].profile.id).toBe("d4u");
    expect(plan.recommendations[0].readiness.score).toBeGreaterThanOrEqual(75);
  });

  it("privacy exposure cases include KISA and flag missing evidence fields", () => {
    const input: CaseInput = {
      ...digitalSexCrimeInput,
      situation: "개인정보 유출",
      title: "전화번호와 주소 노출",
      description: "커뮤니티 글에 전화번호와 주소가 노출됐습니다.",
      exposedInfo: ["전화번호", "주소"],
      urgent: false,
      evidenceItems: [
        {
          id: "ev-privacy-1",
          url: "",
          platform: "Example Community",
          capturedByUser: false,
          captureMethod: "UNKNOWN",
          status: "DISCOVERED",
        },
      ],
    };
    const classification = classifyCase(input);
    const responsePack = generateResponsePack(input, classification);
    const plan = buildAgencyWorkflowPlan(input, classification, responsePack, "2026-05-31T00:00:00.000Z");
    const kisa = plan.recommendations.find((item) => item.profile.id === "privacy-kisa");

    expect(kisa).toBeTruthy();
    expect(kisa?.readiness.missingItems.map((item) => item.id)).toEqual(expect.arrayContaining(["found-at", "captured-at", "capture-method"]));
  });

  it("renders a safe markdown checklist without tactical restricted-space guidance", () => {
    const classification = classifyCase(digitalSexCrimeInput);
    const profile = AGENCY_WORKFLOW_PROFILES.find((item) => item.id === "d4u");

    expect(profile).toBeTruthy();
    const readiness = buildAgencyWorkflowReadiness(digitalSexCrimeInput, profile!);
    const markdown = agencyWorkflowPlanToMarkdown({
      generatedAt: "2026-05-31T00:00:00.000Z",
      summary: "테스트",
      recommendations: [
        {
          profile: profile!,
          readiness,
          whyThisAgency: "테스트",
        },
      ],
      safetyBoundary: ["자동 제출하지 않습니다."],
    });

    expect(classification.caseType).toBe("DIGITAL_SEX_CRIME");
    expect(markdown).toContain("기관별 제출 워크플로");
    expect(markdown).toContain("피해물 원본");
    expect(markdown).not.toContain("직접 잠입");
    expect(markdown).not.toContain("초대 링크 수집");
  });
});
