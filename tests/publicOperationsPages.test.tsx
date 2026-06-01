import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import SupportPage from "@/app/support/page";

describe("public operations pages", () => {
  it("explains privacy boundaries for victims and operators", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: /개인정보와 사건자료 보호/ })).toBeInTheDocument();
    expect(screen.getByText(/피해자의 기기 안에서 먼저 정리/)).toBeInTheDocument();
    expect(screen.getByText(/원본 피해자료, 비밀방 초대 링크, 토큰, 연락처/)).toBeInTheDocument();
    expect(screen.getAllByText(/공식기관 제출/).length).toBeGreaterThan(0);
  });

  it("provides a support route without collecting case details on the public page", () => {
    render(<SupportPage />);

    expect(screen.getByRole("heading", { name: /지원 요청 경로/ })).toBeInTheDocument();
    expect(screen.getByText(/이 공개 페이지에는 피해 URL이나 개인정보를 입력하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/긴급 위험이 있으면 즉시 112 또는 공식 피해지원기관/)).toBeInTheDocument();
    expect(screen.getAllByText(/운영기관이 지정한 비공개 접수 채널/).length).toBeGreaterThan(0);
  });
});
