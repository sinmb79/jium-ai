import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES } from "../scripts/check-operational-approval-records.mjs";
import { REQUIRED_OPERATOR_CHECKLIST_RECORDS } from "../scripts/check-production-onboarding.mjs";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  writeProductionOnboardingScaffold,
} from "../scripts/init-production-onboarding.mjs";
import {
  buildProductionOnboardingEvidenceDigests,
  formatProductionOnboardingEvidenceDigestsMarkdown,
} from "../scripts/build-production-onboarding-evidence-digests.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.86") {
  const dir = path.join(os.tmpdir(), `jium-onboarding-evidence-digests-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  writeProductionOnboardingScaffold({ root: dir, generatedAt: "2026-06-01T00:00:00.000Z" });
  return dir;
}

async function writeReadyOnboardingEvidence(root: string, version = "0.3.86") {
  const onboardingDir = path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR);
  const checklistPath = path.join(onboardingDir, "operator-checklist.json");
  const checklist = JSON.parse(await readFile(checklistPath, "utf8"));
  checklist.packageVersion = version;
  checklist.status = "APPROVED";
  checklist.records = REQUIRED_OPERATOR_CHECKLIST_RECORDS.map((id, index) => ({
    id,
    status: "APPROVED",
    evidenceRef: `ONBOARDING-EVIDENCE-${String(index + 1).padStart(2, "0")}`,
    requiredCheck: `approved-check-${index + 1}`,
  }));
  await writeFile(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");

  const storagePath = path.join(onboardingDir, "storage-decision.template.json");
  const storage = JSON.parse(await readFile(storagePath, "utf8"));
  storage.packageVersion = version;
  storage.status = "APPROVED";
  storage.auditLedgerStorage.status = "APPROVED";
  storage.auditLedgerStorage.evidenceRef = "STORAGE-AUDIT-EVIDENCE-001";
  storage.accountRegistryStorage.status = "APPROVED";
  storage.accountRegistryStorage.evidenceRef = "STORAGE-ACCOUNT-EVIDENCE-001";
  await writeFile(storagePath, `${JSON.stringify(storage, null, 2)}\n`, "utf8");

  const publicOpsPath = path.join(onboardingDir, "public-operations.template.json");
  const publicOps = JSON.parse(await readFile(publicOpsPath, "utf8"));
  publicOps.packageVersion = version;
  publicOps.status = "APPROVED";
  publicOps.publicApp.status = "APPROVED";
  publicOps.publicApp.evidenceRef = "PUBLIC-APP-EVIDENCE-001";
  publicOps.privacyNotice.status = "APPROVED";
  publicOps.privacyNotice.evidenceRef = "PRIVACY-NOTICE-EVIDENCE-001";
  publicOps.supportRoute.status = "APPROVED";
  publicOps.supportRoute.evidenceRef = "SUPPORT-ROUTE-EVIDENCE-001";
  await writeFile(publicOpsPath, `${JSON.stringify(publicOps, null, 2)}\n`, "utf8");

  await writeFile(
    path.join(onboardingDir, "hosted-security-header-audit.json"),
    `${JSON.stringify(
      {
        schema: "jium-security-header-url-audit-v1",
        generatedAt: "2026-06-01T00:00:00.000Z",
        status: "READY",
        summary: {
          targetUrlState: "HTTPS",
          fetchState: "COMPLETED",
          httpStatus: 200,
          checkedHeaderCount: 6,
          passCount: 6,
          failureCount: 0,
          missingCount: 0,
          mismatchCount: 0,
        },
        checks: [],
        errors: [],
        safetyNotes: ["The raw target URL, host, path, query, and response header values are intentionally omitted."],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await mkdir(path.join(root, "ops", "private"), { recursive: true });
  await writeFile(
    path.join(root, "ops", "private", "operational-approval-records.json"),
    `${JSON.stringify(
      {
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
          scope: `release-${version}-${type.toLowerCase().replaceAll("_", "-")}`,
          evidenceDigest: `sha256-${String(index + 1).repeat(64).slice(0, 64)}`,
          expiresAt: "",
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("production onboarding evidence digests", () => {
  it("builds a redacted digest manifest for reviewed private onboarding files", async () => {
    const root = await tempRepo();
    await writeReadyOnboardingEvidence(root);

    const result = await buildProductionOnboardingEvidenceDigests({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const markdown = formatProductionOnboardingEvidenceDigestsMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("READY");
    expect(result.report.summary.fileCount).toBe(5);
    expect(result.report.summary.readyFileCount).toBe(5);
    expect(result.report.aggregateDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.files.map((file) => file.fileName)).toEqual(
      expect.arrayContaining([
        "operator-checklist.json",
        "storage-decision.template.json",
        "public-operations.template.json",
        "hosted-security-header-audit.json",
        "operational-approval-records.json",
      ]),
    );
    expect(result.report.excludedSources.map((source) => source.id)).toContain("server-runtime-env");
    expect(markdown).toContain("JiumAI Production Onboarding Evidence Digests");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("ops/private");
    expect(serialized).not.toContain("ONBOARDING-EVIDENCE-01");
    expect(serialized).not.toContain("STORAGE-AUDIT-EVIDENCE-001");
    expect(serialized).not.toContain("PUBLIC-APP-EVIDENCE-001");
    expect(serialized).not.toContain("approver-1");
  });

  it("blocks unsafe raw values without echoing them into the report", async () => {
    const root = await tempRepo();
    await writeReadyOnboardingEvidence(root);
    const checklistPath = path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "operator-checklist.json");
    const checklist = JSON.parse(await readFile(checklistPath, "utf8"));
    checklist.records[0].evidenceRef = "https://unsafe.example/onboarding";
    await writeFile(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, "utf8");

    const result = await buildProductionOnboardingEvidenceDigests({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.aggregateDigest).toBe("");
    expect(result.report.files.find((file) => file.fileName === "operator-checklist.json")?.status).toBe("BLOCKED");
    expect(result.report.summary.unsafeFindingCount).toBeGreaterThan(0);
    expect(serialized).not.toContain("unsafe.example");
  });

  it("runs the CLI, writes canonical reports, and rejects unsafe output paths", async () => {
    const root = await tempRepo();
    await writeReadyOnboardingEvidence(root);
    const scriptPath = path.join(process.cwd(), "scripts", "build-production-onboarding-evidence-digests.mjs");

    const blocked = spawnSync(process.execPath, [scriptPath, "--root", root, "--json", "--output", "../unsafe.json"], {
      encoding: "utf8",
    });
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");

    const run = spawnSync(process.execPath, [scriptPath, "--root", root, "--json", "--output", "reports/onboarding-digests.json"], {
      encoding: "utf8",
    });
    const report = JSON.parse(await readFile(path.join(root, "reports", "onboarding-digests.json"), "utf8"));
    const canonical = await readFile(
      path.join(root, "dist", "production-onboarding-evidence-digests", "production-onboarding-evidence-digests.md"),
      "utf8",
    );

    expect(run.status).toBe(0);
    expect(report.status).toBe("READY");
    expect(canonical).toContain("JiumAI Production Onboarding Evidence Digests");
    expect(JSON.stringify(report)).not.toContain(root);
    expect(JSON.stringify(report)).not.toContain("ops/private");
  });
});
