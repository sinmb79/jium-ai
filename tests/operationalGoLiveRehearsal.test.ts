import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OPERATIONAL_GO_LIVE_REHEARSAL_SCHEMA,
  formatOperationalGoLiveRehearsalMarkdown,
  runOperationalGoLiveRehearsal,
} from "../scripts/run-operational-go-live-rehearsal.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.83") {
  const dir = path.join(os.tmpdir(), `jium-go-live-rehearsal-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational go-live rehearsal", () => {
  it("runs a redacted temporary go-live rehearsal without writing private env into the source repo", async () => {
    const root = await tempRepo();

    const result = await runOperationalGoLiveRehearsal({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const markdown = formatOperationalGoLiveRehearsalMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.report.schema).toBe(OPERATIONAL_GO_LIVE_REHEARSAL_SCHEMA);
    expect(result.report.status).toBe("READY");
    expect(result.report.summary.goLiveStatus).toBe("READY");
    expect(result.report.summary.cleanedTemporaryWorkspace).toBe("YES");
    expect(result.report.simulation.desktopPublishMode).toBe("SIMULATED_SIGNED_ARTIFACTS");
    expect(result.report.checks.every((check) => check.status === "PASS")).toBe(true);
    expect(markdown).toContain("JiumAI Operational Go-Live Rehearsal");
    expect(existsSync(path.join(root, ".env.server.local"))).toBe(false);
    expect(existsSync(path.join(root, "ops"))).toBe(false);
    expect(existsSync(path.join(root, "dist", "operational-go-live-rehearsal", "operational-go-live-rehearsal-report.json"))).toBe(true);
    expect(serialized).not.toContain("0123456789abcdef0123456789abcdef");
    expect(serialized).not.toContain("ops.example.test");
    expect(serialized).not.toContain("prod.example.test");
    expect(serialized).not.toContain("incident-owner-ref");
    expect(serialized).not.toContain("synthetic-token");
  });

  it("supports CLI JSON output for rehearsal automation", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "run-operational-go-live-rehearsal.mjs");
    const outputPath = path.join(root, "reports", "rehearsal.json");

    const run = spawnSync(process.execPath, [scriptPath, "--root", root, "--json", "--output", outputPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    const serialized = JSON.stringify(report);

    expect(run.status).toBe(0);
    expect(report.schema).toBe(OPERATIONAL_GO_LIVE_REHEARSAL_SCHEMA);
    expect(report.status).toBe("READY");
    expect(report.summary.goLiveStatus).toBe("READY");
    expect(serialized).not.toContain("ops.example.test");
    expect(serialized).not.toContain("prod.example.test");
    expect(serialized).not.toContain("synthetic-token");
  });
});
