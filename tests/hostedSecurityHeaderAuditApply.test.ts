import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyHostedSecurityHeaderAuditEnv,
  formatHostedSecurityHeaderAuditApplyMarkdown,
  validateHostedSecurityHeaderAuditApply,
} from "../scripts/apply-hosted-security-header-audit-env.mjs";
import {
  HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY,
  validateHostedSecurityHeaderAuditEvidence,
} from "../scripts/hosted-security-header-audit-evidence.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.81") {
  const dir = path.join(os.tmpdir(), `jium-hosted-audit-apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  await writeFile(
    path.join(dir, ".env.server.local"),
    ["# JiumAI private server runtime env", `${HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY}=REPLACE-ME-READY-HOSTED-SECURITY-HEADER-AUDIT-REPORT`, ""].join("\n"),
    "utf8",
  );
  return dir;
}

async function writeAuditReport(root: string, status: "READY" | "BLOCKED" = "READY", options: { bom?: boolean } = {}) {
  const relativePath = "ops/private/production-onboarding/hosted-security-header-audit.json";
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const report = {
    schema: "jium-security-header-url-audit-v1",
    generatedAt: "2026-06-01T00:00:00.000Z",
    status,
    summary: {
      targetUrlState: "HTTPS",
      fetchState: "COMPLETED",
      httpStatus: 200,
      hasPath: true,
      hasQuery: false,
      hasFragment: false,
      checkedHeaderCount: 6,
      passCount: status === "READY" ? 6 : 3,
      failureCount: status === "READY" ? 0 : 3,
      missingCount: status === "READY" ? 0 : 3,
      mismatchCount: 0,
    },
    checks: [],
    errors: status === "READY" ? [] : [{ code: "SECURITY_HEADER_MISSING", header: "Content-Security-Policy" }],
    safetyNotes: ["The raw target URL, host, path, query, and response header values are intentionally omitted."],
  };
  await writeFile(filePath, `${options.bom ? "\uFEFF" : ""}${JSON.stringify(report, null, 2)}`, "utf8");
  return { filePath, relativePath };
}

function valueForKey(envText: string, key: string) {
  return envText
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`))
    ?.slice(key.length + 1);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("hosted security header audit env apply", () => {
  it("applies a READY hosted audit report to the private server env without leaking paths", async () => {
    const root = await tempRepo();
    const audit = await writeAuditReport(root, "READY", { bom: true });

    const result = await applyHostedSecurityHeaderAuditEnv({
      root,
      auditReport: audit.relativePath,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, ".env.server.local"), "utf8");
    const auditEnvValue = valueForKey(envText, HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY);
    const evidence = validateHostedSecurityHeaderAuditEvidence({
      root,
      env: { [HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY]: auditEnvValue },
    });
    const serialized = JSON.stringify(result.report);
    const markdown = formatHostedSecurityHeaderAuditApplyMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("APPLIED");
    expect(auditEnvValue).toBe(audit.relativePath);
    expect(evidence.valid).toBe(true);
    expect(result.report.evidence.auditReportDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Hosted Security Header Audit Env Apply");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("hosted-security-header-audit.json");
    expect(serialized).not.toContain("prod.example.com");
  });

  it("blocks non-ready audit reports before modifying env", async () => {
    const root = await tempRepo();
    const audit = await writeAuditReport(root, "BLOCKED");

    const plan = validateHostedSecurityHeaderAuditApply({ root, auditReport: audit.relativePath });
    const result = await applyHostedSecurityHeaderAuditEnv({
      root,
      auditReport: audit.relativePath,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, ".env.server.local"), "utf8");

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("hosted security header audit report is not READY");
    expect(envText).toContain(`${HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY}=REPLACE-ME-READY-HOSTED-SECURITY-HEADER-AUDIT-REPORT`);
    expect(JSON.stringify(result.report)).not.toContain("hosted-security-header-audit.json");
  });

  it("runs the CLI and rejects unsafe output paths before writing env", async () => {
    const root = await tempRepo();
    const audit = await writeAuditReport(root);
    const scriptPath = path.join(process.cwd(), "scripts", "apply-hosted-security-header-audit-env.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--audit-report", audit.relativePath, "--json", "--output", "../unsafe-report.json"],
      { encoding: "utf8" },
    );
    const blockedEnvText = await readFile(path.join(root, ".env.server.local"), "utf8");

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(blockedEnvText).toContain(`${HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY}=REPLACE-ME-READY-HOSTED-SECURITY-HEADER-AUDIT-REPORT`);

    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--audit-report", audit.relativePath, "--json", "--output", "reports/hosted-audit-apply.json"],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "hosted-audit-apply.json"), "utf8"));
    const envText = await readFile(path.join(root, ".env.server.local"), "utf8");

    expect(run.status).toBe(0);
    expect(report.status).toBe("APPLIED");
    expect(JSON.stringify(report)).not.toContain("hosted-security-header-audit.json");
    expect(envText).toContain(`${HOSTED_SECURITY_HEADER_AUDIT_ENV_KEY}=${audit.relativePath}`);
  });
});
