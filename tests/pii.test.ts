import { describe, expect, it } from "vitest";
import { redactCaseInput } from "@/lib/ai/redaction";
import { canStoreSafely, detectSensitiveInput, hasBlockingSensitiveInput, maskSensitiveText } from "@/lib/pii";
import type { CaseInput } from "@/lib/types";

describe("pii guards", () => {
  it("주민등록번호와 비밀번호 원문을 저장 차단 대상으로 감지한다", () => {
    const findings = detectSensitiveInput("주민번호 900101-1234567 비밀번호는 abcd1234");
    expect(findings.some((finding) => finding.type === "residentRegistrationNumber")).toBe(true);
    expect(findings.some((finding) => finding.type === "passwordSecret")).toBe(true);
    expect(canStoreSafely("주민번호 900101-1234567")).toBe(false);
    expect(hasBlockingSensitiveInput("카드번호 4111 1111 1111 1111")).toBe(true);
  });

  it("AI 전송 전 민감정보를 마스킹한다", () => {
    const masked = maskSensitiveText("전화번호는 010-1234-5678, 이메일은 test@example.com 입니다.");
    expect(masked).toContain("[전화번호 가림]");
    expect(masked).toContain("[이메일 가림]");
  });

  it("외부 AI용 입력은 제목과 플랫폼까지 마스킹하고 차단 상태를 표시한다", () => {
    const input: CaseInput = {
      situation: "계정 유출",
      title: "비밀번호는 abcd1234",
      description: "주민번호 900101-1234567이 함께 적혀 있어요.",
      targetUrl: "https://example.com/post",
      platform: "연락처 010-1234-5678",
      keywords: "test@example.com",
      exposedInfo: ["카드번호 4111 1111 1111 1111"],
      urgent: false,
      helperMode: "self",
    };

    const redacted = redactCaseInput(input);

    expect(redacted.blocked).toBe(true);
    expect(redacted.originalIntent.title).toBe("[비밀번호 가림]");
    expect(redacted.originalIntent.description).toContain("[주민등록번호 가림]");
    expect(redacted.originalIntent.platform).toContain("[전화번호 가림]");
    expect(redacted.originalIntent.keywords).toContain("[이메일 가림]");
    expect(redacted.originalIntent.exposedInfo.join(" ")).toContain("[카드번호 가림]");
  });
});
