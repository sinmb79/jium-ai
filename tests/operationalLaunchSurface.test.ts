import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAUNCH_SURFACE,
  formatLaunchSurfaceMarkdown,
  parseOperationalLaunchConsoleJson,
} from "@/lib/operationalLaunchSurface";

function launchConsole(overrides: Record<string, unknown> = {}) {
  return {
    schema: "jium-operational-launch-console-v1",
    status: "EXTERNAL_INPUTS_REQUIRED",
    source: {
      version: "0.3.104",
    },
    launchDecision: {
      canLaunchNow: false,
    },
    summary: {
      phaseCount: 2,
      readyPhaseCount: 1,
      blockedPhaseCount: 1,
      openActionCount: 3,
      p0OpenActionCount: 1,
      externalApprovalCommandCount: 2,
      verificationCommandCount: 1,
    },
    ownerLanes: [
      {
        phaseId: "desktop-release",
        title: "Signed desktop release",
        ownerRole: "RELEASE_MANAGER",
        status: "BLOCKED",
        openActionCount: 3,
        p0OpenActionCount: 1,
        firstActions: [
          {
            action: "Verify uploaded release assets.",
            verificationCommands: ["npm run desktop:release-upload:check -- --release-tag <approved-release-tag>"],
          },
        ],
      },
      {
        phaseId: "server-storage",
        title: "Private server storage",
        ownerRole: "DATA_PROTECTION_OFFICER",
        status: "READY",
        openActionCount: 0,
        p0OpenActionCount: 0,
        firstActions: [],
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
    externalApprovalQueue: [
      {
        id: "release-evidence-review",
        group: "approval-records",
        ownerRole: "LEGAL_REVIEWER",
        phaseId: "approval-records",
        command: "npm run ops:approvals:approve-record -- --type RELEASE_EVIDENCE_REVIEW",
      },
    ],
    verificationCommands: [
      {
        id: "go-live-check",
        ownerRole: "PROGRAM_OWNER",
        phaseId: "go-live",
        command: "npm run ops:go-live:check",
      },
    ],
    errors: [],
    ...overrides,
  };
}

describe("operational launch surface", () => {
  it("summarizes a redacted operational launch console JSON", () => {
    const result = parseOperationalLaunchConsoleJson(JSON.stringify(launchConsole()));

    expect(result.error).toBe("");
    expect(result.surface?.source).toBe("LAUNCH_CONSOLE_JSON");
    expect(result.surface?.summary.version).toBe("0.3.104");
    expect(result.surface?.summary.openActionCount).toBe(3);
    expect(result.surface?.operatorRunOrder[0]).toMatchObject({
      phaseId: "desktop-release",
      ownerRole: "RELEASE_MANAGER",
      firstVerificationCommand: "npm run desktop:release-upload:check -- --release-tag <approved-release-tag>",
    });
    expect(formatLaunchSurfaceMarkdown(result.surface!)).toContain("Jium AI 운영 런치 콘솔");
  });

  it("blocks launch console JSON that contains raw operating values", () => {
    const result = parseOperationalLaunchConsoleJson(
      JSON.stringify(
        launchConsole({
          externalApprovalQueue: [
            {
              id: "unsafe",
              command: "curl https://prod.example.com/jium",
            },
          ],
        }),
      ),
    );

    expect(result.surface).toBeNull();
    expect(result.error).toContain("원문 URL");
  });

  it("keeps a default guide available before any JSON is imported", () => {
    expect(DEFAULT_LAUNCH_SURFACE.summary.status).toBe("EXTERNAL_INPUTS_REQUIRED");
    expect(DEFAULT_LAUNCH_SURFACE.operatorRunOrder.map((lane) => lane.phaseId)).toContain("desktop-release");
  });
});
