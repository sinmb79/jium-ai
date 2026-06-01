import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildServerStorageReadinessReport,
  formatServerStorageReadinessMarkdown,
  validateServerStorageReadiness,
} from "../scripts/check-server-storage-readiness.mjs";

const tempDirs: string[] = [];

async function tempDir(prefix: string) {
  const dir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

function storageEnv(storageRoot: string, overrides: Record<string, string | undefined> = {}) {
  return {
    INSTITUTION_AUDIT_LEDGER_DIR: path.join(storageRoot, "audit-ledger"),
    INSTITUTION_ACCOUNT_REGISTRY_DIR: path.join(storageRoot, "account-registry"),
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server storage readiness", () => {
  it("accepts separate absolute writable directories outside the repository", async () => {
    const root = await tempDir("jium-storage-root");
    const storageRoot = await tempDir("jium-storage-private");

    const result = validateServerStorageReadiness({ root, env: storageEnv(storageRoot) });
    const report = buildServerStorageReadinessReport(result, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatServerStorageReadinessMarkdown(report);

    expect(result.valid).toBe(true);
    expect(report.status).toBe("READY");
    expect(report.summary.readyDirectoryCount).toBe(2);
    expect(markdown).toContain("JiumAI Server Storage Readiness Report");
    expect(JSON.stringify(report)).not.toContain(storageRoot);
  });

  it("blocks relative, placeholder, repository-contained, and nested storage paths", async () => {
    const root = await tempDir("jium-storage-root");
    const nestedRoot = await tempDir("jium-storage-nested");
    const relative = validateServerStorageReadiness({
      root,
      env: storageEnv(nestedRoot, { INSTITUTION_AUDIT_LEDGER_DIR: "ops/private/server-audit-ledger" }),
    });
    const placeholder = validateServerStorageReadiness({
      root,
      env: storageEnv(nestedRoot, {
        INSTITUTION_AUDIT_LEDGER_DIR: "REPLACE-ME-ABSOLUTE-AUDIT-DIR",
      }),
    });
    const insideRepo = validateServerStorageReadiness({
      root,
      env: storageEnv(nestedRoot, { INSTITUTION_AUDIT_LEDGER_DIR: path.join(root, "public", "audit") }),
    });
    const nested = validateServerStorageReadiness({
      root,
      env: storageEnv(nestedRoot, {
        INSTITUTION_AUDIT_LEDGER_DIR: nestedRoot,
        INSTITUTION_ACCOUNT_REGISTRY_DIR: path.join(nestedRoot, "account-registry"),
      }),
    });

    expect(relative.valid).toBe(false);
    expect(relative.errors.join("\n")).toContain("absolute path");
    expect(placeholder.valid).toBe(false);
    expect(placeholder.errors.join("\n")).toContain("placeholder");
    expect(insideRepo.valid).toBe(false);
    expect(insideRepo.errors.join("\n")).toContain("repository workspace");
    expect(insideRepo.errors.join("\n")).toContain("public static or build artifact");
    expect(nested.valid).toBe(false);
    expect(nested.errors.join("\n")).toContain("separate non-nested");
  });

  it("runs the CLI and writes redacted JSON reports", async () => {
    const root = await tempDir("jium-storage-cli-root");
    const storageRoot = await tempDir("jium-storage-cli-private");
    const reportPath = path.join(root, "reports", "storage.json");
    const scriptPath = path.join(process.cwd(), "scripts", "check-server-storage-readiness.mjs");

    const run = spawnSync(process.execPath, [scriptPath, "--json", "--output", reportPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...storageEnv(storageRoot) } as NodeJS.ProcessEnv,
    });
    const report = JSON.parse(await readFile(reportPath, "utf8"));

    expect(run.status).toBe(0);
    expect(report.status).toBe("READY");
    expect(JSON.stringify(report)).not.toContain(storageRoot);
  });

  it("blocks non-directory storage targets without leaking the raw path", async () => {
    const root = await tempDir("jium-storage-file-root");
    const storageRoot = await tempDir("jium-storage-file-private");
    const fileTarget = path.join(storageRoot, "not-a-directory");
    await writeFile(fileTarget, "occupied\n", "utf8");

    const result = validateServerStorageReadiness({
      root,
      env: storageEnv(storageRoot, { INSTITUTION_AUDIT_LEDGER_DIR: fileTarget }),
    });
    const report = buildServerStorageReadinessReport(result);

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("directory");
    expect(JSON.stringify(report)).not.toContain(fileTarget);
  });
});
