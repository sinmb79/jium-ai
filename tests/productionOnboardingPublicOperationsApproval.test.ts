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
  approveProductionOnboardingPublicOperationsSection,
  formatProductionOnboardingPublicOperationsApprovalMarkdown,
  validateProductionOnboardingPublicOperationsApproval,
} from "../scripts/approve-production-onboarding-public-operations.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.77") {
  const dir = path.join(os.tmpdir(), `jium-public-operations-approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  writeProductionOnboardingScaffold({ root: dir, generatedAt: "2026-06-01T00:00:00.000Z" });
  return dir;
}

async function readPublicOperations(root: string) {
  return JSON.parse(await readFile(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "public-operations.template.json"), "utf8"));
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("production onboarding public operations approval", () => {
  it("approves one public operations section with a redacted evidence report", async () => {
    const root = await tempRepo();

    const result = await approveProductionOnboardingPublicOperationsSection({
      root,
      section: "publicApp",
      evidenceRef: "PUBLIC-APP-APPROVAL-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const publicOps = await readPublicOperations(root);
    const reportText = JSON.stringify(result.report);
    const markdown = formatProductionOnboardingPublicOperationsApprovalMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("SECTION_APPROVED");
    expect(publicOps.status).toBe("PENDING_PUBLIC_OPERATIONS_APPROVAL");
    expect(publicOps.publicApp).toMatchObject({
      status: "APPROVED",
      evidenceRef: "PUBLIC-APP-APPROVAL-2026-001",
    });
    expect(result.report.summary.approvedSectionCount).toBe(1);
    expect(result.report.evidence.evidenceRefStatus).toBe("SET_REDACTED");
    expect(result.report.evidence.evidenceRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Production Onboarding Public Operations Approval");
    expect(reportText).not.toContain(root);
    expect(reportText).not.toContain("PUBLIC-APP-APPROVAL-2026-001");
    expect(result.report.nextActions.join("\n")).toContain("ops:onboarding:check");
  });

  it("marks public operations approved after every section is approved", async () => {
    const root = await tempRepo();

    for (const [section, evidenceRef] of [
      ["public-app", "PUBLIC-APP-2026-001"],
      ["privacy-notice", "PRIVACY-NOTICE-2026-001"],
      ["support-route", "SUPPORT-ROUTE-2026-001"],
    ] as const) {
      const result = await approveProductionOnboardingPublicOperationsSection({
        root,
        section,
        evidenceRef,
        generatedAt: "2026-06-01T00:00:00.000Z",
      });
      expect(result.valid).toBe(true);
    }

    const publicOps = await readPublicOperations(root);
    expect(publicOps.status).toBe("APPROVED");
    expect(publicOps.publicApp.status).toBe("APPROVED");
    expect(publicOps.privacyNotice.status).toBe("APPROVED");
    expect(publicOps.supportRoute.status).toBe("APPROVED");
  });

  it("blocks unsafe evidence references without changing public operations", async () => {
    const root = await tempRepo();

    const plan = validateProductionOnboardingPublicOperationsApproval({
      root,
      section: "supportRoute",
      evidenceRef: "support@example.com",
    });
    const result = await approveProductionOnboardingPublicOperationsSection({
      root,
      section: "supportRoute",
      evidenceRef: "support@example.com",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const publicOps = await readPublicOperations(root);

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("raw URL or contact");
    expect(publicOps.supportRoute).toMatchObject({
      status: "PENDING_APPROVAL",
      evidenceRef: "REPLACE-ME-SUPPORT-ROUTE-REF",
    });
    expect(JSON.stringify(result.report)).not.toContain("support@example.com");
  });

  it("runs the CLI approval flow and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "approve-production-onboarding-public-operations.mjs");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--section",
        "privacy-notice",
        "--evidence-ref",
        "PRIVACY-NOTICE-2026-010",
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );
    const afterBlocked = await readPublicOperations(root);

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(afterBlocked.privacyNotice.status).toBe("PENDING_APPROVAL");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--section",
        "privacy-notice",
        "--evidence-ref",
        "PRIVACY-NOTICE-2026-010",
        "--json",
        "--output",
        "reports/public-operations-approval.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "public-operations-approval.json"), "utf8"));
    const publicOps = await readPublicOperations(root);

    expect(run.status).toBe(0);
    expect(report.status).toBe("SECTION_APPROVED");
    expect(JSON.stringify(report)).not.toContain("PRIVACY-NOTICE-2026-010");
    expect(publicOps.privacyNotice).toMatchObject({
      status: "APPROVED",
      evidenceRef: "PRIVACY-NOTICE-2026-010",
    });
  });
});
