import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTrustedKeyOnboardingBundle } from "../scripts/init-trusted-key-onboarding.mjs";
import {
  TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA,
  buildTrustedKeyApprovalCandidate,
  formatTrustedKeyApprovalCandidateMarkdown,
} from "../scripts/build-trusted-key-approval-candidate.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-trusted-key-approval-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version: "0.3.91" }, null, 2), "utf8");
  return dir;
}

async function readyOnboarding(root: string) {
  const privateKeyDir = path.join(os.tmpdir(), `jium-private-key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(privateKeyDir);
  const result = await buildTrustedKeyOnboardingBundle({
    root,
    privateKeyDir,
    keyId: "institution-key-2026-06",
    issuerName: "Authorized Support Center",
    validFrom: "2026-06-01T00:00:00.000Z",
    validUntil: "2027-06-01T00:00:00.000Z",
    generatedAt: "2026-06-01T00:00:00.000Z",
    now: Date.parse("2026-06-01T00:00:00.000Z"),
  });
  const privateKey = JSON.parse(await readFile(path.join(privateKeyDir, "institution-key-2026-06.private.jwk.json"), "utf8"));
  const candidate = JSON.parse(await readFile(path.join(root, "ops", "private", "production-onboarding", "institution-key-2026-06.public-candidate.json"), "utf8"));
  return { result, privateKey, candidate };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("trusted key approval candidate", () => {
  it("builds a redacted approval candidate from trusted-key onboarding artifacts", async () => {
    const root = await tempRepo();
    const { privateKey, candidate } = await readyOnboarding(root);

    const result = await buildTrustedKeyApprovalCandidate({
      root,
      generatedAt: "2026-06-01T01:00:00.000Z",
    });
    const markdown = formatTrustedKeyApprovalCandidateMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.schema).toBe(TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA);
    expect(result.report.status).toBe("READY_FOR_TRUSTED_KEY_APPROVAL");
    expect(result.report.key.keyId).toBe("institution-key-2026-06");
    expect(result.report.key.fingerprint).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.privateKey.pathState).toBe("REPO_EXTERNAL");
    expect(result.report.source.sourceReportDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.summary.readyArtifactCount).toBe(2);
    expect(result.report.artifacts.every((artifact) => artifact.digest.match(/^sha256-[a-f0-9]{64}$/))).toBe(true);
    expect(markdown).toContain("JiumAI Trusted Key Approval Candidate");
    expect(serialized).not.toContain(candidate.publicKeyJwk.n);
    expect(serialized).not.toContain(privateKey.d);
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("Authorized Support Center");
  });

  it("writes a blocked evidence report when onboarding artifacts are missing", async () => {
    const root = await tempRepo();

    const result = await buildTrustedKeyApprovalCandidate({
      root,
      generatedAt: "2026-06-01T01:00:00.000Z",
    });
    const canonical = await readFile(
      path.join(root, "dist", "trusted-key-approval-candidate", "trusted-key-approval-candidate-report.md"),
      "utf8",
    );

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("trusted key onboarding report is missing");
    expect(result.report.summary.artifactCount).toBe(0);
    expect(canonical).toContain("Status: BLOCKED");
  });

  it("redacts unsafe onboarding report paths in blocked reports", async () => {
    const root = await tempRepo();
    const outsidePath = path.join(os.tmpdir(), `jium-outside-onboarding-${Date.now()}.json`);

    const result = await buildTrustedKeyApprovalCandidate({
      root,
      onboardingReportPath: outsidePath,
      generatedAt: "2026-06-01T01:00:00.000Z",
    });

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.source.onboardingReportPath).toBe("[REDACTED_OUTSIDE_REPOSITORY]");
    expect(JSON.stringify(result.report)).not.toContain(outsidePath);
  });

  it("blocks unsafe registry-patch artifacts without leaking the unsafe value", async () => {
    const root = await tempRepo();
    const { privateKey } = await readyOnboarding(root);
    const patchPath = path.join(root, "dist", "trusted-key-onboarding", "institution-key-2026-06.registry-patch.json");
    const patch = JSON.parse(await readFile(patchPath, "utf8"));
    patch.keys[0].publicKeyJwk.d = privateKey.d;
    await writeFile(patchPath, JSON.stringify(patch, null, 2), "utf8");

    const result = await buildTrustedKeyApprovalCandidate({
      root,
      generatedAt: "2026-06-01T01:00:00.000Z",
    });
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.summary.unsafeFindingCount).toBeGreaterThanOrEqual(1);
    expect(result.report.artifacts.find((artifact) => artifact.label === "registry patch")?.digest).toBe("");
    expect(serialized).toContain("private-jwk-field");
    expect(serialized).not.toContain(privateKey.d);
  });

  it("runs the CLI and rejects unsafe output paths before writing", async () => {
    const root = await tempRepo();
    await readyOnboarding(root);
    const scriptPath = path.join(process.cwd(), "scripts", "build-trusted-key-approval-candidate.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--json", "--output", "../unsafe-report.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
    expect(existsSync(path.join(root, "..", "unsafe-report.json"))).toBe(false);

    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--json", "--output", "reports/trusted-key-approval-candidate.json"],
      { encoding: "utf8" },
    );
    const output = JSON.parse(await readFile(path.join(root, "reports", "trusted-key-approval-candidate.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(output.schema).toBe(TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA);
    expect(output.status).toBe("READY_FOR_TRUSTED_KEY_APPROVAL");
    expect(JSON.stringify(output)).not.toContain(root);
  });
});
