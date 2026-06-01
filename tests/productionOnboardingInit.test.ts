import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCTION_ONBOARDING_DIR,
  formatProductionOnboardingMarkdown,
  writeProductionOnboardingScaffold,
} from "../scripts/init-production-onboarding.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.57") {
  const dir = path.join(os.tmpdir(), `jium-production-onboarding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("production onboarding scaffold", () => {
  it("creates private onboarding files without leaking generated secrets in the summary", async () => {
    const root = await tempRepo();

    const summary = writeProductionOnboardingScaffold({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const serverEnv = await readFile(path.join(root, ".env.server.local"), "utf8");
    const approvals = await readFile(path.join(root, "ops", "private", "operational-approval-records.json"), "utf8");
    const checklist = await readFile(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "operator-checklist.json"), "utf8");
    const readme = await readFile(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "README.md"), "utf8");
    const markdown = formatProductionOnboardingMarkdown(summary);
    const serialized = JSON.stringify(summary);

    expect(summary.artifacts.map((artifact) => artifact.status)).toEqual(["CREATED", "CREATED", "CREATED", "CREATED", "CREATED", "CREATED", "CREATED"]);
    expect(serverEnv).toContain("INSTITUTION_SESSION_SECRET=");
    expect(serverEnv).toContain("REPLACE-ME-https-origin");
    expect(approvals).toContain("PENDING_APPROVAL");
    expect(checklist).toContain("PENDING_EXTERNAL_APPROVALS");
    expect(checklist).toContain("hosted-security-header-audit");
    expect(readme).toContain("Verification Order");
    expect(readme).toContain("ops:public-env:init");
    expect(readme).toContain("security:headers:check");
    expect(summary.nextCommands).toContain(
      "npm run security:headers:check -- <approved-https-public-app-url> --json --output ops/private/production-onboarding/hosted-security-header-audit.json",
    );
    expect(await readFile(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "public-operations.template.json"), "utf8")).toContain(
      "PENDING_PUBLIC_OPERATIONS_APPROVAL",
    );
    expect(markdown).toContain("JiumAI Production Onboarding Scaffold");
    expect(serialized).not.toContain("INSTITUTION_SESSION_SECRET=");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain(root);
  });

  it("does not overwrite existing private files unless forced", async () => {
    const root = await tempRepo();
    const first = writeProductionOnboardingScaffold({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: { JIUM_DESKTOP_RELEASE_TAG: "v0.3.57" },
    });
    const second = writeProductionOnboardingScaffold({
      root,
      generatedAt: "2026-06-01T00:00:01.000Z",
      env: { JIUM_DESKTOP_RELEASE_TAG: "v0.3.57" },
    });
    const forced = writeProductionOnboardingScaffold({
      root,
      generatedAt: "2026-06-01T00:00:02.000Z",
      env: { JIUM_DESKTOP_RELEASE_TAG: "v0.3.57" },
      force: true,
    });
    const readme = await readFile(path.join(root, DEFAULT_PRODUCTION_ONBOARDING_DIR, "README.md"), "utf8");

    expect(first.artifacts.every((artifact) => artifact.status === "CREATED")).toBe(true);
    expect(second.artifacts.every((artifact) => artifact.status === "EXISTS")).toBe(true);
    expect(forced.artifacts.every((artifact) => artifact.status === "CREATED")).toBe(true);
    expect(readme).toContain("2026-06-01T00:00:02.000Z");
  });

  it("runs the CLI in JSON mode against an alternate private directory", async () => {
    const root = await tempRepo();
    const scriptPath = path.join(process.cwd(), "scripts", "init-production-onboarding.mjs");

    const run = spawnSync(process.execPath, [scriptPath, "--json", "--dir", "ops/private/custom-onboarding"], {
      cwd: root,
      encoding: "utf8",
    });
    const summary = JSON.parse(run.stdout);

    expect(run.status).toBe(0);
    expect(summary.onboardingDir).toBe("ops/private/custom-onboarding");
    expect(summary.artifacts.some((artifact: { path: string }) => artifact.path === "ops/private/custom-onboarding/operator-checklist.json")).toBe(true);
    expect(summary.artifacts.some((artifact: { path: string }) => artifact.path === "ops/private/custom-onboarding/public-operations.template.json")).toBe(true);
    expect(run.stdout).not.toContain("INSTITUTION_SESSION_SECRET=");
  });
});
