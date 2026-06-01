import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AUTHORIZED_FEED_SIGNATURE_ALGORITHM } from "@/scripts/check-authorized-feed-keys.mjs";
import {
  buildTrustedKeyOnboardingBundle,
  formatTrustedKeyOnboardingMarkdown,
  validateTrustedKeyOnboardingPlan,
} from "../scripts/init-trusted-key-onboarding.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-trusted-key-onboarding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("trusted key onboarding init", () => {
  it("creates a repo-external private key, public candidate, redacted report, and review patch", async () => {
    const root = await tempRepo();
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
    const patch = JSON.parse(await readFile(path.join(root, "dist", "trusted-key-onboarding", "institution-key-2026-06.registry-patch.json"), "utf8"));
    const markdown = formatTrustedKeyOnboardingMarkdown(result.report);
    const reportText = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("READY_FOR_APPROVAL");
    expect(result.report.review.status).toBe("READY_FOR_APPROVAL");
    expect(result.report.privateKey.pathState).toBe("REPO_EXTERNAL");
    expect(result.report.privateKey.fileStatus).toBe("WRITTEN");
    expect(privateKey.d).toEqual(expect.any(String));
    expect(candidate.algorithm).toBe(AUTHORIZED_FEED_SIGNATURE_ALGORITHM);
    expect(candidate.publicKeyJwk.kty).toBe("RSA");
    expect(candidate.publicKeyJwk.d).toBeUndefined();
    expect(candidate.publicKeyJwk.key_ops).toEqual(["verify"]);
    expect(patch.keys[0].keyId).toBe("institution-key-2026-06");
    expect(markdown).toContain("JiumAI Trusted Key Onboarding");
    expect(reportText).not.toContain(privateKeyDir);
    expect(reportText).not.toContain(candidate.publicKeyJwk.n);
    expect(reportText).not.toContain(privateKey.d);
    expect(result.report.nextActions.join("\n")).toContain("security:trusted-key:review");
  });

  it("blocks private key output inside the repository", async () => {
    const root = await tempRepo();
    const unsafeDir = path.join(root, "ops", "private", "keys");

    const plan = validateTrustedKeyOnboardingPlan({
      root,
      privateKeyDir: unsafeDir,
      keyId: "unsafe-key",
      issuerName: "Authorized Support Center",
      validFrom: "2026-06-01T00:00:00.000Z",
      validUntil: "2027-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });

    expect(plan.valid).toBe(false);
    expect(plan.errors.join("\n")).toContain("private key directory must be outside the repository");
    expect(existsSync(unsafeDir)).toBe(false);
  });
});
