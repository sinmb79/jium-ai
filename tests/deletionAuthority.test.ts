import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { evaluateDeletionAuthority } from "@/lib/deletionAuthority";
import type { CaseInput } from "@/lib/types";

const baseInput: CaseInput = {
  situation: "사진/이미지를 직접 삭제 요청하고 싶어요",
  title: "무단 사진 게시",
  description: "제 사진이 허락 없이 커뮤니티에 올라갔어요.",
  targetUrl: "https://example.com/post/1",
  platform: "Example Board",
  keywords: "my-photo",
  exposedInfo: ["얼굴 사진"],
  urgent: false,
  helperMode: "self",
};

describe("evaluateDeletionAuthority", () => {
  it("본인 계정이나 관리자 권한이 확인될 때만 직접 삭제 실행을 허용한다", () => {
    const input: CaseInput = {
      ...baseInput,
      deletionAuthority: "OWN_ACCOUNT",
    };
    const assessment = evaluateDeletionAuthority(input, classifyCase(input));

    expect(assessment.decision).toBe("DIRECT_DELETE_ALLOWED");
    expect(assessment.directDeletionAllowed).toBe(true);
    expect(assessment.allowedActions.join(" ")).toContain("직접 삭제");
  });

  it("사진 속 당사자일 뿐이면 직접 삭제가 아니라 요청만 허용한다", () => {
    const input: CaseInput = {
      ...baseInput,
      deletionAuthority: "SUBJECT_ONLY",
    };
    const assessment = evaluateDeletionAuthority(input, classifyCase(input));

    expect(assessment.decision).toBe("REQUEST_ONLY");
    expect(assessment.directDeletionAllowed).toBe(false);
    expect(assessment.warning).toContain("내 사진");
    expect(assessment.blockedActions.join(" ")).toContain("직접 삭제 실행");
  });

  it("디지털 성범죄 사건은 권한 선택과 무관하게 전문기관 우선으로 둔다", () => {
    const input: CaseInput = {
      ...baseInput,
      description: "딥페이크 영상이 퍼졌고 유포 협박을 받고 있어요.",
      exposedInfo: ["성적 이미지/영상 관련"],
      urgent: true,
      deletionAuthority: "OWN_ACCOUNT",
    };
    const assessment = evaluateDeletionAuthority(input, classifyCase(input));

    expect(assessment.decision).toBe("SPECIALIST_FIRST");
    expect(assessment.directDeletionAllowed).toBe(false);
    expect(assessment.summary).toContain("전문기관");
  });
});
