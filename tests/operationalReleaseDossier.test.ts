import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OPERATIONAL_RELEASE_DOSSIER_SCHEMA,
  buildOperationalReleaseDossier,
  formatOperationalReleaseDossierMarkdown,
  writeOperationalReleaseDossierFiles,
} from "../scripts/build-operational-release-dossier.mjs";
import type { OperationalActionPlan } from "../scripts/build-operational-action-plan.mjs";
import type { OperationalHandoffBundleSummary } from "../scripts/build-operational-handoff-bundle.mjs";
import type { OperationalGoLiveRehearsalReport } from "../scripts/run-operational-go-live-rehearsal.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.84") {
  const dir = path.join(os.tmpdir(), `jium-release-dossier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

function handoffSummary(): OperationalHandoffBundleSummary {
  return {
    schema: "jium-operational-handoff-bundle-v1",
    generatedAt: "2026-06-01T00:00:00.000Z",
    status: "BLOCKED",
    version: "0.3.84",
    commit: "abc123",
    platform: "win32",
    gates: [
      { id: "server-runtime-readiness", status: "BLOCKED", errorCount: 2 },
      { id: "server-storage-readiness", status: "READY", errorCount: 0 },
      { id: "desktop-publish-readiness", status: "BLOCKED", errorCount: 3 },
      { id: "operational-approval-records", status: "BLOCKED", errorCount: 4 },
      { id: "production-onboarding-readiness", status: "BLOCKED", errorCount: 5 },
      { id: "operational-go-live", status: "BLOCKED", errorCount: 6 },
    ],
    reports: {
      serverRuntimeJson: "server-runtime-readiness-report.json",
      serverRuntimeMarkdown: "server-runtime-readiness-report.md",
      serverStorageJson: "server-storage-readiness-report.json",
      serverStorageMarkdown: "server-storage-readiness-report.md",
      desktopPublishJson: "desktop-publish-readiness-report.json",
      desktopPublishMarkdown: "desktop-publish-readiness-report.md",
      approvalRecordsJson: "operational-approval-records-report.json",
      approvalRecordsMarkdown: "operational-approval-records-report.md",
      productionOnboardingJson: "production-onboarding-readiness-report.json",
      productionOnboardingMarkdown: "production-onboarding-readiness-report.md",
      goLiveJson: "operational-go-live-report.json",
      goLiveMarkdown: "operational-go-live-report.md",
      runbookMarkdown: "operational-handoff-runbook.md",
    },
    externalRecordsNeeded: [
      "Approve public app https://prod.example.com/jium without copying the raw URL into review packets.",
      "Assign support@example.com and incident owner after legal review.",
      "Keep ghs_fake1234567890 and abcdefghijklmnop.onion out of release evidence.",
    ],
    nextActions: [
      "Run hosted security audit for https://prod.example.com/jium before review.",
      "Do not include t.me/example or discord.gg/example in external packets.",
      "Apply approved support route support@example.com after reviewer sign-off.",
    ],
    safetyNotes: [],
  };
}

function actionPlan(): OperationalActionPlan {
  return {
    schema: "jium-operational-action-plan-v1",
    generatedAt: "2026-06-01T00:01:00.000Z",
    status: "BLOCKED",
    source: {
      schema: "jium-operational-handoff-bundle-v1",
      generatedAt: "2026-06-01T00:00:00.000Z",
      status: "BLOCKED",
      version: "0.3.84",
      commit: "abc123",
      platform: "win32",
    },
    summary: {
      phaseCount: 2,
      actionCount: 3,
      todoActionCount: 2,
      doneActionCount: 1,
      blockedPhaseCount: 1,
      readyPhaseCount: 1,
    },
    phases: [
      {
        id: "production-onboarding",
        order: 1,
        title: "Private production onboarding",
        status: "BLOCKED",
        ownerRole: "OPERATIONS_LEAD",
        objective: "Complete private approval records.",
        gates: [{ id: "production-onboarding-readiness", status: "BLOCKED", errorCount: 5 }],
        reportRefs: ["production-onboarding-readiness-report.md"],
        actions: [
          {
            id: "production-onboarding-01-review",
            order: 1,
            status: "TODO",
            priority: "P0",
            source: "phase-runbook",
            action: "Review support@example.com, https://prod.example.com/jium, and ghs_fake1234567890 only in private systems.",
            evidenceTarget: "ops/private/production-onboarding",
            verificationCommands: ["npm run ops:onboarding:check"],
            reportRefs: ["production-onboarding-readiness-report.md"],
            safetyBoundary: "No raw sensitive values.",
          },
        ],
        completionCriteria: ["Production onboarding readiness is READY."],
      },
      {
        id: "server-storage",
        order: 2,
        title: "Private server storage",
        status: "READY",
        ownerRole: "DATA_PROTECTION_OFFICER",
        objective: "Confirm private storage.",
        gates: [{ id: "server-storage-readiness", status: "READY", errorCount: 0 }],
        reportRefs: ["server-storage-readiness-report.md"],
        actions: [
          {
            id: "server-storage-01-confirm",
            order: 1,
            status: "DONE",
            priority: "P3",
            source: "phase-runbook",
            action: "Confirm private storage readiness.",
            evidenceTarget: "approved private storage decision record",
            verificationCommands: ["npm run security:server-storage"],
            reportRefs: ["server-storage-readiness-report.md"],
            safetyBoundary: "No raw sensitive values.",
          },
        ],
        completionCriteria: ["Server storage readiness is READY."],
      },
    ],
    runOrder: [
      {
        order: 1,
        phaseId: "production-onboarding",
        status: "BLOCKED",
        ownerRole: "OPERATIONS_LEAD",
        verificationCommands: ["npm run ops:onboarding:check"],
      },
    ],
    safetyNotes: [],
  };
}

function rehearsalReport(): OperationalGoLiveRehearsalReport {
  return {
    schema: "jium-operational-go-live-rehearsal-v1",
    generatedAt: "2026-06-01T00:02:00.000Z",
    status: "READY",
    version: "0.3.84",
    summary: {
      goLiveStatus: "READY",
      goLiveErrorCount: 0,
      serverStatus: "READY",
      productionOnboardingStatus: "READY",
      approvalRecordsStatus: "READY",
      hostedSecurityHeaderAuditStatus: "READY",
      activeTrustedKeyCount: 1,
      approvedApprovalRecordCount: 6,
      requiredApprovalRecordCount: 6,
      cleanedTemporaryWorkspace: "YES",
    },
    simulation: {
      desktopPublishMode: "SIMULATED_SIGNED_ARTIFACTS",
      publicRoutesMode: "SYNTHETIC_HTTPS_URLS",
      approvalsMode: "SYNTHETIC_PSEUDONYMOUS_APPROVALS",
      workspaceMode: "TEMPORARY_REPO_EXTERNAL",
    },
    checks: [
      { id: "temporary-workspace", label: "Synthetic workspace was removed", status: "PASS" },
      { id: "operational-go-live", label: "Synthetic go-live passed", status: "PASS" },
    ],
    errors: [],
    warnings: [],
    nextActions: ["Proceed to real external approval collection."],
    safetyNotes: [],
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational release dossier", () => {
  it("builds a redacted external-review dossier from blocked handoff, action plan, and ready rehearsal", async () => {
    const root = await tempRepo();
    const dossier = await buildOperationalReleaseDossier({
      root,
      generatedAt: "2026-06-01T00:03:00.000Z",
      summary: handoffSummary(),
      actionPlan: actionPlan(),
      rehearsalReport: rehearsalReport(),
    });
    const markdown = formatOperationalReleaseDossierMarkdown(dossier);
    const serialized = JSON.stringify(dossier);

    expect(dossier.schema).toBe(OPERATIONAL_RELEASE_DOSSIER_SCHEMA);
    expect(dossier.status).toBe("READY_FOR_EXTERNAL_REVIEW");
    expect(dossier.summary.blockedGateCount).toBe(5);
    expect(dossier.summary.openActionCount).toBe(2);
    expect(dossier.summary.rehearsalStatus).toBe("READY");
    expect(dossier.requiredReviewFiles.map((file) => file.path)).toContain(
      "dist/operational-handoff-bundle/operational-action-plan.md",
    );
    expect(dossier.requiredReviewFiles.map((file) => file.path)).toContain(
      "dist/server-origin-candidate/server-origin-candidate-report.md",
    );
    expect(dossier.requiredReviewFiles.map((file) => file.path)).toContain(
      "dist/trusted-key-approval-candidate/trusted-key-approval-candidate-report.md",
    );
    expect(dossier.requiredReviewFiles.map((file) => file.path)).toContain(
      "dist/desktop-publish-candidate/desktop-publish-candidate-report.md",
    );
    expect(dossier.priorityActions[0]).toMatchObject({
      phaseId: "production-onboarding",
      ownerRole: "OPERATIONS_LEAD",
      priority: "P0",
    });
    expect(dossier.leakScan.status).toBe("PASS");
    expect(markdown).toContain("JiumAI Operational Release Dossier");
    expect(markdown).toContain("READY_FOR_EXTERNAL_REVIEW");
    expect(serialized).not.toContain("prod.example.com");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ghs_fake1234567890");
    expect(serialized).not.toContain("t.me/example");
    expect(serialized).not.toContain("discord.gg/example");
    expect(serialized).not.toContain("abcdefghijklmnop.onion");
    expect(serialized).toContain("[REDACTED_URL]");
    expect(serialized).toContain("[REDACTED_EMAIL]");
    expect(serialized).toContain("[REDACTED_TOKEN]");
  });

  it("writes canonical JSON and Markdown files for release evidence review", async () => {
    const root = await tempRepo();
    const dossier = await buildOperationalReleaseDossier({
      root,
      generatedAt: "2026-06-01T00:03:00.000Z",
      summary: handoffSummary(),
      actionPlan: actionPlan(),
      rehearsalReport: rehearsalReport(),
    });
    const written = writeOperationalReleaseDossierFiles({ root, dossier });
    const json = JSON.parse(await readFile(written.jsonPath, "utf8"));
    const markdown = await readFile(written.markdownPath, "utf8");

    expect(json.schema).toBe(OPERATIONAL_RELEASE_DOSSIER_SCHEMA);
    expect(markdown).toContain("External Records Needed");
    expect(written.markdownPathRelative).toBe("dist/operational-release-dossier/operational-release-dossier.md");
  });

  it("runs the CLI from existing redacted source reports", async () => {
    const root = await tempRepo();
    await writeFile(path.join(root, "handoff.json"), JSON.stringify(handoffSummary(), null, 2), "utf8");
    await writeFile(path.join(root, "action-plan.json"), JSON.stringify(actionPlan(), null, 2), "utf8");
    await writeFile(path.join(root, "rehearsal.json"), JSON.stringify(rehearsalReport(), null, 2), "utf8");
    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-release-dossier.mjs");
    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--summary",
        "handoff.json",
        "--action-plan",
        "action-plan.json",
        "--rehearsal",
        "rehearsal.json",
        "--json",
        "--output",
        "reports/dossier.json",
      ],
      { encoding: "utf8" },
    );
    const output = JSON.parse(await readFile(path.join(root, "reports", "dossier.json"), "utf8"));
    const canonical = await readFile(path.join(root, "dist", "operational-release-dossier", "operational-release-dossier.md"), "utf8");

    expect(run.status).toBe(0);
    expect(output.schema).toBe(OPERATIONAL_RELEASE_DOSSIER_SCHEMA);
    expect(output.status).toBe("READY_FOR_EXTERNAL_REVIEW");
    expect(canonical).toContain("JiumAI Operational Release Dossier");
  });

  it("derives a missing no-build action plan from an existing handoff summary", async () => {
    const root = await tempRepo();
    await mkdir(path.join(root, "dist", "operational-handoff-bundle"), { recursive: true });
    await mkdir(path.join(root, "dist", "operational-go-live-rehearsal"), { recursive: true });
    await writeFile(
      path.join(root, "dist", "operational-handoff-bundle", "operational-handoff-summary.json"),
      JSON.stringify(handoffSummary(), null, 2),
      "utf8",
    );
    await writeFile(
      path.join(root, "dist", "operational-go-live-rehearsal", "operational-go-live-rehearsal-report.json"),
      JSON.stringify(rehearsalReport(), null, 2),
      "utf8",
    );
    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-release-dossier.mjs");
    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--no-build", "--json", "--output", "reports/dossier.json"],
      { encoding: "utf8" },
    );
    const output = JSON.parse(await readFile(path.join(root, "reports", "dossier.json"), "utf8"));
    const actionPlanJson = await readFile(path.join(root, "dist", "operational-handoff-bundle", "operational-action-plan.json"), "utf8");

    expect(run.status).toBe(0);
    expect(output.status).toBe("READY_FOR_EXTERNAL_REVIEW");
    expect(JSON.parse(actionPlanJson).schema).toBe("jium-operational-action-plan-v1");
  });
});
