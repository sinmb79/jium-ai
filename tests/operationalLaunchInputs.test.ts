import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA,
  OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
  buildOperationalLaunchInputsTemplate,
  formatOperationalLaunchInputsReviewMarkdown,
  formatOperationalLaunchInputsTemplateMarkdown,
  reviewOperationalLaunchInputs,
  writeOperationalLaunchInputsTemplateFiles,
} from "../scripts/build-operational-launch-inputs.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.98") {
  const dir = path.join(os.tmpdir(), `jium-launch-inputs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

function validInputs(root: string) {
  const outside = path.join(os.tmpdir(), `jium-launch-inputs-storage-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(outside);
  return {
    schema: OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
    packageVersion: "0.3.98",
    publicOperations: {
      publicBaseUrl: "https://prod.example.test/jium",
      publicAppUrl: "https://prod.example.test/jium",
      privacyNoticeUrl: "https://prod.example.test/jium/privacy",
      supportRoute: "https://prod.example.test/jium/support",
      hostedSecurityHeaderAuditReportPath: "ops/private/production-onboarding/hosted-security-header-audit.json",
    },
    serverRuntime: {
      serverAllowedOrigins: ["https://ops.example.test"],
      serverOriginApprovalRef: "origin-ref-001",
      trustedKeyCandidatePath: "ops/private/trusted-key-candidates/key.public-candidate.json",
      trustedKeyRegistryPatchPath: "ops/private/trusted-key-registry/key.registry-patch.json",
      trustedKeyApprovalRef: "trusted-key-ref-001",
      auditLedgerDir: path.join(outside, "audit-ledger"),
      accountRegistryDir: path.join(outside, "account-registry"),
    },
    desktopRelease: {
      desktopReleaseChannel: "stable",
      desktopUpdateUrl: "https://updates.example.test/jium",
      desktopPublishApprovalRef: "desktop-publish-ref-001",
      signedDesktopFeedDir: path.join(outside, "signed-desktop"),
    },
    approvalRecords: {
      approvedOperationalInputsPath: "ops/private/production-onboarding/approved-operational-inputs.json",
      approvalEvidenceDigest: `sha256-${"a".repeat(64)}`,
    },
    goLive: {
      incidentOwnerRef: "incident-owner-ref-001",
    },
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

describe("operational launch inputs", () => {
  it("builds a safe private-fill launch inputs template", async () => {
    const root = await tempRepo();
    const template = buildOperationalLaunchInputsTemplate({
      root,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const markdown = formatOperationalLaunchInputsTemplateMarkdown(template);
    const serialized = JSON.stringify(template);

    expect(template.schema).toBe(OPERATIONAL_LAUNCH_INPUTS_SCHEMA);
    expect(template.status).toBe("READY_FOR_PRIVATE_FILL");
    expect(template.summary.totalInputCount).toBe(19);
    expect(template.summary.groupCounts["public-operations"]).toBe(5);
    expect(template.summary.groupCounts["server-runtime"]).toBe(7);
    expect(template.summary.groupCounts["desktop-release"]).toBe(4);
    expect(template.leakScan.status).toBe("PASS");
    expect(markdown).toContain("JiumAI Operational Launch Inputs Template");
    expect(markdown).toContain("ops:launch-inputs:review");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ghs_fake");
  });

  it("reviews filled private launch inputs without leaking raw values", async () => {
    const root = await tempRepo();
    await writeInput(root, "ops/private/production-onboarding/approved-launch-inputs.json", validInputs(root));

    const review = reviewOperationalLaunchInputs({
      root,
      inputPath: "ops/private/production-onboarding/approved-launch-inputs.json",
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const markdown = formatOperationalLaunchInputsReviewMarkdown(review);
    const serialized = JSON.stringify(review);

    expect(review.schema).toBe(OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA);
    expect(review.status).toBe("READY_FOR_OPERATOR_APPLY");
    expect(review.summary.readyInputCount).toBe(19);
    expect(review.summary.blockedInputCount).toBe(0);
    expect(review.leakScan.status).toBe("PASS");
    expect(review.commandPlan).toContain("npm run ops:go-live:check");
    expect(markdown).toContain("Ready inputs: 19/19");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("prod.example.test");
    expect(serialized).not.toContain("ops.example.test");
    expect(serialized).not.toContain("updates.example.test");
    expect(serialized).not.toContain("incident-owner-ref-001");
    expect(serialized).not.toContain("origin-ref-001");
  });

  it("blocks placeholders and unsafe incomplete values", async () => {
    const root = await tempRepo();
    const input = validInputs(root);
    input.publicOperations.publicBaseUrl = "<approved-https-public-base-url>";
    input.serverRuntime.serverAllowedOrigins = ["https://ops.example.test/path"];
    input.serverRuntime.serverOriginApprovalRef = "support@example.com";
    input.approvalRecords.approvalEvidenceDigest = "sha256-not-valid";
    await writeInput(root, "ops/private/production-onboarding/blocked-launch-inputs.json", input);

    const review = reviewOperationalLaunchInputs({
      root,
      inputPath: "ops/private/production-onboarding/blocked-launch-inputs.json",
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const serialized = JSON.stringify(review);

    expect(review.status).toBe("BLOCKED");
    expect(review.summary.blockedInputCount).toBeGreaterThanOrEqual(4);
    expect(review.errors.join("\n")).toContain("public-operations/publicBaseUrl");
    expect(review.errors.join("\n")).toContain("server-runtime/serverAllowedOrigins");
    expect(serialized).not.toContain("support@example.com");
    expect(serialized).not.toContain("ops.example.test");
  });

  it("writes template reports and guards CLI output paths", async () => {
    const root = await tempRepo();
    const template = buildOperationalLaunchInputsTemplate({
      root,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    const written = writeOperationalLaunchInputsTemplateFiles({ root, template });
    const json = JSON.parse(await readFile(written.jsonPath, "utf8"));
    const markdown = await readFile(written.markdownPath, "utf8");

    expect(json.schema).toBe(OPERATIONAL_LAUNCH_INPUTS_SCHEMA);
    expect(markdown).toContain("Required Groups");

    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-launch-inputs.mjs");
    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "template", "--root", root, "--json", "--output", "../unsafe-launch-inputs.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(existsSync(path.join(root, "..", "unsafe-launch-inputs.json"))).toBe(false);
  });

  it("runs the review CLI for automation", async () => {
    const root = await tempRepo();
    await writeInput(root, "ops/private/production-onboarding/approved-launch-inputs.json", validInputs(root));
    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-launch-inputs.mjs");
    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "review",
        "--root",
        root,
        "--input",
        "ops/private/production-onboarding/approved-launch-inputs.json",
        "--json",
        "--output",
        "reports/launch-inputs-review.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "launch-inputs-review.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(report.schema).toBe(OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA);
    expect(report.status).toBe("READY_FOR_OPERATOR_APPLY");
    expect(report.summary.readyInputCount).toBe(19);
  });
});
