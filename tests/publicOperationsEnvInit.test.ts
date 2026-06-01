import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPublicOperationsEnvPlan,
  formatPublicOperationsEnvMarkdown,
} from "../scripts/init-public-operations-env.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-public-ops-env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("public operations env initializer", () => {
  it("derives GitHub Pages public, privacy, and support routes without leaking URLs in reports", () => {
    const plan = buildPublicOperationsEnvPlan({
      env: { GITHUB_REPOSITORY: "sinmb79/jium-ai" } as unknown as NodeJS.ProcessEnv,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const markdown = formatPublicOperationsEnvMarkdown(plan);
    const serialized = JSON.stringify(plan);

    expect(plan.status).toBe("READY");
    expect(plan.summary.httpsUrlCount).toBe(3);
    expect(plan.endpoints.map((endpoint) => endpoint.routePath)).toEqual(["/", "/privacy/", "/support/"]);
    expect(plan.endpoints.every((endpoint) => endpoint.urlStatus === "SET_HTTPS")).toBe(true);
    expect(serialized).not.toContain("sinmb79.github.io");
    expect(serialized).not.toContain("sinmb79");
    expect(markdown).toContain("JiumAI Public Operations Env Init Report");
    expect(markdown).not.toContain("sinmb79.github.io");
  });

  it("updates only missing or placeholder public operation keys in a private env file", async () => {
    const root = await tempRepo();
    await writeFile(
      path.join(root, ".env.server.local"),
      [
        "JIUM_PUBLIC_APP_URL=REPLACE-ME-HTTPS-PUBLIC-APP-URL",
        "JIUM_PRIVACY_NOTICE_URL=https://approved.example/privacy",
        "JIUM_SUPPORT_CONTACT_ROUTE=",
        "",
      ].join("\n"),
      "utf8",
    );

    const plan = buildPublicOperationsEnvPlan({
      root,
      baseUrl: "https://sinmb79.github.io/jium-ai/",
      writeEnv: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const envText = await readFile(path.join(root, ".env.server.local"), "utf8");
    const serialized = JSON.stringify(plan);

    expect(plan.envFile.status).toBe("UPDATED");
    expect(plan.envFile.keyStatuses.JIUM_PUBLIC_APP_URL).toBe("UPDATED");
    expect(plan.envFile.keyStatuses.JIUM_PRIVACY_NOTICE_URL).toBe("PRESERVED");
    expect(plan.envFile.keyStatuses.JIUM_SUPPORT_CONTACT_ROUTE).toBe("UPDATED");
    expect(envText).toContain("JIUM_PUBLIC_APP_URL=https://sinmb79.github.io/jium-ai/");
    expect(envText).toContain("JIUM_PRIVACY_NOTICE_URL=https://approved.example/privacy");
    expect(envText).toContain("JIUM_SUPPORT_CONTACT_ROUTE=https://sinmb79.github.io/jium-ai/support/");
    expect(serialized).not.toContain("sinmb79.github.io");
    expect(serialized).not.toContain("approved.example");
  });

  it("runs the CLI and writes a redacted JSON report", async () => {
    const root = await tempRepo();
    const reportPath = path.join(root, "reports", "public-ops-env.json");
    const scriptPath = path.join(process.cwd(), "scripts", "init-public-operations-env.mjs");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--base-url",
        "https://sinmb79.github.io/jium-ai/",
        "--write-env",
        "--json",
        "--output",
        reportPath,
      ],
      { cwd: root, encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const envText = await readFile(path.join(root, ".env.server.local"), "utf8");

    expect(run.status).toBe(0);
    expect(report.schema).toBe("jium-public-operations-env-init-v1");
    expect(report.status).toBe("READY");
    expect(JSON.stringify(report)).not.toContain("sinmb79.github.io");
    expect(envText).toContain("JIUM_PRIVACY_NOTICE_URL=https://sinmb79.github.io/jium-ai/privacy/");
  });

  it("blocks non-HTTPS public base URLs and does not update env files", async () => {
    const root = await tempRepo();

    const plan = buildPublicOperationsEnvPlan({
      root,
      baseUrl: "http://example.com/jium",
      writeEnv: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(plan.status).toBe("BLOCKED");
    expect(plan.errors.join("\n")).toContain("HTTPS");
    await expect(readFile(path.join(root, ".env.server.local"), "utf8")).rejects.toThrow();
  });
});
