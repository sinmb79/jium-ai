import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
  validateOperationalApprovalRecords,
} from "../scripts/check-operational-approval-records.mjs";
import { writeOperationalApprovalRecordsTemplate } from "../scripts/init-operational-approval-records.mjs";
import {
  approveOperationalApprovalRecord,
  formatOperationalApprovalRecordApprovalMarkdown,
  validateOperationalApprovalRecordApproval,
} from "../scripts/approve-operational-approval-record.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.75") {
  const dir = path.join(os.tmpdir(), `jium-operational-approval-record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  writeOperationalApprovalRecordsTemplate({ root: dir, generatedAt: "2026-06-01T00:00:00.000Z" });
  return dir;
}

async function readPacket(root: string) {
  return JSON.parse(await readFile(path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH), "utf8"));
}

function approvalInput(type = "GO_LIVE_APPROVAL") {
  return {
    type,
    approvedByRef: "APPROVER-OPS-2026-001",
    referenceId: "OPS-APPROVAL-2026-001",
    scope: "release-v0.3.75-go-live",
    evidenceDigest: `sha256-${"a".repeat(64)}`,
    approvedAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2027-06-01T00:00:00.000Z",
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational approval record approval", () => {
  it("records one approved operational approval record with a redacted report", async () => {
    const root = await tempRepo();

    const result = await approveOperationalApprovalRecord({
      root,
      ...approvalInput("GO_LIVE_APPROVAL"),
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const packet = await readPacket(root);
    const record = packet.records.find((entry: { type: string }) => entry.type === "GO_LIVE_APPROVAL");
    const reportText = JSON.stringify(result.report);
    const markdown = formatOperationalApprovalRecordApprovalMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("RECORD_APPROVED");
    expect(record).toMatchObject({
      id: "approval-go-live-approval",
      status: "APPROVED",
      approvedByRef: "APPROVER-OPS-2026-001",
      referenceId: "OPS-APPROVAL-2026-001",
      scope: "release-v0.3.75-go-live",
      evidenceDigest: `sha256-${"a".repeat(64)}`,
    });
    expect(result.report.summary.approvedRecordCount).toBe(1);
    expect(result.report.evidence.approverRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.evidence.referenceIdDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Operational Approval Record Approval");
    expect(reportText).not.toContain(root);
    expect(reportText).not.toContain("APPROVER-OPS-2026-001");
    expect(reportText).not.toContain("OPS-APPROVAL-2026-001");
    expect(reportText).not.toContain("release-v0.3.75-go-live");
    expect(result.report.nextActions.join("\n")).toContain("ops:approvals:check");
  });

  it("makes the approval packet ready after every required record is recorded", async () => {
    const root = await tempRepo();

    for (const [index, type] of REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.entries()) {
      const result = await approveOperationalApprovalRecord({
        root,
        ...approvalInput(type),
        approvedByRef: `APPROVER-OPS-2026-${String(index + 1).padStart(3, "0")}`,
        referenceId: `OPS-APPROVAL-2026-${String(index + 1).padStart(3, "0")}`,
        scope: `release-v0.3.75-${type.toLowerCase().replaceAll("_", "-")}`,
        evidenceDigest: `sha256-${String(index + 1).repeat(64).slice(0, 64)}`,
        generatedAt: "2026-06-01T00:00:00.000Z",
        now: Date.parse("2026-06-01T00:00:00.000Z"),
      });
      expect(result.valid).toBe(true);
    }

    const readiness = validateOperationalApprovalRecords({
      root,
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });

    expect(readiness.valid).toBe(true);
  });

  it("accepts approval packets that use the configured desktop release tag", async () => {
    const root = await tempRepo();
    const env = { JIUM_DESKTOP_RELEASE_TAG: "v0.3.75-hotfix.1" } as unknown as NodeJS.ProcessEnv;

    await rm(path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH), { force: true });
    writeOperationalApprovalRecordsTemplate({
      root,
      env,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });

    const result = await approveOperationalApprovalRecord({
      root,
      env,
      ...approvalInput("GO_LIVE_APPROVAL"),
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("RECORD_APPROVED");
  });

  it("blocks unsafe approval values without changing the private packet", async () => {
    const root = await tempRepo();

    const plan = validateOperationalApprovalRecordApproval({
      root,
      ...approvalInput("LEGAL_REVIEW_APPROVAL"),
      approvedByRef: "legal@example.com",
    });
    const result = await approveOperationalApprovalRecord({
      root,
      ...approvalInput("LEGAL_REVIEW_APPROVAL"),
      approvedByRef: "legal@example.com",
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const packet = await readPacket(root);
    const record = packet.records.find((entry: { type: string }) => entry.type === "LEGAL_REVIEW_APPROVAL");

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("approvedByRef contains raw URL or contact value");
    expect(record.status).toBe("PENDING_APPROVAL");
    expect(record.approvedByRef).toContain("REPLACE-ME");
    expect(JSON.stringify(result.report)).not.toContain("legal@example.com");
  });

  it("runs the CLI approval flow and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "approve-operational-approval-record.mjs");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--type",
        "RELEASE_EVIDENCE_REVIEW",
        "--approved-by-ref",
        "APPROVER-OPS-2026-010",
        "--reference-id",
        "OPS-APPROVAL-2026-010",
        "--scope",
        "release-v0.3.75-release-evidence",
        "--evidence-digest",
        `sha256-${"b".repeat(64)}`,
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );
    const afterBlocked = await readPacket(root);
    const blockedRecord = afterBlocked.records.find((entry: { type: string }) => entry.type === "RELEASE_EVIDENCE_REVIEW");

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(blockedRecord.status).toBe("PENDING_APPROVAL");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--type",
        "RELEASE_EVIDENCE_REVIEW",
        "--approved-by-ref",
        "APPROVER-OPS-2026-010",
        "--reference-id",
        "OPS-APPROVAL-2026-010",
        "--scope",
        "release-v0.3.75-release-evidence",
        "--evidence-digest",
        `sha256-${"b".repeat(64)}`,
        "--approved-at",
        "2026-06-01T00:00:00.000Z",
        "--expires-at",
        "2027-06-01T00:00:00.000Z",
        "--json",
        "--output",
        "reports/approval-record.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "approval-record.json"), "utf8"));
    const packet = await readPacket(root);
    const record = packet.records.find((entry: { type: string }) => entry.type === "RELEASE_EVIDENCE_REVIEW");

    expect(run.status).toBe(0);
    expect(report.status).toBe("RECORD_APPROVED");
    expect(JSON.stringify(report)).not.toContain("APPROVER-OPS-2026-010");
    expect(record.status).toBe("APPROVED");
  });
});
