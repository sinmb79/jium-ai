import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  writeProductionOnboardingScaffold,
} from "../scripts/init-production-onboarding.mjs";
import {
  approveProductionOnboardingStorageDecisionSection,
  formatProductionOnboardingStorageDecisionApprovalMarkdown,
  validateProductionOnboardingStorageDecisionApproval,
} from "../scripts/approve-production-onboarding-storage-decision.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.76") {
  const dir = path.join(os.tmpdir(), `jium-storage-decision-approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  writeProductionOnboardingScaffold({ root: dir, generatedAt: "2026-06-01T00:00:00.000Z" });
  return dir;
}

async function readStorageDecision(root: string) {
  return JSON.parse(await readFile(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "storage-decision.template.json"), "utf8"));
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("production onboarding storage decision approval", () => {
  it("approves one storage decision section with a redacted evidence report", async () => {
    const root = await tempRepo();

    const result = await approveProductionOnboardingStorageDecisionSection({
      root,
      section: "auditLedgerStorage",
      evidenceRef: "STORAGE-AUDIT-APPROVAL-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const decision = await readStorageDecision(root);
    const reportText = JSON.stringify(result.report);
    const markdown = formatProductionOnboardingStorageDecisionApprovalMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("SECTION_APPROVED");
    expect(decision.status).toBe("PENDING_STORAGE_APPROVAL");
    expect(decision.auditLedgerStorage).toMatchObject({
      status: "APPROVED",
      evidenceRef: "STORAGE-AUDIT-APPROVAL-2026-001",
    });
    expect(result.report.summary.approvedSectionCount).toBe(1);
    expect(result.report.evidence.evidenceRefStatus).toBe("SET_REDACTED");
    expect(result.report.evidence.evidenceRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Production Onboarding Storage Decision Approval");
    expect(reportText).not.toContain(root);
    expect(reportText).not.toContain("STORAGE-AUDIT-APPROVAL-2026-001");
    expect(result.report.nextActions.join("\n")).toContain("ops:onboarding:check");
  });

  it("marks the storage decision approved after both sections are approved", async () => {
    const root = await tempRepo();

    const audit = await approveProductionOnboardingStorageDecisionSection({
      root,
      section: "audit-ledger",
      evidenceRef: "STORAGE-AUDIT-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const account = await approveProductionOnboardingStorageDecisionSection({
      root,
      section: "account-registry",
      evidenceRef: "STORAGE-ACCOUNT-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const decision = await readStorageDecision(root);

    expect(audit.valid).toBe(true);
    expect(account.valid).toBe(true);
    expect(decision.status).toBe("APPROVED");
    expect(decision.auditLedgerStorage.status).toBe("APPROVED");
    expect(decision.accountRegistryStorage.status).toBe("APPROVED");
  });

  it("blocks unsafe evidence references without changing the storage decision", async () => {
    const root = await tempRepo();

    const plan = validateProductionOnboardingStorageDecisionApproval({
      root,
      section: "accountRegistryStorage",
      evidenceRef: "https://unsafe.example/storage",
    });
    const result = await approveProductionOnboardingStorageDecisionSection({
      root,
      section: "accountRegistryStorage",
      evidenceRef: "https://unsafe.example/storage",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const decision = await readStorageDecision(root);

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("raw URL or contact");
    expect(decision.accountRegistryStorage).toMatchObject({
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-ACCOUNT-REGISTRY-STORAGE-REF",
    });
    expect(JSON.stringify(result.report)).not.toContain("unsafe.example");
  });

  it("runs the CLI approval flow and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "approve-production-onboarding-storage-decision.mjs");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--section",
        "audit-ledger",
        "--evidence-ref",
        "STORAGE-AUDIT-2026-010",
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );
    const afterBlocked = await readStorageDecision(root);

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(afterBlocked.auditLedgerStorage.status).toBe("PENDING_APPROVAL");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--section",
        "audit-ledger",
        "--evidence-ref",
        "STORAGE-AUDIT-2026-010",
        "--json",
        "--output",
        "reports/storage-decision-approval.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "storage-decision-approval.json"), "utf8"));
    const decision = await readStorageDecision(root);

    expect(run.status).toBe(0);
    expect(report.status).toBe("SECTION_APPROVED");
    expect(JSON.stringify(report)).not.toContain("STORAGE-AUDIT-2026-010");
    expect(decision.auditLedgerStorage).toMatchObject({
      status: "APPROVED",
      evidenceRef: "STORAGE-AUDIT-2026-010",
    });
  });
});
