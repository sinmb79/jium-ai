import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TRUSTED_KEY_REGISTRY_VERSION, AUTHORIZED_FEED_SIGNATURE_ALGORITHM } from "@/scripts/check-authorized-feed-keys.mjs";
import {
  formatTrustedKeyCandidateReviewMarkdown,
  reviewTrustedKeyCandidateFile,
} from "../scripts/review-trusted-key-candidate.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-trusted-key-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "data"), { recursive: true });
  await writeFile(
    path.join(dir, "data", "trusted-authorized-feed-keys.json"),
    JSON.stringify({ version: TRUSTED_KEY_REGISTRY_VERSION, keys: [] }, null, 2),
    "utf8",
  );
  return dir;
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    keyId: "partner-key-2026-06",
    issuerName: "Authorized Partner",
    algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
    publicKeyJwk: {
      kty: "RSA",
      n: "public-modulus-for-cli-review",
      e: "AQAB",
      use: "sig",
    },
    validFrom: "2026-06-01T00:00:00.000Z",
    validUntil: "2027-06-01T00:00:00.000Z",
    ...overrides,
  };
}

async function writeCandidate(root: string, value = candidate()) {
  const filePath = path.join(root, "candidate.json");
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  return filePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("trusted key candidate review script", () => {
  it("reviews a candidate and writes a registry patch without leaking raw key material into the report", async () => {
    const root = await tempRepo();
    await writeCandidate(root);

    const result = await reviewTrustedKeyCandidateFile({
      root,
      candidatePath: "candidate.json",
      patchOutputPath: "dist/trusted-key-patch.json",
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });
    const patch = JSON.parse(await readFile(path.join(root, "dist", "trusted-key-patch.json"), "utf8"));
    const reportText = JSON.stringify(result.report);
    const markdown = formatTrustedKeyCandidateReviewMarkdown(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("READY_FOR_APPROVAL");
    expect(result.report.key.fingerprint).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.report.patch.written).toBe(true);
    expect(patch.keys).toHaveLength(1);
    expect(patch.keys[0].publicKeyJwk.n).toBe("public-modulus-for-cli-review");
    expect(reportText).not.toContain("public-modulus-for-cli-review");
    expect(markdown).toContain("JiumAI Trusted Key Candidate Review");
  });

  it("blocks private key material and does not write a patch", async () => {
    const root = await tempRepo();
    await writeCandidate(root, candidate({ publicKeyJwk: { kty: "RSA", n: "public-modulus", e: "AQAB", d: "private-exponent", key_ops: ["sign"] } }));

    const result = await reviewTrustedKeyCandidateFile({
      root,
      candidatePath: "candidate.json",
      patchOutputPath: "dist/blocked-patch.json",
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("private JWK field: d");
    expect(result.report.errors.join("\n")).toContain("private usage: sign");
    await expect(readFile(path.join(root, "dist", "blocked-patch.json"), "utf8")).rejects.toThrow();
  });

  it("keeps missing rotation dates as reviewable instead of silently ready", async () => {
    const root = await tempRepo();
    const value = candidate();
    delete (value as { validUntil?: string }).validUntil;
    await writeCandidate(root, value);

    const result = await reviewTrustedKeyCandidateFile({
      root,
      candidatePath: "candidate.json",
      generatedAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-06-01T00:00:00.000Z"),
    });

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("NEEDS_REVIEW");
    expect(result.report.warnings.join("\n")).toContain("validUntil is missing");
    expect(result.report.patch.written).toBe(false);
  });
});
