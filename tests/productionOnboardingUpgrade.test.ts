import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
} from "../scripts/check-operational-approval-records.mjs";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  writeProductionOnboardingScaffold,
} from "../scripts/init-production-onboarding.mjs";
import {
  upgradeProductionOnboarding,
} from "../scripts/upgrade-production-onboarding.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.57") {
  const dir = path.join(os.tmpdir(), `jium-production-onboarding-upgrade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

async function setPackageVersion(root: string, version: string) {
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version }), "utf8");
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeApprovedApprovalPacket(root: string, version = "0.3.57") {
  const filePath = path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
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
    ),
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("production onboarding upgrade", () => {
  it("updates placeholder scaffold release metadata without approving anything", async () => {
    const root = await tempRepo("0.3.57");
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    await setPackageVersion(root, "0.3.60");

    const summary = upgradeProductionOnboarding({ root });
    const checklist = await readJson(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "operator-checklist.json"));
    const storageDecision = await readJson(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "storage-decision.template.json"));
    const publicOperations = await readJson(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "public-operations.template.json"));
    const approvals = await readJson(path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH));
    const serialized = JSON.stringify(summary);

    expect(summary.status).toBe("UPDATED");
    expect(summary.artifacts.map((entry) => entry.status)).toEqual(["UPDATED", "UPDATED", "UPDATED", "UPDATED", "UPDATED"]);
    expect(checklist.packageVersion).toBe("0.3.60");
    expect(checklist.status).toBe("PENDING_EXTERNAL_APPROVALS");
    expect(storageDecision.packageVersion).toBe("0.3.60");
    expect(storageDecision.status).toBe("PENDING_STORAGE_APPROVAL");
    expect(publicOperations.packageVersion).toBe("0.3.60");
    expect(publicOperations.status).toBe("PENDING_PUBLIC_OPERATIONS_APPROVAL");
    expect(approvals.packageVersion).toBe("0.3.60");
    expect(approvals.releaseTag).toBe("v0.3.60");
    expect(approvals.records.every((record: { status: string }) => record.status === "PENDING_APPROVAL")).toBe(true);
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("INSTITUTION_SESSION_SECRET=");
  });

  it("does not rewrite already approved release records", async () => {
    const root = await tempRepo("0.3.57");
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    await writeApprovedApprovalPacket(root, "0.3.57");
    await setPackageVersion(root, "0.3.60");

    const summary = upgradeProductionOnboarding({ root });
    const approvals = await readJson(path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH));

    expect(summary.status).toBe("REVIEW");
    expect(summary.artifacts.find((entry) => entry.label === "operational-approval-records")?.status).toBe("SKIPPED_APPROVED_RELEASE_RECORDS");
    expect(approvals.packageVersion).toBe("0.3.57");
    expect(approvals.releaseTag).toBe("v0.3.57");
  });

  it("adds the public operations template when upgrading an older onboarding scaffold", async () => {
    const root = await tempRepo("0.3.64");
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    await unlink(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "public-operations.template.json"));
    await setPackageVersion(root, "0.3.65");

    const summary = upgradeProductionOnboarding({ root });
    const publicOperations = await readJson(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "public-operations.template.json"));

    expect(summary.artifacts.find((entry) => entry.label === "public-operations")?.status).toBe("CREATED");
    expect(publicOperations.packageVersion).toBe("0.3.65");
    expect(publicOperations.status).toBe("PENDING_PUBLIC_OPERATIONS_APPROVAL");
    expect(JSON.stringify(summary)).not.toContain(root);
  });

  it("supports CLI dry-run JSON without writing changes", async () => {
    const root = await tempRepo("0.3.57");
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    await setPackageVersion(root, "0.3.60");
    const scriptPath = path.join(process.cwd(), "scripts", "upgrade-production-onboarding.mjs");

    const run = spawnSync(process.execPath, [scriptPath, "--json", "--dry-run", "--root", root], {
      cwd: root,
      encoding: "utf8",
    });
    const summary = JSON.parse(run.stdout);
    const checklist = await readJson(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "operator-checklist.json"));

    expect(run.status).toBe(0);
    expect(summary.status).toBe("UPDATED");
    expect(summary.artifacts.map((entry: { status: string }) => entry.status)).toEqual([
      "WOULD_UPDATE",
      "WOULD_UPDATE",
      "WOULD_UPDATE",
      "WOULD_UPDATE",
      "WOULD_UPDATE",
    ]);
    expect(checklist.packageVersion).toBe("0.3.57");
    expect(run.stdout).not.toContain(root);
  });
});
