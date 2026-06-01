import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { summarizeServerRuntimeEnv, validateServerRuntimeReadiness } from "../scripts/check-server-readiness.mjs";
import {
  DEFAULT_SERVER_RUNTIME_ENV_PATH,
  writeServerRuntimeEnvTemplate,
} from "../scripts/init-server-runtime-env.mjs";
import {
  applyServerOriginApproval,
  formatServerOriginApprovalMarkdown,
  validateServerOriginApproval,
} from "../scripts/apply-server-origin-approval.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-server-origin-approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  writeServerRuntimeEnvTemplate({
    root: dir,
    generatedAt: "2026-06-01T00:00:00.000Z",
    secret: "s".repeat(48),
  });
  return dir;
}

function parseEnv(content: string) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server origin approval", () => {
  it("applies approved HTTPS origins to the private server env with a redacted report", async () => {
    const root = await tempRepo();

    const result = await applyServerOriginApproval({
      root,
      origins: ["https://agency.example", "https://partner.example:8443"],
      approvalRef: "SERVER-ORIGIN-APPROVAL-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");
    const env = parseEnv(envText);
    const summary = summarizeServerRuntimeEnv(env);
    const readiness = validateServerRuntimeReadiness({ root, env });
    const reportText = JSON.stringify(result.report);
    const markdown = formatServerOriginApprovalMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("APPLIED");
    expect(env.JIUM_SERVER_ROUTES).toBe("true");
    expect(env.INSTITUTION_SECURE_COOKIES).toBe("true");
    expect(env.INSTITUTION_ALLOWED_ORIGINS).toBe("https://agency.example,https://partner.example:8443");
    expect(summary.INSTITUTION_ALLOWED_ORIGINS_COUNT).toBe(2);
    expect(readiness.errors.join("\n")).not.toContain("INSTITUTION_ALLOWED_ORIGINS");
    expect(readiness.errors.join("\n")).not.toContain("JIUM_SERVER_ROUTES=true");
    expect(result.report.evidence.approvalRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.evidence.originListDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Server Origin Approval");
    expect(reportText).not.toContain(root);
    expect(reportText).not.toContain("agency.example");
    expect(reportText).not.toContain("partner.example");
    expect(reportText).not.toContain("SERVER-ORIGIN-APPROVAL-2026-001");
    expect(result.report.nextActions.join("\n")).toContain("security:server-readiness");
  });

  it("blocks unsafe origins and approval refs without changing the private env", async () => {
    const root = await tempRepo();
    const before = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    const plan = validateServerOriginApproval({
      root,
      origins: ["http://agency.example", "https://agency.example/path"],
      approvalRef: "ops@example.com",
    });
    const result = await applyServerOriginApproval({
      root,
      origins: ["http://agency.example", "https://agency.example/path"],
      approvalRef: "ops@example.com",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const after = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("origins must use HTTPS");
    expect(result.report.errors.join("\n")).toContain("origins must be origins only");
    expect(result.report.errors.join("\n")).toContain("approvalRef contains raw URL or contact value");
    expect(after).toBe(before);
    expect(JSON.stringify(result.report)).not.toContain("agency.example");
    expect(JSON.stringify(result.report)).not.toContain("ops@example.com");
  });

  it("allows common www subdomain HTTPS origins", async () => {
    const root = await tempRepo();

    const plan = validateServerOriginApproval({
      root,
      origins: ["https://www.agency.example"],
      approvalRef: "SERVER-ORIGIN-APPROVAL-2026-WWW",
    });

    expect(plan.valid).toBe(true);
    expect(plan.errors.join("\n")).not.toContain("invite, onion, or contact");
  });

  it("runs the CLI approval flow and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "apply-server-origin-approval.mjs");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--origin",
        "https://agency.example",
        "--approval-ref",
        "SERVER-ORIGIN-APPROVAL-2026-010",
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );
    const afterBlocked = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(afterBlocked).toContain("INSTITUTION_ALLOWED_ORIGINS=REPLACE-ME-https-origin");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--origin",
        "https://agency.example",
        "--origin",
        "https://partner.example",
        "--approval-ref",
        "SERVER-ORIGIN-APPROVAL-2026-010",
        "--json",
        "--output",
        "reports/server-origin-approval.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "server-origin-approval.json"), "utf8"));
    const envText = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    expect(run.status).toBe(0);
    expect(report.status).toBe("APPLIED");
    expect(JSON.stringify(report)).not.toContain("agency.example");
    expect(JSON.stringify(report)).not.toContain("SERVER-ORIGIN-APPROVAL-2026-010");
    expect(envText).toContain("INSTITUTION_ALLOWED_ORIGINS=https://agency.example,https://partner.example");
  });
});
