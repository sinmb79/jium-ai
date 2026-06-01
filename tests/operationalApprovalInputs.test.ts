import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES } from "../scripts/check-operational-approval-records.mjs";
import { REQUIRED_OPERATOR_CHECKLIST_RECORDS } from "../scripts/check-production-onboarding.mjs";
import { REQUIRED_STORAGE_DECISION_SECTIONS } from "../scripts/approve-production-onboarding-storage-decision.mjs";
import { REQUIRED_PUBLIC_OPERATIONS_SECTIONS } from "../scripts/approve-production-onboarding-public-operations.mjs";
import {
  OPERATIONAL_APPROVAL_INPUTS_SCHEMA,
  applyOperationalApprovalInputs,
  buildOperationalApprovalInputsTemplate,
  formatOperationalApprovalInputsApplyMarkdown,
  formatOperationalApprovalInputsTemplateMarkdown,
  writeOperationalApprovalInputsTemplateFiles,
} from "../scripts/operational-approval-inputs.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.97") {
  const dir = path.join(os.tmpdir(), `jium-approval-inputs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

const storageSectionCli: Record<string, string> = {
  auditLedgerStorage: "audit-ledger",
  accountRegistryStorage: "account-registry",
};

const publicOperationsCli: Record<string, string> = {
  publicApp: "public-app",
  privacyNotice: "privacy-notice",
  supportRoute: "support-route",
};

function validInputs() {
  return {
    schema: OPERATIONAL_APPROVAL_INPUTS_SCHEMA,
    packageVersion: "0.3.97",
    operationalApprovalRecords: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type, index) => ({
      type,
      approvedByRef: `approver-${index + 1}`,
      referenceId: `approval-ref-${index + 1}`,
      scope: `scope-${index + 1}`,
      evidenceDigest: `sha256-${String(index + 1).repeat(64).slice(0, 64)}`,
      approvedAt: "2026-06-02T00:00:00.000Z",
      expiresAt: "",
    })),
    onboardingChecklist: REQUIRED_OPERATOR_CHECKLIST_RECORDS.map((recordId, index) => ({
      recordId,
      evidenceRef: `onboarding-ref-${index + 1}`,
    })),
    storageDecisions: REQUIRED_STORAGE_DECISION_SECTIONS.map((section, index) => ({
      section: storageSectionCli[section],
      evidenceRef: `storage-ref-${index + 1}`,
    })),
    publicOperations: REQUIRED_PUBLIC_OPERATIONS_SECTIONS.map((section, index) => ({
      section: publicOperationsCli[section],
      evidenceRef: `public-ref-${index + 1}`,
    })),
  };
}

async function writeInput(root: string, relativePath: string, input: unknown) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(input, null, 2), "utf8");
  return filePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational approval inputs", () => {
  it("builds a private-fill approval input template", async () => {
    const root = await tempRepo();
    const template = buildOperationalApprovalInputsTemplate({
      root,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const markdown = formatOperationalApprovalInputsTemplateMarkdown(template);
    const serialized = JSON.stringify(template);

    expect(template.schema).toBe(OPERATIONAL_APPROVAL_INPUTS_SCHEMA);
    expect(template.status).toBe("READY_FOR_PRIVATE_FILL");
    expect(template.summary.operationalApprovalRecordCount).toBe(6);
    expect(template.summary.onboardingChecklistRecordCount).toBe(7);
    expect(template.summary.storageDecisionCount).toBe(2);
    expect(template.summary.publicOperationsCount).toBe(3);
    expect(template.summary.totalInputCount).toBe(18);
    expect(template.leakScan.status).toBe("PASS");
    expect(markdown).toContain("JiumAI Operational Approval Inputs Template");
    expect(markdown).toContain("ops:approvals:apply-inputs");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ghs_fake");
  });

  it("applies a filled private approval input file after validation", async () => {
    const root = await tempRepo();
    await writeInput(root, "ops/private/production-onboarding/approved-operational-inputs.json", validInputs());

    const result = await applyOperationalApprovalInputs({
      root,
      inputPath: "ops/private/production-onboarding/approved-operational-inputs.json",
      init: true,
      generatedAt: "2026-06-02T00:00:00.000Z",
      now: Date.parse("2026-06-02T00:00:00.000Z"),
    });
    const markdown = formatOperationalApprovalInputsApplyMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("APPLIED");
    expect(result.report.summary.totalInputCount).toBe(18);
    expect(result.report.summary.readyInputCount).toBe(18);
    expect(result.report.summary.appliedCount).toBe(18);
    expect(result.report.summary.approvalRecordsStatus).toBe("READY");
    expect(result.report.summary.productionOnboardingStatus).toBe("BLOCKED");
    expect(result.report.leakScan.status).toBe("PASS");
    expect(markdown).toContain("JiumAI Operational Approval Inputs Apply Report");
    expect(markdown).toContain("Applied inputs: 18");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ghs_fake");

    const approvalRecords = JSON.parse(await readFile(path.join(root, "ops/private/operational-approval-records.json"), "utf8"));
    const checklist = JSON.parse(await readFile(path.join(root, "ops/private/production-onboarding/operator-checklist.json"), "utf8"));

    expect(approvalRecords.records.every((record: { status: string }) => record.status === "APPROVED")).toBe(true);
    expect(checklist.records.every((record: { status: string }) => record.status === "APPROVED")).toBe(true);
  });

  it("blocks unsafe filled approval input files before writing private records", async () => {
    const root = await tempRepo();
    const input = validInputs();
    input.operationalApprovalRecords[0].approvedByRef = "support@example.com";
    input.onboardingChecklist[0].evidenceRef = "https://unsafe.example.test/evidence";
    await writeInput(root, "ops/private/production-onboarding/unsafe-inputs.json", input);

    const result = await applyOperationalApprovalInputs({
      root,
      inputPath: "ops/private/production-onboarding/unsafe-inputs.json",
      init: true,
      generatedAt: "2026-06-02T00:00:00.000Z",
      now: Date.parse("2026-06-02T00:00:00.000Z"),
    });
    const approvalRecords = JSON.parse(await readFile(path.join(root, "ops/private/operational-approval-records.json"), "utf8"));

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.summary.appliedCount).toBe(0);
    expect(result.report.summary.blockedInputCount).toBeGreaterThanOrEqual(2);
    expect(approvalRecords.records.every((record: { status: string }) => record.status === "PENDING_APPROVAL")).toBe(true);
    expect(JSON.stringify(result.report)).not.toContain("support@example.com");
    expect(JSON.stringify(result.report)).not.toContain("unsafe.example.test");
  });

  it("writes template reports and guards CLI output paths", async () => {
    const root = await tempRepo();
    const template = buildOperationalApprovalInputsTemplate({
      root,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const written = writeOperationalApprovalInputsTemplateFiles({ root, template });
    const json = JSON.parse(await readFile(written.jsonPath, "utf8"));
    const markdown = await readFile(written.markdownPath, "utf8");

    expect(json.schema).toBe(OPERATIONAL_APPROVAL_INPUTS_SCHEMA);
    expect(markdown).toContain("Required Groups");

    const scriptPath = path.join(process.cwd(), "scripts", "operational-approval-inputs.mjs");
    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "template", "--root", root, "--json", "--output", "../unsafe-template.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(existsSync(path.join(root, "..", "unsafe-template.json"))).toBe(false);
  });

  it("runs the apply CLI in dry-run mode", async () => {
    const root = await tempRepo();
    await writeInput(root, "ops/private/production-onboarding/approved-operational-inputs.json", validInputs());
    const scriptPath = path.join(process.cwd(), "scripts", "operational-approval-inputs.mjs");
    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "apply",
        "--root",
        root,
        "--input",
        "ops/private/production-onboarding/approved-operational-inputs.json",
        "--init",
        "--dry-run",
        "--json",
        "--output",
        "reports/apply-report.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports/apply-report.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(report.schema).toBe("jium-operational-approval-inputs-apply-report-v1");
    expect(report.status).toBe("READY_TO_APPLY");
    expect(report.summary.appliedCount).toBe(0);
    expect(report.summary.readyInputCount).toBe(18);
  });
});
