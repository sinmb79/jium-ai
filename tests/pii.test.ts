import { describe, expect, it } from "vitest";
import { canStoreSafely, detectSensitiveInput, maskSensitiveText } from "@/lib/pii";

describe("pii guards", () => {
  it("주민등록번호와 비밀번호 원문을 저장 차단 대상으로 감지한다", () => {
    const findings = detectSensitiveInput("주민번호 900101-1234567 비밀번호는 abcd1234");
    expect(findings.some((finding) => finding.type === "residentRegistrationNumber")).toBe(true);
    expect(findings.some((finding) => finding.type === "passwordSecret")).toBe(true);
    expect(canStoreSafely("주민번호 900101-1234567")).toBe(false);
  });

  it("AI 전송 전 민감정보를 마스킹한다", () => {
    const masked = maskSensitiveText("전화번호는 010-1234-5678, 이메일은 test@example.com 입니다.");
    expect(masked).toContain("[전화번호 가림]");
    expect(masked).toContain("[이메일 가림]");
  });
});
