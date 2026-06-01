import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceSafetyPanel } from "@/components/DeviceSafetyPanel";

describe("DeviceSafetyPanel", () => {
  it("starts blocked and becomes ready after all checks are confirmed", () => {
    render(<DeviceSafetyPanel />);

    expect(screen.getByText("기기·브라우저 안전 확인")).toBeInTheDocument();
    expect(screen.getByText("중지 권장")).toBeInTheDocument();

    fireEvent.click(screen.getByText("모두 확인"));

    expect(screen.getByText("진행 가능")).toBeInTheDocument();
    expect(screen.getByText(/필수 4\/4/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("초기화"));
    expect(screen.getByText("중지 권장")).toBeInTheDocument();
  });

  it("renders compact guidance without hiding required labels", () => {
    const { container } = render(<DeviceSafetyPanel compact />);

    expect(screen.getByLabelText(/본인만 쓰는 기기/)).toBeInTheDocument();
    expect(screen.getAllByText("필수").length).toBeGreaterThan(0);
    expect(container.querySelector(".device-safety-check em")).not.toBeInTheDocument();
  });
});
