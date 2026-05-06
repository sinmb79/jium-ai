import { describe, expect, it } from "vitest";
import { classifyCase } from "@/lib/classifier";
import { generateRequestDraft } from "@/lib/requestTemplates";
import type { CaseInput } from "@/lib/types";

const baseInput: CaseInput = {
  situation: "개인정보가 노출됐어요",
  title: "커뮤니티 전화번호 노출",
  description: "제 개인정보가 노출되었습니다.",
  targetUrl: "https://example.com/post/1",
  platform: "Example",
  keywords: "홍길동 전화번호",
  exposedInfo: ["이름", "전화번호"],
  urgent: false,
  helperMode: "self",
};

describe("generateRequestDraft", () => {
  it("URL과 노출정보를 포함한 플랫폼 요청서를 만든다", () => {
    const classification = classifyCase(baseInput);
    const draft = generateRequestDraft(baseInput, classification);
    expect(draft.body).toContain("https://example.com/post/1");
    expect(draft.body).toContain("이름, 전화번호");
    expect(draft.body).toContain("삭제 또는 비공개");
  });

  it("디지털 성범죄 사건에는 업로드 금지 문구를 포함한다", () => {
    const input = {
      ...baseInput,
      description: "딥페이크 영상이 퍼졌어요",
      evidenceItems: [
        {
          id: "evidence-digital-1",
          url: "https://example.com/leak/1",
          platform: "Example",
          location: "피해 게시판",
          posterId: "poster",
          foundAt: "2026-05-06T13:30",
          capturedByUser: false,
          submissionTarget: "중앙디지털성범죄피해자지원센터",
          status: "DISCOVERED" as const,
          notes: "",
        },
      ],
      exposedInfo: ["성적 이미지/영상 관련"],
    };
    const draft = generateRequestDraft(input, classifyCase(input));
    expect(draft.body).toContain("업로드하지 않습니다");
    expect(draft.body).toContain("접근경로 증거목록");
    expect(draft.body).toContain("https://example.com/leak/1");
    expect(draft.recipientType).toBe("PUBLIC_AGENCY");
  });
});
