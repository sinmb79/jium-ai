import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_OPERATOR_CHECKLIST_RECORDS } from "../scripts/check-production-onboarding.mjs";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  writeProductionOnboardingScaffold,
} from "../scripts/init-production-onboarding.mjs";
import {
  approveProductionOnboardingChecklistRecord,
  formatProductionOnboardingChecklistApprovalMarkdown,
  validateProductionOnboardingChecklistApproval,
} from "../scripts/approve-production-onboarding-checklist.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.74") {
  const dir = path.join(os.tmpdir(), `jium-onboarding-checklist-approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await import("node:fs/promises").then(({ writeFile }) => writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8"));
  writeProductionOnboardingScaffold({ root: dir, generatedAt: "2026-06-01T00:00:00.000Z" });
  return dir;
}

async function readChecklist(root: string) {
  return JSON.parse(await readFile(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "operator-checklist.json"), "utf8"));
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("production onboarding checklist approval", () => {
  it("approves one checklist record with a redacted evidence report", async () => {
    const root = await tempRepo();

    const result = await approveProductionOnboardingChecklistRecord({
      root,
      recordId: "server-origin-approval",
      evidenceRef: "ORIGIN-APPROVAL-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const checklist = await readChecklist(root);
    const reportText = JSON.stringify(result.report);
    const markdown = formatProductionOnboardingChecklistApprovalMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("RECORD_APPROVED");
    expect(checklist.status).toBe("PENDING_EXTERNAL_APPROVALS");
    expect(checklist.records.find((record: { id: string }) => record.id === "server-origin-approval")).toMatchObject({
      status: "APPROVED",
      evidenceRef: "ORIGIN-APPROVAL-2026-001",
    });
    expect(result.report.summary.approvedRecordCount).toBe(1);
    expect(result.report.evidence.evidenceRefStatus).toBe("SET_REDACTED");
    expect(result.report.evidence.evidenceRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Production Onboarding Checklist Approval");
    expect(reportText).not.toContain(root);
    expect(reportText).not.toContain("ORIGIN-APPROVAL-2026-001");
    expect(result.report.nextActions.join("\n")).toContain("ops:onboarding:check");
  });

  it("marks the checklist approved after every required record is approved", async () => {
    const root = await tempRepo();

    for (const [index, recordId] of REQUIRED_OPERATOR_CHECKLIST_RECORDS.entries()) {
      const result = await approveProductionOnboardingChecklistRecord({
        root,
        recordId,
        evidenceRef: `ONBOARDING-APPROVAL-${String(index + 1).padStart(2, "0")}`,
        generatedAt: "2026-06-01T00:00:00.000Z",
      });
      expect(result.valid).toBe(true);
    }
    const checklist = await readChecklist(root);

    expect(checklist.status).toBe("APPROVED");
    expect(checklist.records.every((record: { status: string }) => record.status === "APPROVED")).toBe(true);
  });

  it("blocks unsafe evidence references without changing the checklist", async () => {
    const root = await tempRepo();

    const plan = validateProductionOnboardingChecklistApproval({
      root,
      recordId: "server-origin-approval",
      evidenceRef: "https://unsafe.example/approval",
    });
    const result = await approveProductionOnboardingChecklistRecord({
      root,
      recordId: "server-origin-approval",
      evidenceRef: "https://unsafe.example/approval",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const checklist = await readChecklist(root);

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("raw URL or contact");
    expect(checklist.records.find((record: { id: string }) => record.id === "server-origin-approval")).toMatchObject({
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-ORIGIN-APPROVAL-REF",
    });
    expect(JSON.stringify(result.report)).not.toContain("unsafe.example");
  });

  it("runs the CLI approval flow and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "approve-production-onboarding-checklist.mjs");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--record",
        "trusted-public-key-approval",
        "--evidence-ref",
        "TRUSTED-KEY-APPROVAL-2026-001",
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );
    const afterBlocked = await readChecklist(root);

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(afterBlocked.records.find((record: { id: string }) => record.id === "trusted-public-key-approval")).toMatchObject({
      status: "PENDING_APPROVAL",
    });

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--record",
        "trusted-public-key-approval",
        "--evidence-ref",
        "TRUSTED-KEY-APPROVAL-2026-001",
        "--json",
        "--output",
        "reports/checklist-approval.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "checklist-approval.json"), "utf8"));
    const checklist = await readChecklist(root);

    expect(run.status).toBe(0);
    expect(report.status).toBe("RECORD_APPROVED");
    expect(JSON.stringify(report)).not.toContain("TRUSTED-KEY-APPROVAL-2026-001");
    expect(checklist.records.find((record: { id: string }) => record.id === "trusted-public-key-approval")).toMatchObject({
      status: "APPROVED",
      evidenceRef: "TRUSTED-KEY-APPROVAL-2026-001",
    });
  });
});
