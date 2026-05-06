import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateResponsePack } from "@/lib/responsePack";
import type { CaseInput } from "@/lib/types";

const input: CaseInput = {
  situation: "긴급한 유포/협박 피해예요",
  title: "유포 협박",
  description: "딥페이크 영상이 퍼졌고 유포 협박을 받고 있어요.",
  targetUrl: "https://example.com/post/1",
  platform: "Example SNS",
  keywords: "suspect-id",
  exposedInfo: ["성적 이미지/영상 관련"],
  urgent: true,
  helperMode: "self",
};

describe("generateResponsePack", () => {
  it("공식 절차와 자동화 경계를 분리한다", () => {
    const pack = generateResponsePack(input, classifyCase(input));
    expect(pack.monitoringPlan.boundaries.join(" ")).toContain("자동 방문하지 않습니다");
    expect(pack.attributionGuidance.whatNotToDo.join(" ")).toContain("해킹");
    expect(pack.automationBoundary.requiresOfficialAuthority.join(" ")).toContain("신원 확인");
  });

  it("신고서와 형사 고소 상담자료를 생성한다", () => {
    const pack = generateResponsePack(input, classifyCase(input));
    expect(pack.legalSupport.policeReport.body).toContain("경찰청 사이버범죄 신고 준비서");
    expect(pack.legalSupport.criminalComplaintPrep.body).toContain("형사 고소 상담 준비자료");
  });

  it("법률·형사 지원 서비스를 공식 경로 우선으로 연계한다", () => {
    const pack = generateResponsePack(input, classifyCase(input));
    const ids = pack.serviceIntegrations.map((service) => service.id);
    expect(ids).toContain("d4u");
    expect(ids).toContain("ecrm");
    expect(ids).toContain("legal-aid");
    expect(pack.serviceIntegrations[0]?.kind).toBe("OFFICIAL");
    expect(pack.serviceIntegrations.find((service) => service.id === "lawtalk")?.cost).toBe("유료 가능");
  });

  it("범죄유형별 필요한 조치와 대응 매트릭스를 생성한다", () => {
    const pack = generateResponsePack(input, classifyCase(input));
    const patternNames = pack.preventionGuidance.patterns.map((pattern) => pattern.crimeType);
    expect(patternNames).toEqual(expect.arrayContaining(["유포협박·갈취", "합성·딥페이크 성착취"]));
    expect(pack.preventionGuidance.patterns.flatMap((pattern) => pattern.requiredMeasures).join(" ")).toContain("돈이나 추가 자료를 보내지 않기");
    expect(pack.preventionGuidance.survivorSupportProtocol.join(" ")).toContain("원본을 보여달라고 요구하지 않습니다");
  });

  it("n번방형·폐쇄형 사이트형 사례 교훈을 피해자 구제 중심으로 제공한다", () => {
    const pack = generateResponsePack(input, classifyCase(input));
    const titles = pack.preventionGuidance.caseStudyLessons.map((lesson) => lesson.title);
    expect(titles).toEqual(expect.arrayContaining(["n번방·박사방형 조직적 성착취", "놀쟈.com류 폐쇄형 불법촬영물 유통 사이트"]));
    expect(pack.preventionGuidance.caseStudyLessons.flatMap((lesson) => lesson.doNotDo).join(" ")).toContain("초대코드 요청·공유");
    expect(pack.preventionGuidance.caseStudyLessons.flatMap((lesson) => lesson.rescueActions).join(" ")).toContain("1377");
  });
});
