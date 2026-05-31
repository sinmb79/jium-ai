import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegionalSupportRouterPanel } from "@/components/RegionalSupportRouterPanel";

describe("RegionalSupportRouterPanel", () => {
  it("shows central routes by default and selects a regional center", () => {
    render(<RegionalSupportRouterPanel caseType="DIGITAL_SEX_CRIME" urgent />);

    expect(screen.getByText("지역 피해지원 라우팅")).toBeInTheDocument();
    expect(screen.getByText(/D4U 02-735-8994/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/지역 선택/), { target: { value: "SEOUL" } });

    expect(screen.getByText("서울디지털성범죄피해자지원센터")).toBeInTheDocument();
    expect(screen.getByText(/112 또는 1366/)).toBeInTheDocument();
  });
});
