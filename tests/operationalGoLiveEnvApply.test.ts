import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SERVER_RUNTIME_ENV_PATH } from "../scripts/init-server-runtime-env.mjs";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
} from "../scripts/check-operational-approval-records.mjs";
import {
  applyOperationalGoLiveEnv,
  formatOperationalGoLiveEnvApplyMarkdown,
  validateOperationalGoLiveEnvApply,
} from "../scripts/apply-operational-go-live-env.mjs";
import { summarizeOperationalGoLiveEnv } from "../scripts/check-operational-go-live.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.79") {
  const dir = path.join(os.tmpdir(), `jium-go-live-env-apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "ops", "private"), { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  await writeFile(
    path.join(dir, DEFAULT_SERVER_RUNTIME_ENV_PATH),
    [
      "# JiumAI private server runtime env",
      "JIUM_PUBLIC_APP_URL=https://prod.example/jium/",
      "JIUM_PRIVACY_NOTICE_URL=https://prod.example/jium/privacy/",
      "JIUM_SUPPORT_CONTACT_ROUTE=https://prod.example/jium/support/",
      "",
    ].join("\n"),
    "utf8",
  );
  return dir;
}

async function writeApprovalPacket(root: string, status: "APPROVED" | "PENDING_APPROVAL" = "APPROVED", version = "0.3.79") {
  await writeFile(
    path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH),
    JSON.stringify(
      {
        schema: "jium-operational-approval-records-v1",
        generatedAt: "2026-06-01T00:00:00.000Z",
        packageVersion: version,
        releaseTag: `v${version}`,
        publicAppUrlStatus: "SET_HTTPS",
        privacyNoticeUrlStatus: "SET_HTTPS",
        records: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type, index) => ({
          id: status === "APPROVED" ? `approval-${index + 1}` : `REPLACE-ME-approval-${index + 1}`,
          type,
          status,
          approvedAt: "2026-06-01T00:00:00.000Z",
          approvedByRef: status === "APPROVED" ? `APPROVER-OPS-2026-${index + 1}` : `REPLACE-ME-approver-${index + 1}`,
          referenceId: status === "APPROVED" ? `OPS-APPROVAL-2026-${index + 1}` : `REPLACE-ME-OPS-${index + 1}`,
          scope: status === "APPROVED" ? `release-v${version}-${type.toLowerCase()}` : `REPLACE-ME-release-v${version}`,
          evidenceDigest: `sha256-${String(index + 1).repeat(64).slice(0, 64)}`,
          expiresAt: "2027-06-01T00:00:00.000Z",
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
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

describe("operational go-live env apply", () => {
  it("applies go-live approval env flags from ready private approval records with redacted reports", async () => {
    const root = await tempRepo();
    await writeApprovalPacket(root);

    const result = await applyOperationalGoLiveEnv({
      root,
      incidentOwnerRef: "INCIDENT-OWNER-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");
    const env = parseEnv(envText);
    const summary = summarizeOperationalGoLiveEnv(env as NodeJS.ProcessEnv);
    const reportText = JSON.stringify(result.report);
    const markdown = formatOperationalGoLiveEnvApplyMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("APPLIED");
    expect(env.JIUM_GO_LIVE_APPROVAL).toBe("APPROVED");
    expect(env.JIUM_LEGAL_REVIEW_APPROVAL).toBe("APPROVED");
    expect(env.JIUM_RELEASE_EVIDENCE_REVIEW).toBe("APPROVED");
    expect(env.JIUM_DATA_RETENTION_POLICY_ACK).toBe("APPROVED");
    expect(env.JIUM_INCIDENT_RESPONSE_OWNER).toBe("INCIDENT-OWNER-2026-001");
    expect(summary.JIUM_GO_LIVE_APPROVAL).toBe("APPROVED");
    expect(summary.JIUM_INCIDENT_RESPONSE_OWNER).toBe("SET");
    expect(result.report.summary.approvalFlagCount).toBe(4);
    expect(result.report.evidence.incidentOwnerRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(markdown).toContain("JiumAI Operational Go-Live Env Apply");
    expect(reportText).not.toContain(root);
    expect(reportText).not.toContain("INCIDENT-OWNER-2026-001");
    expect(reportText).not.toContain("APPROVER-OPS-2026");
    expect(reportText).not.toContain("OPS-APPROVAL-2026");
    expect(reportText).not.toContain("prod.example");
  });

  it("blocks incomplete approval records and unsafe incident owner refs without changing env", async () => {
    const root = await tempRepo();
    await writeApprovalPacket(root, "PENDING_APPROVAL");
    const before = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    const plan = validateOperationalGoLiveEnvApply({
      root,
      incidentOwnerRef: "owner@example.com",
    });
    const result = await applyOperationalGoLiveEnv({
      root,
      incidentOwnerRef: "owner@example.com",
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const after = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    expect(plan.valid).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("approval records readiness must be READY");
    expect(result.report.errors.join("\n")).toContain("incidentOwnerRef contains raw URL or contact value");
    expect(after).toBe(before);
    expect(JSON.stringify(result.report)).not.toContain("owner@example.com");
  });

  it("runs the CLI and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    await writeApprovalPacket(root);
    const scriptPath = path.join(process.cwd(), "scripts", "apply-operational-go-live-env.mjs");

    const blocked = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--incident-owner-ref",
        "INCIDENT-OWNER-2026-010",
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );
    const afterBlocked = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(afterBlocked).not.toContain("JIUM_GO_LIVE_APPROVAL=APPROVED");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--incident-owner-ref",
        "INCIDENT-OWNER-2026-010",
        "--json",
        "--output",
        "reports/go-live-env.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "go-live-env.json"), "utf8"));
    const envText = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    expect(run.status).toBe(0);
    expect(report.status).toBe("APPLIED");
    expect(JSON.stringify(report)).not.toContain("INCIDENT-OWNER-2026-010");
    expect(envText).toContain("JIUM_GO_LIVE_APPROVAL=APPROVED");
    expect(envText).toContain("JIUM_INCIDENT_RESPONSE_OWNER=INCIDENT-OWNER-2026-010");
  });
});
