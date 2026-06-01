import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProductionOnboardingReport,
  formatProductionOnboardingMarkdown,
  validateProductionOnboarding,
} from "../scripts/check-production-onboarding.mjs";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  writeProductionOnboardingScaffold,
} from "../scripts/init-production-onboarding.mjs";
import { REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES } from "../scripts/check-operational-approval-records.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.58") {
  const dir = path.join(os.tmpdir(), `jium-production-onboarding-check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

function tempStorageRoot() {
  const dir = path.join(os.tmpdir(), `jium-production-onboarding-storage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  return dir;
}

async function writeReadyServerEnv(root: string, storageRoot: string, hostedSecurityHeaderAuditReport = "") {
  await writeFile(
    path.join(root, ".env.server.local"),
    [
      "JIUM_SERVER_ROUTES=true",
      "NODE_ENV=production",
      `INSTITUTION_SESSION_SECRET=${"s".repeat(48)}`,
      "INSTITUTION_ALLOWED_ORIGINS=https://agency.example",
      "INSTITUTION_SECURE_COOKIES=true",
      `INSTITUTION_AUDIT_LEDGER_DIR=${path.join(storageRoot, "audit-ledger")}`,
      "INSTITUTION_AUDIT_LEDGER_FILE=institution-auth-audit-ledger.jsonl",
      `INSTITUTION_ACCOUNT_REGISTRY_DIR=${path.join(storageRoot, "account-registry")}`,
      "JIUM_PUBLIC_APP_URL=https://prod.example/jium/",
      "JIUM_PRIVACY_NOTICE_URL=https://prod.example/jium/privacy/",
      "JIUM_SUPPORT_CONTACT_ROUTE=https://prod.example/jium/support/",
      hostedSecurityHeaderAuditReport ? `JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT=${hostedSecurityHeaderAuditReport}` : "",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function writeReadyApprovalRecords(root: string, version = "0.3.58") {
  await writeFile(
    path.join(root, "ops", "private", "operational-approval-records.json"),
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

async function writeReadyChecklist(root: string, version = "0.3.58") {
  const dir = path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR);
  const checklist = JSON.parse(await readFile(path.join(dir, "operator-checklist.json"), "utf8"));
  checklist.packageVersion = version;
  checklist.status = "APPROVED";
  checklist.records = checklist.records.map((record: Record<string, unknown>, index: number) => ({
    ...record,
    status: "APPROVED",
    evidenceRef: `ONBOARDING-${String(index + 1).padStart(2, "0")}`,
  }));
  await writeFile(path.join(dir, "operator-checklist.json"), `${JSON.stringify(checklist, null, 2)}\n`, "utf8");
}

async function writeReadyStorageDecision(root: string, version = "0.3.58") {
  const dir = path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR);
  const decision = JSON.parse(await readFile(path.join(dir, "storage-decision.template.json"), "utf8"));
  decision.packageVersion = version;
  decision.status = "APPROVED";
  decision.auditLedgerStorage.status = "APPROVED";
  decision.auditLedgerStorage.evidenceRef = "STORAGE-AUDIT-2026";
  decision.accountRegistryStorage.status = "APPROVED";
  decision.accountRegistryStorage.evidenceRef = "STORAGE-ACCOUNT-2026";
  await writeFile(path.join(dir, "storage-decision.template.json"), `${JSON.stringify(decision, null, 2)}\n`, "utf8");
}

async function writeReadyPublicOperations(root: string, version = "0.3.58") {
  const dir = path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR);
  const publicOps = JSON.parse(await readFile(path.join(dir, "public-operations.template.json"), "utf8"));
  publicOps.packageVersion = version;
  publicOps.status = "APPROVED";
  publicOps.publicApp.status = "APPROVED";
  publicOps.publicApp.evidenceRef = "PUBLIC-APP-2026";
  publicOps.privacyNotice.status = "APPROVED";
  publicOps.privacyNotice.evidenceRef = "PRIVACY-NOTICE-2026";
  publicOps.supportRoute.status = "APPROVED";
  publicOps.supportRoute.evidenceRef = "SUPPORT-ROUTE-2026";
  await writeFile(path.join(dir, "public-operations.template.json"), `${JSON.stringify(publicOps, null, 2)}\n`, "utf8");
}

async function writeHostedSecurityHeaderAudit(root: string, status: "READY" | "BLOCKED" = "READY") {
  const reportPath = path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "hosted-security-header-audit.json");
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        schema: "jium-security-header-url-audit-v1",
        generatedAt: "2026-06-01T00:00:00.000Z",
        status,
        summary: {
          targetUrlState: "HTTPS",
          fetchState: "COMPLETED",
          httpStatus: 200,
          checkedHeaderCount: 6,
          passCount: status === "READY" ? 6 : 0,
          failureCount: status === "READY" ? 0 : 6,
          missingCount: status === "READY" ? 0 : 6,
          mismatchCount: 0,
        },
        checks: [],
        errors: status === "READY" ? [] : [{ code: "SECURITY_HEADER_MISSING", header: "Content-Security-Policy" }],
        safetyNotes: ["The raw target URL, host, path, query, and response header values are intentionally omitted."],
      },
      null,
      2,
    ),
    "utf8",
  );
  return path.relative(root, reportPath).replace(/\\/g, "/");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("production onboarding readiness", () => {
  it("blocks placeholder scaffolds while keeping reports redacted", async () => {
    const root = await tempRepo();
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });

    const readiness = validateProductionOnboarding({ root });
    const report = buildProductionOnboardingReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatProductionOnboardingMarkdown(report);
    const serialized = JSON.stringify(report);

    expect(readiness.valid).toBe(false);
    expect(report.status).toBe("BLOCKED");
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toEqual(
      expect.arrayContaining(["server-env", "operator-checklist", "storage-decision", "approval-records"]),
    );
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toContain("public-operations");
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toContain("hosted-security-header-audit");
    expect(report.nextActions.join("\n")).toContain("ops:onboarding:approve-checklist");
    expect(markdown).toContain("JiumAI Production Onboarding Readiness Report");
    expect(serialized).not.toContain("INSTITUTION_SESSION_SECRET=");
    expect(serialized).not.toContain(root);
  });

  it("accepts completed private onboarding records without leaking raw values", async () => {
    const root = await tempRepo();
    const storageRoot = tempStorageRoot();
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    const hostedSecurityHeaderAudit = await writeHostedSecurityHeaderAudit(root);
    await mkdir(path.join(root, "ops", "private"), { recursive: true });
    await writeReadyServerEnv(root, storageRoot, hostedSecurityHeaderAudit);
    await writeReadyApprovalRecords(root);
    await writeReadyChecklist(root);
    await writeReadyStorageDecision(root);
    await writeReadyPublicOperations(root);

    const readiness = validateProductionOnboarding({ root });
    const report = buildProductionOnboardingReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const serialized = JSON.stringify(report);

    expect(readiness.valid).toBe(true);
    expect(report.status).toBe("READY");
    expect(report.summary.hostedSecurityHeaderAuditStatus).toBe("READY");
    expect(report.checks.every((check) => check.status === "PASS")).toBe(true);
    expect(serialized).not.toContain("agency.example");
    expect(serialized).not.toContain("prod.example");
    expect(serialized).not.toContain("hosted-security-header-audit.json");
    expect(serialized).not.toContain(storageRoot);
    expect(serialized).not.toContain("ssssssss");
  });

  it("blocks missing or blocked hosted security header audit evidence without leaking report paths", async () => {
    const root = await tempRepo();
    const storageRoot = tempStorageRoot();
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    const hostedSecurityHeaderAudit = await writeHostedSecurityHeaderAudit(root, "BLOCKED");
    await mkdir(path.join(root, "ops", "private"), { recursive: true });
    await writeReadyServerEnv(root, storageRoot, hostedSecurityHeaderAudit);
    await writeReadyApprovalRecords(root);
    await writeReadyChecklist(root);
    await writeReadyStorageDecision(root);
    await writeReadyPublicOperations(root);

    const readiness = validateProductionOnboarding({ root });
    const report = buildProductionOnboardingReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const serialized = JSON.stringify(report);

    expect(readiness.valid).toBe(false);
    expect(report.checks.find((check) => check.id === "hosted-security-header-audit")?.status).toBe("BLOCKED");
    expect(report.summary.hostedSecurityHeaderFailureCount).toBe(6);
    expect(readiness.errors.join("\n")).toContain("hosted security header audit report is not READY");
    expect(serialized).not.toContain("hosted-security-header-audit.json");
    expect(serialized).not.toContain(root);
  });

  it("blocks incomplete public operations env and approval records without leaking URLs", async () => {
    const root = await tempRepo();
    const storageRoot = tempStorageRoot();
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    await mkdir(path.join(root, "ops", "private"), { recursive: true });
    await writeReadyServerEnv(root, storageRoot);
    await writeReadyApprovalRecords(root);
    await writeReadyChecklist(root);
    await writeReadyStorageDecision(root);

    await writeFile(
      path.join(root, ".env.server.local"),
      [
        "JIUM_SERVER_ROUTES=true",
        "NODE_ENV=production",
        `INSTITUTION_SESSION_SECRET=${"s".repeat(48)}`,
        "INSTITUTION_ALLOWED_ORIGINS=https://agency.example",
        "INSTITUTION_SECURE_COOKIES=true",
        `INSTITUTION_AUDIT_LEDGER_DIR=${path.join(storageRoot, "audit-ledger")}`,
        "INSTITUTION_AUDIT_LEDGER_FILE=institution-auth-audit-ledger.jsonl",
        `INSTITUTION_ACCOUNT_REGISTRY_DIR=${path.join(storageRoot, "account-registry")}`,
        "JIUM_PUBLIC_APP_URL=http://prod.example/jium/",
        "JIUM_PRIVACY_NOTICE_URL=https://prod.example/jium/privacy/",
        "JIUM_SUPPORT_CONTACT_ROUTE=",
        "",
      ].join("\n"),
      "utf8",
    );

    const readiness = validateProductionOnboarding({ root });
    const report = buildProductionOnboardingReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const serialized = JSON.stringify(report);

    expect(readiness.valid).toBe(false);
    expect(report.checks.find((check) => check.id === "public-operations")?.status).toBe("BLOCKED");
    expect(readiness.errors.join("\n")).toContain("public operations env JIUM_PUBLIC_APP_URL must be HTTPS");
    expect(readiness.errors.join("\n")).toContain("public operations template status must be APPROVED");
    expect(serialized).not.toContain("prod.example");
    expect(serialized).not.toContain("agency.example");
  });

  it("runs the CLI JSON report and exits blocked for incomplete onboarding", async () => {
    const root = await tempRepo();
    writeProductionOnboardingScaffold({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    const scriptPath = path.join(process.cwd(), "scripts", "check-production-onboarding.mjs");

    const run = spawnSync(process.execPath, [scriptPath, "--json", "--root", root], {
      cwd: root,
      encoding: "utf8",
    });
    const report = JSON.parse(run.stdout);

    expect(run.status).toBe(1);
    expect(report.status).toBe("BLOCKED");
    expect(run.stdout).not.toContain("INSTITUTION_SESSION_SECRET=");
    expect(run.stdout).not.toContain(root);
  });
});
