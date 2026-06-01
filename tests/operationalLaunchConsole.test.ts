import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildOperationalApprovalCommandPacket } from "../scripts/build-operational-approval-command-packet.mjs";
import {
  OPERATIONAL_LAUNCH_CONSOLE_SCHEMA,
  buildOperationalLaunchConsole,
  formatOperationalLaunchConsoleMarkdown,
} from "../scripts/build-operational-launch-console.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.95") {
  const dir = path.join(os.tmpdir(), `jium-launch-console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

function actionPlan(status: "BLOCKED" | "READY" = "BLOCKED") {
  return {
    schema: "jium-operational-action-plan-v1",
    generatedAt: "2026-06-02T00:00:00.000Z",
    status,
    source: {
      schema: "jium-operational-handoff-bundle-v1",
      generatedAt: "2026-06-02T00:00:00.000Z",
      status,
      version: "0.3.95",
      commit: "abc1234",
      platform: "win32",
    },
    summary: {
      phaseCount: 2,
      actionCount: status === "READY" ? 1 : 3,
      todoActionCount: status === "READY" ? 0 : 2,
      doneActionCount: status === "READY" ? 1 : 1,
      blockedPhaseCount: status === "READY" ? 0 : 1,
      readyPhaseCount: status === "READY" ? 2 : 1,
    },
    phases: [
      {
        order: 1,
        id: "production-onboarding",
        title: "Private production onboarding",
        ownerRole: "OPERATIONS_LEAD",
        status,
        objective: "Complete private onboarding before launch.",
        gates: [{ id: "production-onboarding-readiness", status, errorCount: status === "READY" ? 0 : 4 }],
        reportRefs: ["production-onboarding-readiness-report.json"],
        actions:
          status === "READY"
            ? []
            : [
                {
                  id: "production-onboarding-01",
                  order: 1,
                  status: "TODO",
                  priority: "P0",
                  source: "test",
                  action: "Record each externally approved onboarding checklist item.",
                  evidenceTarget: "ops/private/production-onboarding",
                  verificationCommands: ["npm run ops:onboarding:approve-checklist -- --record <record-id> --evidence-ref <pseudonymous-evidence-reference>"],
                  reportRefs: ["production-onboarding-readiness-report.json"],
                  safetyBoundary: "Do not store raw values.",
                },
                {
                  id: "production-onboarding-02",
                  order: 2,
                  status: "TODO",
                  priority: "P1",
                  source: "test",
                  action: "Run the private onboarding readiness check.",
                  evidenceTarget: "dist/operational-handoff-bundle",
                  verificationCommands: ["npm run ops:onboarding:check"],
                  reportRefs: ["production-onboarding-readiness-report.json"],
                  safetyBoundary: "Do not store raw values.",
                },
              ],
        completionCriteria: ["Production onboarding readiness is READY."],
      },
      {
        order: 2,
        id: "server-storage",
        title: "Private server storage",
        ownerRole: "DATA_PROTECTION_OFFICER",
        status: "READY",
        objective: "Keep private storage outside the repository.",
        gates: [{ id: "server-storage-readiness", status: "READY", errorCount: 0 }],
        reportRefs: ["server-storage-readiness-report.json"],
        actions: [
          {
            id: "server-storage-01",
            order: 1,
            status: "DONE",
            priority: "P3",
            source: "test",
            action: "Prepare repo-external storage.",
            evidenceTarget: "approved private storage decision record",
            verificationCommands: ["npm run security:server-storage"],
            reportRefs: ["server-storage-readiness-report.json"],
            safetyBoundary: "Do not store raw values.",
          },
        ],
        completionCriteria: ["Server storage readiness is READY."],
      },
    ],
    runOrder: [],
    safetyNotes: ["Synthetic action plan for tests."],
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational launch console", () => {
  it("condenses action plan phases and approval commands into owner lanes", async () => {
    const root = await tempRepo();
    const commandPacket = await buildOperationalApprovalCommandPacket({ root, generatedAt: "2026-06-02T00:00:00.000Z" });
    const result = await buildOperationalLaunchConsole({
      root,
      generatedAt: "2026-06-02T00:00:00.000Z",
      actionPlan: actionPlan("BLOCKED"),
      commandPacket: commandPacket.report,
    });
    const markdown = formatOperationalLaunchConsoleMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.schema).toBe(OPERATIONAL_LAUNCH_CONSOLE_SCHEMA);
    expect(result.report.status).toBe("EXTERNAL_INPUTS_REQUIRED");
    expect(result.report.launchDecision.canLaunchNow).toBe(false);
    expect(result.report.summary.phaseCount).toBe(2);
    expect(result.report.summary.blockedPhaseCount).toBe(1);
    expect(result.report.summary.p0OpenActionCount).toBe(1);
    expect(result.report.externalApprovalQueue).toHaveLength(18);
    expect(result.report.verificationCommands).toHaveLength(4);
    expect(result.report.hardBlocks[0]).toMatchObject({
      phaseId: "production-onboarding",
      ownerRole: "OPERATIONS_LEAD",
      p0OpenActionCount: 1,
    });
    expect(result.report.leakScan.status).toBe("PASS");
    expect(markdown).toContain("JiumAI Operational Launch Console");
    expect(markdown).toContain("Owner Lanes");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ghs_fake");
  });

  it("marks the launch console ready only when the action plan and source are ready", async () => {
    const root = await tempRepo();
    const commandPacket = await buildOperationalApprovalCommandPacket({ root, generatedAt: "2026-06-02T00:00:00.000Z" });
    const result = await buildOperationalLaunchConsole({
      root,
      generatedAt: "2026-06-02T00:00:00.000Z",
      actionPlan: actionPlan("READY"),
      commandPacket: commandPacket.report,
    });

    expect(result.report.status).toBe("READY_FOR_GO_LIVE_ARCHIVE");
    expect(result.report.launchDecision.canLaunchNow).toBe(true);
    expect(result.report.hardBlocks).toHaveLength(0);
  });

  it("writes canonical JSON and Markdown reports", async () => {
    const root = await tempRepo();
    const commandPacket = await buildOperationalApprovalCommandPacket({ root, generatedAt: "2026-06-02T00:00:00.000Z" });
    const result = await buildOperationalLaunchConsole({
      root,
      generatedAt: "2026-06-02T00:00:00.000Z",
      actionPlan: actionPlan("BLOCKED"),
      commandPacket: commandPacket.report,
    });
    const json = JSON.parse(await readFile(path.join(root, "dist", "operational-launch-console", "operational-launch-console.json"), "utf8"));
    const markdown = await readFile(path.join(root, "dist", "operational-launch-console", "operational-launch-console.md"), "utf8");

    expect(json.schema).toBe(OPERATIONAL_LAUNCH_CONSOLE_SCHEMA);
    expect(json.summary.openActionCount).toBe(result.report.summary.openActionCount);
    expect(markdown).toContain("External Approval Queue");
  });

  it("runs the CLI with explicit source reports and rejects unsafe output paths", async () => {
    const root = await tempRepo();
    const commandPacket = await buildOperationalApprovalCommandPacket({ root, generatedAt: "2026-06-02T00:00:00.000Z" });
    await writeFile(path.join(root, "action-plan.json"), JSON.stringify(actionPlan("BLOCKED"), null, 2), "utf8");
    await writeFile(path.join(root, "command-packet.json"), JSON.stringify(commandPacket.report, null, 2), "utf8");
    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-launch-console.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--action-plan", "action-plan.json", "--command-packet", "command-packet.json", "--json", "--output", "../unsafe-launch.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(existsSync(path.join(root, "..", "unsafe-launch.json"))).toBe(false);

    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--action-plan", "action-plan.json", "--command-packet", "command-packet.json", "--json", "--output", "reports/launch-console.json"],
      { encoding: "utf8" },
    );
    const output = JSON.parse(await readFile(path.join(root, "reports", "launch-console.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(output.schema).toBe(OPERATIONAL_LAUNCH_CONSOLE_SCHEMA);
    expect(output.status).toBe("EXTERNAL_INPUTS_REQUIRED");
  });
});
