import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUTHORIZED_FEED_SIGNATURE_ALGORITHM, TRUSTED_KEY_REGISTRY_VERSION } from "@/scripts/check-authorized-feed-keys.mjs";
import {
  applyTrustedKeyRegistryPatch,
  formatTrustedKeyRegistryApplyMarkdown,
  validateTrustedKeyRegistryPatchApplication,
} from "../scripts/apply-trusted-key-registry-patch.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.73") {
  const dir = path.join(os.tmpdir(), `jium-trusted-key-apply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "data"), { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  await writeRegistry(dir, []);
  return dir;
}

async function writeRegistry(root: string, keys: unknown[]) {
  await writeFile(
    path.join(root, "data", "trusted-authorized-feed-keys.json"),
    JSON.stringify({ version: TRUSTED_KEY_REGISTRY_VERSION, keys }, null, 2),
    "utf8",
  );
}

function key(overrides: Record<string, unknown> = {}) {
  return {
    keyId: "institution-key-apply-2026-06",
    issuerName: "Authorized Support Center",
    algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
    publicKeyJwk: {
      kty: "RSA",
      n: "public-modulus-for-registry-apply",
      e: "AQAB",
      use: "sig",
      key_ops: ["verify"],
    },
    validFrom: "2026-06-01T00:00:00.000Z",
    validUntil: "2027-06-01T00:00:00.000Z",
    ...overrides,
  };
}

async function writePatch(root: string, keys: unknown[], relativePath = "dist/trusted-key-onboarding/approved.patch.json") {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify({ version: TRUSTED_KEY_REGISTRY_VERSION, keys }, null, 2), "utf8");
  return relativePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("trusted key registry patch apply", () => {
  it("applies an approved registry patch and writes redacted evidence", async () => {
    const root = await tempRepo();
    const patchPath = await writePatch(root, [key()]);

    const result = await applyTrustedKeyRegistryPatch({
      root,
      patchPath,
      approvalRef: "APPROVAL-TRUSTED-KEY-2026-001",
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const registry = JSON.parse(await readFile(path.join(root, "data", "trusted-authorized-feed-keys.json"), "utf8"));
    const reportMarkdown = await readFile(path.join(root, "dist", "trusted-key-onboarding", "trusted-key-apply-report.md"), "utf8");
    const reportText = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("APPLIED");
    expect(result.report.summary.activeKeyCount).toBe(1);
    expect(result.report.approval.approvalRefStatus).toBe("SET_REDACTED");
    expect(result.report.approval.approvalRefDigest).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(registry.keys).toHaveLength(1);
    expect(registry.keys[0].publicKeyJwk.n).toBe("public-modulus-for-registry-apply");
    expect(reportMarkdown).toContain("JiumAI Trusted Key Registry Apply");
    expect(formatTrustedKeyRegistryApplyMarkdown(result.report)).toContain("APPLIED");
    expect(reportText).not.toContain(root);
    expect(reportText).not.toContain("APPROVAL-TRUSTED-KEY-2026-001");
    expect(reportText).not.toContain("public-modulus-for-registry-apply");
    expect(result.report.nextActions.join("\n")).toContain("security:server-readiness");
  });

  it("blocks unapproved patch application without changing the registry", async () => {
    const root = await tempRepo();
    await writeRegistry(root, [key({ keyId: "existing-key" })]);
    const patchPath = await writePatch(root, [key()]);

    const result = await applyTrustedKeyRegistryPatch({
      root,
      patchPath,
      approvalRef: "",
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const registry = JSON.parse(await readFile(path.join(root, "data", "trusted-authorized-feed-keys.json"), "utf8"));

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("approval reference is required");
    expect(registry.keys).toHaveLength(1);
    expect(registry.keys[0].keyId).toBe("existing-key");
  });

  it("blocks invalid or private-key patch material before writing the registry", async () => {
    const root = await tempRepo();
    const patchPath = await writePatch(root, [
      key({
        publicKeyJwk: {
          kty: "RSA",
          n: "public-modulus-for-invalid-patch",
          e: "AQAB",
          d: "private-exponent",
          key_ops: ["sign"],
        },
      }),
    ]);

    const plan = validateTrustedKeyRegistryPatchApplication({
      root,
      patchPath,
      approvalRef: "APPROVAL-TRUSTED-KEY-2026-002",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const result = await applyTrustedKeyRegistryPatch({
      root,
      patchPath,
      approvalRef: "APPROVAL-TRUSTED-KEY-2026-002",
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const registry = JSON.parse(await readFile(path.join(root, "data", "trusted-authorized-feed-keys.json"), "utf8"));

    expect(plan.valid).toBe(false);
    expect(plan.errors.join("\n")).toContain("private JWK field: d");
    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(JSON.stringify(result.report)).not.toContain("private-exponent");
    expect(registry.keys).toHaveLength(0);
  });

  it("runs the CLI apply flow on an approved patch and writes a redacted report", async () => {
    const root = await tempRepo();
    const patchPath = await writePatch(root, [key()]);
    const scriptPath = path.join(process.cwd(), "scripts", "apply-trusted-key-registry-patch.mjs");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--patch",
        patchPath,
        "--approval-ref",
        "APPROVAL-TRUSTED-KEY-2026-CLI",
        "--json",
        "--output",
        "reports/apply-report.json",
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(await readFile(path.join(root, "reports", "apply-report.json"), "utf8"));
    const registry = JSON.parse(await readFile(path.join(root, "data", "trusted-authorized-feed-keys.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(report.status).toBe("APPLIED");
    expect(registry.keys).toHaveLength(1);
    expect(JSON.stringify(report)).not.toContain("APPROVAL-TRUSTED-KEY-2026-CLI");
    expect(JSON.stringify(report)).not.toContain("public-modulus-for-registry-apply");
  });

  it("rejects unsafe CLI output paths before applying the registry patch", async () => {
    const root = await tempRepo();
    const patchPath = await writePatch(root, [key()]);
    const scriptPath = path.join(process.cwd(), "scripts", "apply-trusted-key-registry-patch.mjs");

    const run = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--root",
        root,
        "--patch",
        patchPath,
        "--approval-ref",
        "APPROVAL-TRUSTED-KEY-2026-UNSAFE-OUTPUT",
        "--json",
        "--output",
        "../unsafe-report.json",
      ],
      { encoding: "utf8" },
    );
    const registry = JSON.parse(await readFile(path.join(root, "data", "trusted-authorized-feed-keys.json"), "utf8"));

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("output path must stay inside the repository");
    expect(registry.keys).toHaveLength(0);
  });
});
