import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildOperationalActionPlan,
  formatOperationalActionPlanMarkdown,
  writeOperationalActionPlanFiles,
} from "../scripts/build-operational-action-plan.mjs";
import type { OperationalHandoffBundleSummary } from "../scripts/build-operational-handoff-bundle.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-operational-action-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

function summary(overrides: Partial<OperationalHandoffBundleSummary> = {}): OperationalHandoffBundleSummary {
  return {
    schema: "jium-operational-handoff-bundle-v1",
    generatedAt: "2026-06-01T00:00:00.000Z",
    status: "BLOCKED",
    version: "0.3.61",
    commit: "abc123",
    platform: "win32",
    gates: [
      { id: "server-runtime-readiness", status: "BLOCKED", errorCount: 2 },
      { id: "server-storage-readiness", status: "BLOCKED", errorCount: 1 },
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
    externalRecordsNeeded: [],
    nextActions: [
      "Prepare approved HTTPS public, privacy, and support routes with npm run ops:public-env:init before final go-live review.",
      "Confirm public privacy notice https://privacy.example.com is not copied into the public action plan.",
      "Assign support route support@example.com and incident owner without storing raw contacts.",
      "Resolve desktop publish blockers before uploading with token ghs_fake123456.",
      "Complete the private production onboarding checklist and keep t.me/example out of reports.",
      "Review the trusted key candidate and do not paste abcdefghijklmnop.onion into evidence.",
      "Apply approved go-live approval flags with npm run ops:go-live:env:apply.",
      "Apply the approved pseudonymous incident owner reference with npm run ops:go-live:env:apply.",
    ],
    safetyNotes: [],
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational action plan", () => {
  it("turns a blocked handoff summary into redacted owner-routed actions", async () => {
    const root = await tempRepo();
    const plan = await buildOperationalActionPlan({
      root,
      generatedAt: "2026-06-01T01:00:00.000Z",
      summary: summary(),
    });
    const text = JSON.stringify(plan);

    expect(plan.status).toBe("BLOCKED");
    expect(plan.summary.blockedPhaseCount).toBe(6);
    expect(plan.phases.map((phase) => phase.ownerRole)).toEqual([
      "OPERATIONS_LEAD",
      "DEPLOYMENT_ADMIN",
      "DATA_PROTECTION_OFFICER",
      "RELEASE_MANAGER",
      "LEGAL_REVIEWER",
      "PROGRAM_OWNER",
    ]);
    expect(plan.phases.find((phase) => phase.id === "desktop-release")?.actions.some((action) => action.source === "handoff-next-action")).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "go-live")?.actions.some((action) => action.action.includes("ops:public-env:init"))).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "server-storage")?.actions[0].action).toContain("server:storage:init");
    expect(plan.runOrder.find((entry) => entry.phaseId === "server-storage")?.verificationCommands).toContain(
      "npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "production-onboarding")?.verificationCommands).toContain(
      "npm run ops:onboarding:approve-checklist -- --record <checklist-record-id> --evidence-ref <pseudonymous-evidence-reference>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "production-onboarding")?.verificationCommands).toContain(
      "npm run ops:onboarding:approve-storage-decision -- --section <audit-ledger|account-registry> --evidence-ref <pseudonymous-storage-evidence-reference>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "production-onboarding")?.verificationCommands).toContain(
      "npm run ops:onboarding:approve-public-operations -- --section <public-app|privacy-notice|support-route> --evidence-ref <pseudonymous-public-operations-evidence-reference>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "production-onboarding")?.verificationCommands).toContain(
      "npm run ops:onboarding:digest-evidence",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "approval-records")?.verificationCommands).toContain(
      "npm run ops:approvals:digest-evidence",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "approval-records")?.verificationCommands).toContain(
      "npm run ops:approvals:approve-record -- --type <approval-record-type> --approved-by-ref <pseudonymous-approver-ref> --reference-id <pseudonymous-approval-reference> --scope <approval-scope> --evidence-digest <sha256-evidence-digest>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "server-runtime")?.verificationCommands).toContain(
      "npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "server-runtime")?.verificationCommands).toContain(
      "npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "server-runtime")?.verificationCommands).toContain(
      "npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>",
    );
    expect(
      plan.phases
        .find((phase) => phase.id === "server-runtime")
        ?.actions.some((action) => action.action.includes("repo-external private key")),
    ).toBe(true);
    expect(
      plan.phases
        .find((phase) => phase.id === "server-runtime")
        ?.actions.some((action) => action.action.includes("approved trusted-key registry patch")),
    ).toBe(true);
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run public:hosting:bundle",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run public:netlify:check",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run public:hosting:preflight -- <approved-https-public-app-url>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run ops:go-live:rehearsal",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "desktop-release")?.verificationCommands).toContain(
      "npm run desktop:release-env:apply -- --channel <approved-release-channel> --update-url <approved-https-update-url> --publish-approval-ref <pseudonymous-desktop-publish-approval-reference>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "desktop-release")?.verificationCommands).toContain(
      "npm run desktop:release:digest-evidence -- --feed-dir <signed-release-folder>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run ops:public-env:init -- --base-url <approved-https-public-base-url> --write-env",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run ops:go-live:env:apply -- --incident-owner-ref <pseudonymous-incident-owner-reference>",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run ops:hosted-audit:apply -- --audit-report ops/private/production-onboarding/hosted-security-header-audit.json",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands).toContain(
      "npm run ops:release-dossier",
    );
    expect(plan.runOrder.find((entry) => entry.phaseId === "go-live")?.verificationCommands.some((command) => command.startsWith("Upload "))).toBe(
      false,
    );
    expect(plan.phases.find((phase) => phase.id === "go-live")?.actions.some((action) => action.action.includes("dist/static-hosting-bundle/site"))).toBe(
      true,
    );
    expect(plan.phases.find((phase) => phase.id === "go-live")?.actions.some((action) => action.action.includes("Netlify MCP upload lane"))).toBe(
      true,
    );
    expect(plan.phases.find((phase) => phase.id === "go-live")?.actions.some((action) => action.action.includes("public:hosting:preflight"))).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "go-live")?.actions.some((action) => action.action.includes("ops:go-live:env:apply"))).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "go-live")?.actions.some((action) => action.action.includes("ops:release-dossier"))).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "approval-records")?.actions.some((action) => action.action.includes("ops:approvals:digest-evidence"))).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "production-onboarding")?.actions.some((action) => action.action.includes("ops:onboarding:digest-evidence"))).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "desktop-release")?.actions.some((action) => action.action.includes("desktop:release:digest-evidence"))).toBe(true);
    expect(plan.phases.find((phase) => phase.id === "approval-records")?.actions.some((action) => action.action.includes("ops:go-live:env:apply"))).toBe(
      false,
    );
    expect(text).not.toContain("prod.example.com");
    expect(text).not.toContain("privacy.example.com");
    expect(text).not.toContain("support@example.com");
    expect(text).not.toContain("ghs_fake123456");
    expect(text).not.toContain("t.me/example");
    expect(text).not.toContain("abcdefghijklmnop.onion");
    expect(text).toContain("[REDACTED_URL]");
    expect(text).toContain("[REDACTED_EMAIL]");
    expect(text).toContain("[REDACTED_TOKEN]");
  });

  it("writes JSON and Markdown action plan files beside the handoff bundle", async () => {
    const root = await tempRepo();
    const plan = await buildOperationalActionPlan({
      root,
      generatedAt: "2026-06-01T01:00:00.000Z",
      summary: summary({
        status: "READY",
        gates: summary().gates.map((gate) => ({ ...gate, status: "READY", errorCount: 0 })),
        nextActions: ["Proceed with production launch using the approved release runbook."],
      }),
    });
    const written = writeOperationalActionPlanFiles({ root, plan });
    const markdown = await readFile(written.markdownPath, "utf8");
    const json = JSON.parse(await readFile(written.jsonPath, "utf8"));

    expect(plan.status).toBe("READY");
    expect(json.schema).toBe("jium-operational-action-plan-v1");
    expect(markdown).toContain("JiumAI Operational Action Plan");
    expect(markdown).toContain("Run Order");
    expect(written.markdownPathRelative).toBe("dist/operational-handoff-bundle/operational-action-plan.md");
  });

  it("runs the CLI from an existing summary without rebuilding the full handoff bundle", async () => {
    const root = await tempRepo();
    await writeFile(path.join(root, "summary.json"), JSON.stringify(summary(), null, 2), "utf8");
    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-action-plan.mjs");
    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--summary", "summary.json", "--json", "--output", "reports/action-plan.json"],
      { encoding: "utf8" },
    );
    const output = JSON.parse(await readFile(path.join(root, "reports", "action-plan.json"), "utf8"));
    const canonical = await readFile(path.join(root, "dist", "operational-handoff-bundle", "operational-action-plan.md"), "utf8");

    expect(run.status).toBe(0);
    expect(output.schema).toBe("jium-operational-action-plan-v1");
    expect(canonical).toContain("JiumAI Operational Action Plan");
    expect(formatOperationalActionPlanMarkdown(output)).toContain("Private production onboarding");
  });
});
