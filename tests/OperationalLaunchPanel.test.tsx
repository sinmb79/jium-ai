import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperationalLaunchPanel } from "@/components/OperationalLaunchPanel";

function validConsoleJson() {
  return JSON.stringify({
    schema: "jium-operational-launch-console-v1",
    status: "EXTERNAL_INPUTS_REQUIRED",
    source: { version: "0.3.104" },
    launchDecision: { canLaunchNow: false },
    summary: {
      phaseCount: 1,
      readyPhaseCount: 0,
      blockedPhaseCount: 1,
      openActionCount: 2,
      p0OpenActionCount: 1,
      externalApprovalCommandCount: 1,
      verificationCommandCount: 1,
    },
    ownerLanes: [
      {
        phaseId: "desktop-release",
        title: "Signed desktop release",
        ownerRole: "RELEASE_MANAGER",
        status: "BLOCKED",
        openActionCount: 2,
        p0OpenActionCount: 1,
        firstActions: [
          {
            action: "Verify uploaded release assets.",
            verificationCommands: ["npm run desktop:release-upload:check -- --release-tag <approved-release-tag>"],
          },
        ],
      },
    ],
    nextOperatorRunOrder: [
      {
        phaseId: "desktop-release",
        ownerRole: "RELEASE_MANAGER",
        status: "BLOCKED",
        firstAction: "Verify uploaded release assets.",
        verificationCommands: ["npm run desktop:release-upload:check -- --release-tag <approved-release-tag>"],
      },
    ],
    externalApprovalQueue: [],
    verificationCommands: [],
    errors: [],
  });
}

describe("OperationalLaunchPanel", () => {
  it("renders the default go-live guide and imported launch console lanes", () => {
    render(<OperationalLaunchPanel />);

    expect(screen.getByText("운영 런치 콘솔")).toBeInTheDocument();
    expect(screen.getByText(/남은 운영 단계를 한 화면에서 확인/)).toBeInTheDocument();
    expect(screen.getByText(/서명 데스크톱 릴리즈/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/\{"schema":"jium-operational-launch-console-v1"/), {
      target: { value: validConsoleJson() },
    });
    fireEvent.click(screen.getByRole("button", { name: /JSON 반영/ }));

    expect(screen.getByText("Signed desktop release")).toBeInTheDocument();
    expect(screen.getByText("RELEASE_MANAGER")).toBeInTheDocument();
    expect(screen.getByText("npm run desktop:release-upload:check -- --release-tag <approved-release-tag>")).toBeInTheDocument();
  });

  it("blocks imported launch console JSON with raw URLs", () => {
    render(<OperationalLaunchPanel />);

    const input = screen.getByPlaceholderText(/\{"schema":"jium-operational-launch-console-v1"/);
    fireEvent.change(input, {
      target: {
        value: JSON.stringify({
          schema: "jium-operational-launch-console-v1",
          source: { version: "0.3.104" },
          summary: {},
          ownerLanes: [],
          externalApprovalQueue: [{ command: "open https://prod.example.com/jium" }],
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /JSON 반영/ }));

    expect(screen.getByText(/원문 URL/)).toBeInTheDocument();
    expect(input).toHaveValue("");
  });
});
