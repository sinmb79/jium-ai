import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA,
  buildOperationalApprovalEvidenceDigests,
  formatOperationalApprovalEvidenceDigestsMarkdown,
  writeOperationalApprovalEvidenceDigestFiles,
} from "../scripts/build-operational-approval-evidence-digests.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.85") {
  const dir = path.join(os.tmpdir(), `jium-approval-digests-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

async function writeEvidence(root: string, relativePath: string, content: unknown) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, typeof content === "string" ? content : JSON.stringify(content, null, 2), "utf8");
  return filePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational approval evidence digests", () => {
  it("builds a redacted digest manifest for approved review evidence files", async () => {
    const root = await tempRepo();
    await writeEvidence(root, "dist/operational-release-dossier/operational-release-dossier.json", {
      schema: "jium-operational-release-dossier-v1",
      status: "READY_FOR_EXTERNAL_REVIEW",
      summary: { blockedGateCount: 5 },
      leakScan: { status: "PASS", findings: [] },
    });
    await writeEvidence(root, "dist/operational-release-dossier/operational-release-dossier.md", [
      "# JiumAI Operational Release Dossier",
      "",
      "- Status: READY_FOR_EXTERNAL_REVIEW",
      "- Leak scan: PASS",
      "",
    ].join("\n"));

    const result = await buildOperationalApprovalEvidenceDigests({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      files: [
        "dist/operational-release-dossier/operational-release-dossier.json",
        "dist/operational-release-dossier/operational-release-dossier.md",
      ],
    });
    const markdown = formatOperationalApprovalEvidenceDigestsMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.schema).toBe(OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA);
    expect(result.report.status).toBe("READY");
    expect(result.report.summary.fileCount).toBe(2);
    expect(result.report.summary.unsafeFindingCount).toBe(0);
    expect(result.report.aggregateDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.files[0]).toMatchObject({
      id: "operational-release-dossier-json",
      path: "dist/operational-release-dossier/operational-release-dossier.json",
      digest: `sha256-${createHash("sha256").update(
        `${JSON.stringify(
          {
            schema: "jium-operational-release-dossier-v1",
            status: "READY_FOR_EXTERNAL_REVIEW",
            summary: { blockedGateCount: 5 },
            leakScan: { status: "PASS", findings: [] },
          },
          null,
          2,
        )}`,
      ).digest("hex")}`,
    });
    expect(result.report.approvalRecordCommands).toHaveLength(6);
    expect(result.report.approvalRecordCommands[0].command).toContain("--evidence-digest sha256-");
    expect(markdown).toContain("JiumAI Operational Approval Evidence Digests");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ghs_fake");
  });

  it("blocks unsafe evidence files before they can be used for approval records", async () => {
    const root = await tempRepo();
    await writeEvidence(root, "dist/unsafe-evidence.json", {
      schema: "unsafe",
      publicUrl: "https://prod.example.com/jium",
      support: "support@example.com",
      token: "ghs_fake1234567890",
    });

    const result = await buildOperationalApprovalEvidenceDigests({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      files: ["dist/unsafe-evidence.json"],
    });

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.summary.unsafeFindingCount).toBeGreaterThanOrEqual(3);
    expect(result.report.aggregateDigest).toBe("");
    expect(JSON.stringify(result.report)).not.toContain("prod.example.com");
    expect(JSON.stringify(result.report)).not.toContain("support@example.com");
    expect(JSON.stringify(result.report)).not.toContain("ghs_fake1234567890");
  });

  it("writes canonical JSON and Markdown digest reports", async () => {
    const root = await tempRepo();
    await writeEvidence(root, "dist/operational-release-dossier/operational-release-dossier.json", {
      schema: "jium-operational-release-dossier-v1",
      status: "READY_FOR_EXTERNAL_REVIEW",
      leakScan: { status: "PASS", findings: [] },
    });
    const result = await buildOperationalApprovalEvidenceDigests({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      files: ["dist/operational-release-dossier/operational-release-dossier.json"],
    });
    const written = writeOperationalApprovalEvidenceDigestFiles({ root, report: result.report });
    const json = JSON.parse(await readFile(written.jsonPath, "utf8"));
    const markdown = await readFile(written.markdownPath, "utf8");

    expect(json.schema).toBe(OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA);
    expect(markdown).toContain("Approval Commands");
    expect(written.markdownPathRelative).toBe("dist/operational-approval-evidence-digests/operational-approval-evidence-digests.md");
  });

  it("runs the CLI with repeated evidence files", async () => {
    const root = await tempRepo();
    await writeEvidence(root, "dist/operational-release-dossier/operational-release-dossier.json", {
      schema: "jium-operational-release-dossier-v1",
      status: "READY_FOR_EXTERNAL_REVIEW",
      leakScan: { status: "PASS", findings: [] },
    });
    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-approval-evidence-digests.mjs");
    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--file",
        "dist/operational-release-dossier/operational-release-dossier.json",
        "--json",
        "--output",
        "reports/approval-digests.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "approval-digests.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(report.schema).toBe(OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA);
    expect(report.status).toBe("READY");
    expect(report.aggregateDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
  });
});
