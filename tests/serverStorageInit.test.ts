import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildServerStorageInitPlan,
  formatServerStorageInitMarkdown,
} from "../scripts/init-server-storage.mjs";

const tempDirs: string[] = [];

async function tempDir(prefix: string) {
  const dir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server storage initializer", () => {
  it("creates repo-external storage directories without leaking absolute paths in the report", async () => {
    const root = await tempDir("jium-storage-init-root");
    const storageRoot = await tempDir("jium-storage-init-private");

    const plan = buildServerStorageInitPlan({
      root,
      storageRoot,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const markdown = formatServerStorageInitMarkdown(plan);

    expect((await stat(path.join(storageRoot, "audit-ledger"))).isDirectory()).toBe(true);
    expect((await stat(path.join(storageRoot, "account-registry"))).isDirectory()).toBe(true);
    expect(plan.status).toBe("READY");
    expect(plan.mode).toBe("DIRECTORY_ONLY");
    expect(plan.summary.readyDirectoryCount).toBe(2);
    expect(JSON.stringify(plan)).not.toContain(storageRoot);
    expect(markdown).toContain("JiumAI Server Storage Init Report");
    expect(markdown).not.toContain(storageRoot);
  });

  it("updates only placeholder storage keys in a private env file", async () => {
    const root = await tempDir("jium-storage-env-root");
    const storageRoot = await tempDir("jium-storage-env-private");
    await writeFile(
      path.join(root, ".env.server.local"),
      [
        "JIUM_SERVER_ROUTES=true",
        "INSTITUTION_AUDIT_LEDGER_DIR=REPLACE-ME-ABSOLUTE-SECURE-AUDIT-LEDGER-DIR",
        "INSTITUTION_ACCOUNT_REGISTRY_DIR=C:\\existing\\approved\\account-registry",
        "",
      ].join("\n"),
      "utf8",
    );

    const plan = buildServerStorageInitPlan({
      root,
      storageRoot,
      writeEnv: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, ".env.server.local"), "utf8");

    expect(plan.envFile.status).toBe("UPDATED");
    expect(plan.envFile.keyStatuses.INSTITUTION_AUDIT_LEDGER_DIR).toBe("UPDATED");
    expect(plan.envFile.keyStatuses.INSTITUTION_ACCOUNT_REGISTRY_DIR).toBe("PRESERVED");
    expect(envText).toContain(`INSTITUTION_AUDIT_LEDGER_DIR=${path.join(storageRoot, "audit-ledger")}`);
    expect(envText).toContain("INSTITUTION_ACCOUNT_REGISTRY_DIR=C:\\existing\\approved\\account-registry");
    expect(JSON.stringify(plan)).not.toContain(storageRoot);
    expect(JSON.stringify(plan)).not.toContain("C:\\existing\\approved");
  });

  it("runs the CLI and writes a redacted JSON report", async () => {
    const root = await tempDir("jium-storage-cli-root");
    const storageRoot = await tempDir("jium-storage-cli-private");
    const reportPath = path.join(root, "reports", "storage-init.json");
    const scriptPath = path.join(process.cwd(), "scripts", "init-server-storage.mjs");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--storage-root",
        storageRoot,
        "--write-env",
        "--env",
        ".env.server.local",
        "--json",
        "--output",
        reportPath,
      ],
      { cwd: root, encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const envText = await readFile(path.join(root, ".env.server.local"), "utf8");

    expect(run.status).toBe(0);
    expect(report.schema).toBe("jium-server-storage-init-v1");
    expect(report.status).toBe("READY");
    expect(JSON.stringify(report)).not.toContain(storageRoot);
    expect(envText).toContain(storageRoot);
  });

  it("rejects repository-contained storage roots", async () => {
    const root = await tempDir("jium-storage-repo-root");

    expect(() =>
      buildServerStorageInitPlan({
        root,
        storageRoot: path.join(root, "ops", "private", "server-storage"),
      }),
    ).toThrow(/outside the repository/);
  });
});
