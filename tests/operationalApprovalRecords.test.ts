import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
  buildOperationalApprovalRecordsReport,
  formatOperationalApprovalRecordsMarkdown,
  validateOperationalApprovalRecords,
} from "../scripts/check-operational-approval-records.mjs";

const tempDirs: string[] = [];
const fixedNow = Date.parse("2026-06-01T00:00:00.000Z");

async function tempRepo(version = "0.3.51") {
  const dir = path.join(os.tmpdir(), `jium-operational-approvals-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

function approvalPacket(version = "0.3.51") {
  return {
    schema: "jium-operational-approval-records-v1",
    generatedAt: "2026-06-01T00:00:00.000Z",
    packageVersion: version,
    releaseTag: `v${version}`,
    publicAppUrlStatus: "SET_HTTPS",
    privacyNoticeUrlStatus: "SET_HTTPS",
    records: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type, index) => ({
      id: `approval-${index + 1}`,
      type,
      status: "APPROVED",
      approvedAt: "2026-06-01T00:00:00.000Z",
      approvedByRef: `approver-${index + 1}`,
      referenceId: `OPS-2026-${String(index + 1).padStart(4, "0")}`,
      scope: `release-v${version}`,
      evidenceDigest: `sha256-${"a".repeat(64)}`,
      expiresAt: "2026-12-31T23:59:59.000Z",
    })),
  };
}

async function writeApprovalPacket(root: string, packet: unknown = approvalPacket()) {
  const filePath = path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(packet, null, 2), "utf8");
  return filePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational approval records", () => {
  it("accepts a complete redacted private approval packet", async () => {
    const root = await tempRepo();
    await writeApprovalPacket(root);

    const readiness = validateOperationalApprovalRecords({ root, now: fixedNow });
    const report = buildOperationalApprovalRecordsReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatOperationalApprovalRecordsMarkdown(report);

    expect(readiness.valid).toBe(true);
    expect(report.status).toBe("READY");
    expect(report.summary.approvedRecordCount).toBe(REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.length);
    expect(markdown).toContain("JiumAI Operational Approval Records Report");
    expect(JSON.stringify(report)).not.toContain(DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH);
  });

  it("blocks missing records and raw operational values", async () => {
    const root = await tempRepo();
    const packet = approvalPacket();
    packet.records = packet.records.slice(0, 2);
    await writeApprovalPacket(root, {
      ...packet,
      publicAppUrl: "https://prod.example.com/jium",
    });

    const readiness = validateOperationalApprovalRecords({ root, now: fixedNow });
    const report = buildOperationalApprovalRecordsReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("unsupported field: publicAppUrl");
    expect(readiness.errors.join("\n")).toContain("contains raw URL");
    expect(readiness.errors.join("\n")).toContain("missing required approval record");
    expect(report.status).toBe("BLOCKED");
    expect(JSON.stringify(report)).not.toContain("prod.example.com");
  });

  it("blocks absent private approval packets without leaking local paths", async () => {
    const root = await tempRepo();

    const readiness = validateOperationalApprovalRecords({
      root,
      env: { JIUM_OPERATIONAL_APPROVAL_RECORDS: path.join(root, "ops", "private", "missing.json") } as unknown as NodeJS.ProcessEnv,
      now: fixedNow,
    });
    const report = buildOperationalApprovalRecordsReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("file missing");
    expect(JSON.stringify(report)).not.toContain(root);
    expect(report.summary.fileStatus).toBe("MISSING");
  });
});
