import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA,
  buildOperationalApprovalCommandPacket,
  formatOperationalApprovalCommandPacketMarkdown,
} from "../scripts/build-operational-approval-command-packet.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.94") {
  const dir = path.join(os.tmpdir(), `jium-approval-command-packet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational approval command packet", () => {
  it("builds a redacted command packet for external approvals and onboarding evidence", async () => {
    const root = await tempRepo();
    const result = await buildOperationalApprovalCommandPacket({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const markdown = formatOperationalApprovalCommandPacketMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.schema).toBe(OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA);
    expect(result.report.status).toBe("READY_FOR_EXTERNAL_APPROVALS");
    expect(result.report.summary.groupCounts["operational-approval-records"]).toBe(6);
    expect(result.report.summary.groupCounts["production-onboarding-checklist"]).toBe(7);
    expect(result.report.summary.groupCounts["production-onboarding-storage-decision"]).toBe(2);
    expect(result.report.summary.groupCounts["production-onboarding-public-operations"]).toBe(3);
    expect(result.report.summary.groupCounts.verification).toBe(4);
    expect(result.report.summary.commandCount).toBe(22);
    expect(result.report.leakScan.status).toBe("PASS");
    expect(markdown).toContain("JiumAI Operational Approval Command Packet");
    expect(markdown).toContain("ops:approvals:approve-record");
    expect(markdown).toContain("ops:onboarding:approve-checklist");
    expect(markdown).toContain("ops:onboarding:approve-storage-decision");
    expect(markdown).toContain("ops:onboarding:approve-public-operations");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ghs_fake");
  });

  it("writes canonical JSON and Markdown reports", async () => {
    const root = await tempRepo();

    const result = await buildOperationalApprovalCommandPacket({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const json = JSON.parse(
      await readFile(path.join(root, "dist", "operational-approval-command-packet", "operational-approval-command-packet.json"), "utf8"),
    );
    const markdown = await readFile(
      path.join(root, "dist", "operational-approval-command-packet", "operational-approval-command-packet.md"),
      "utf8",
    );

    expect(json.schema).toBe(OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA);
    expect(json.summary.commandCount).toBe(result.report.summary.commandCount);
    expect(markdown).toContain("Run Order");
  });

  it("runs the CLI and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-approval-command-packet.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--json", "--output", "../unsafe-report.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(existsSync(path.join(root, "..", "unsafe-report.json"))).toBe(false);

    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--json", "--output", "reports/approval-command-packet.json"],
      { encoding: "utf8" },
    );
    const output = JSON.parse(await readFile(path.join(root, "reports", "approval-command-packet.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(output.schema).toBe(OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA);
    expect(output.status).toBe("READY_FOR_EXTERNAL_APPROVALS");
  });
});
