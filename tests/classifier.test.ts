import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";

describe("classifyCase", () => {
  it("전화번호 노출은 개인정보 노출로 분류한다", () => {
    const result = classifyCase("내 전화번호가 커뮤니티에 올라갔어요");
    expect(result.caseType).toBe("PERSONAL_INFO_EXPOSURE");
    expect(result.riskLevel).toBe("HIGH");
    expect(result.deletionChance).toBe("HIGH");
  });

  it("무단 사진과 이미지는 직접 삭제 요청 가능한 개인정보 노출로 분류한다", () => {
    const result = classifyCase("제 사진과 프로필 이미지가 허락 없이 게시됐어요");
    expect(result.caseType).toBe("PERSONAL_INFO_EXPOSURE");
    expect(result.deletionChance).toBe("HIGH");
  });

  it("딥페이크 사건은 외부 AI보다 전문기관 라우팅을 우선한다", () => {
    const result = classifyCase("제 딥페이크 영상이 퍼졌고 유포 협박을 받고 있어요");
    expect(result.caseType).toBe("DIGITAL_SEX_CRIME");
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.deletionChance).toBe("SPECIALIST_REQUIRED");
    expect(result.specialistFirst).toBe(true);
    expect(result.safetyNote).toContain("원본");
  });

  it("그루밍과 몸캠피싱 표현도 디지털 성범죄 긴급 경로로 분류한다", () => {
    expect(classifyCase("온라인 그루밍으로 미성년자에게 비밀 대화를 요구했어요").caseType).toBe("DIGITAL_SEX_CRIME");
    expect(classifyCase("몸캠피싱 협박을 받고 있어요").specialistFirst).toBe(true);
  });

  it("n번방형·폐쇄형 사이트형 단서를 디지털 성범죄로 분류한다", () => {
    expect(classifyCase("n번방 같은 단체방 유포 협박을 받았어요").caseType).toBe("DIGITAL_SEX_CRIME");
    expect(classifyCase("놀쟈 초대코드와 불법 촬영물 사이트 링크가 공유됐어요").specialistFirst).toBe(true);
  });

  it("계정 유출은 비밀번호 입력 금지를 안내한다", () => {
    const result = classifyCase("비밀번호가 다크웹에 유출된 것 같아요");
    expect(result.caseType).toBe("CREDENTIAL_LEAK");
    expect(result.safetyNote).toContain("비밀번호");
  });
});
