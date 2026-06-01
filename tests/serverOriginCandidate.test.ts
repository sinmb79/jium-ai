import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SERVER_ORIGIN_CANDIDATE_SCHEMA,
  buildServerOriginCandidate,
  formatServerOriginCandidateMarkdown,
} from "../scripts/build-server-origin-candidate.mjs";
import {
  DEFAULT_SERVER_RUNTIME_ENV_PATH,
  writeServerRuntimeEnvTemplate,
} from "../scripts/init-server-runtime-env.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-server-origin-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version: "0.3.90" }, null, 2), "utf8");
  writeServerRuntimeEnvTemplate({
    root: dir,
    generatedAt: "2026-06-01T00:00:00.000Z",
    secret: "s".repeat(48),
  });
  return dir;
}

async function appendEnv(root: string, lines: string[]) {
  const envPath = path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH);
  const current = await readFile(envPath, "utf8");
  await writeFile(envPath, `${current.trimEnd()}\n${lines.join("\n")}\n`, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server origin candidate", () => {
  it("derives a private server origin apply command from public operations env without leaking raw URLs", async () => {
    const root = await tempRepo();
    await appendEnv(root, [
      "JIUM_PUBLIC_APP_URL=https://jium-ai.netlify.app/",
      "JIUM_PRIVACY_NOTICE_URL=https://jium-ai.netlify.app/privacy/",
      "JIUM_SUPPORT_CONTACT_ROUTE=https://jium-ai.netlify.app/support/",
    ]);

    const result = await buildServerOriginCandidate({
      root,
      fromPublicEnv: true,
      approvalRefPlaceholder: "SERVER-ORIGIN-APPROVAL-REF",
      generatedAt: "2026-06-01T00:01:00.000Z",
    });
    const commandText = await readFile(path.join(root, "ops", "private", "server-origin-candidate", "server-origin-apply-command.md"), "utf8");
    const serialized = JSON.stringify(result.report);
    const markdown = formatServerOriginCandidateMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.schema).toBe(SERVER_ORIGIN_CANDIDATE_SCHEMA);
    expect(result.report.status).toBe("READY_FOR_ORIGIN_APPROVAL");
    expect(result.report.summary.originCount).toBe(1);
    expect(result.report.summary.sourceUrlReadyCount).toBe(3);
    expect(result.report.privateCommand.fileStatus).toBe("WRITTEN");
    expect(result.report.evidence.originListDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.evidence.privateCommandDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.nextActions.join("\n")).toContain("server:origin:apply");
    expect(commandText).toContain("https://jium-ai.netlify.app");
    expect(commandText).toContain("SERVER-ORIGIN-APPROVAL-REF");
    expect(serialized).not.toContain("jium-ai.netlify.app");
    expect(serialized).not.toContain("SERVER-ORIGIN-APPROVAL-REF");
    expect(markdown).toContain("JiumAI Server Origin Candidate");
  });

  it("blocks non-HTTPS public route candidates without writing the private command", async () => {
    const root = await tempRepo();
    await appendEnv(root, [
      "JIUM_PUBLIC_APP_URL=http://unsafe.example/",
      "JIUM_PRIVACY_NOTICE_URL=https://safe.example/privacy/",
      "JIUM_SUPPORT_CONTACT_ROUTE=https://safe.example/support/",
    ]);

    const result = await buildServerOriginCandidate({
      root,
      fromPublicEnv: true,
      generatedAt: "2026-06-01T00:01:00.000Z",
    });
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("source URL must use HTTPS");
    expect(result.report.privateCommand.fileStatus).toBe("NOT_WRITTEN");
    expect(existsSync(path.join(root, "ops", "private", "server-origin-candidate", "server-origin-apply-command.md"))).toBe(false);
    expect(serialized).not.toContain("unsafe.example");
    expect(serialized).not.toContain("safe.example");
  });

  it("runs the CLI and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    await appendEnv(root, [
      "JIUM_PUBLIC_APP_URL=https://jium-ai.netlify.app/",
      "JIUM_PRIVACY_NOTICE_URL=https://jium-ai.netlify.app/privacy/",
      "JIUM_SUPPORT_CONTACT_ROUTE=https://jium-ai.netlify.app/support/",
    ]);
    const scriptPath = path.join(process.cwd(), "scripts", "build-server-origin-candidate.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--from-public-env", "--json", "--output", "../unsafe-report.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(existsSync(path.join(root, "ops", "private", "server-origin-candidate", "server-origin-apply-command.md"))).toBe(false);

    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--from-public-env", "--json", "--output", "reports/server-origin-candidate.json"],
      { encoding: "utf8" },
    );
    const output = JSON.parse(await readFile(path.join(root, "reports", "server-origin-candidate.json"), "utf8"));
    const commandText = await readFile(path.join(root, "ops", "private", "server-origin-candidate", "server-origin-apply-command.md"), "utf8");

    expect(run.status).toBe(0);
    expect(output.status).toBe("READY_FOR_ORIGIN_APPROVAL");
    expect(output.schema).toBe(SERVER_ORIGIN_CANDIDATE_SCHEMA);
    expect(JSON.stringify(output)).not.toContain("jium-ai.netlify.app");
    expect(commandText).toContain("server:origin:apply");
  });
});
