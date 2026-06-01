import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
  buildOperationalLaunchCommandPacket,
  writeOperationalLaunchCommandPacketFiles,
} from "../scripts/build-operational-launch-inputs.mjs";
import {
  OPERATIONAL_LAUNCH_RECEIPT_SCHEMA,
  buildOperationalLaunchReceipt,
  formatOperationalLaunchReceiptMarkdown,
  writeOperationalLaunchReceiptFiles,
} from "../scripts/build-operational-launch-receipt.mjs";

const TRUSTED_KEY_REGISTRY_VERSION = "jium-authorized-feed-trusted-keys-v1";
const AUTHORIZED_FEED_SIGNATURE_ALGORITHM = "RSASSA-PKCS1-v1_5";
const tempDirs: string[] = [];

async function tempRepo(version = "0.3.101") {
  const dir = path.join(os.tmpdir(), `jium-launch-receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "data"), { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }, null, 2), "utf8");
  await writeFile(
    path.join(dir, ".env.server.local"),
    [
      "# JiumAI private server runtime env",
      "JIUM_SERVER_ROUTES=true",
      "INSTITUTION_ALLOWED_ORIGINS=REPLACE-ME-https-origin",
      "INSTITUTION_SECURE_COOKIES=true",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeJson(dir, "data/trusted-authorized-feed-keys.json", {
    version: TRUSTED_KEY_REGISTRY_VERSION,
    keys: [],
  });
  return dir;
}

async function writeJson(root: string, relativePath: string, value: unknown) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeHostedAudit(root: string) {
  const relativePath = "ops/private/production-onboarding/hosted-security-header-audit.json";
  await writeJson(root, relativePath, {
    schema: "jium-security-header-url-audit-v1",
    generatedAt: "2026-06-01T00:00:00.000Z",
    status: "READY",
    summary: {
      targetUrlState: "HTTPS",
      fetchState: "COMPLETED",
      httpStatus: 200,
      hasPath: true,
      hasQuery: false,
      hasFragment: false,
      checkedHeaderCount: 6,
      passCount: 6,
      failureCount: 0,
      missingCount: 0,
      mismatchCount: 0,
    },
    checks: [],
    errors: [],
    safetyNotes: ["The raw target URL, host, path, query, and response header values are intentionally omitted."],
  });
  return relativePath;
}

async function writeTrustedCandidate(root: string) {
  const relativePath = "ops/private/trusted-key-candidates/key.public-candidate.json";
  await writeJson(root, relativePath, {
    keyId: "institution-key-launch-receipt-2026",
    issuerName: "Authorized Support Center",
    algorithm: AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
    publicKeyJwk: {
      kty: "RSA",
      n: "public-modulus-for-launch-receipt",
      e: "AQAB",
      use: "sig",
      key_ops: ["verify"],
    },
    validFrom: "2026-06-01T00:00:00.000Z",
    validUntil: "2027-06-01T00:00:00.000Z",
  });
  return relativePath;
}

async function writeApprovalInputs(root: string) {
  const relativePath = "ops/private/production-onboarding/approved-operational-inputs.json";
  await writeJson(root, relativePath, {
    schema: "jium-operational-approval-inputs-v1",
    packageVersion: "0.3.101",
    operationalApprovalRecords: [],
    onboardingChecklist: [],
    storageDecisions: [],
    publicOperations: [],
  });
  return relativePath;
}

async function writeLaunchInputs(root: string) {
  const storageRoot = path.join(os.tmpdir(), `jium-launch-receipt-storage-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(storageRoot);
  const auditPath = await writeHostedAudit(root);
  const candidatePath = await writeTrustedCandidate(root);
  const approvalInputsPath = await writeApprovalInputs(root);
  const relativePath = "ops/private/production-onboarding/approved-launch-inputs.json";
  await writeJson(root, relativePath, {
    schema: OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
    packageVersion: "0.3.101",
    publicOperations: {
      publicBaseUrl: "https://prod.example.test/jium/",
      publicAppUrl: "https://prod.example.test/jium/",
      privacyNoticeUrl: "https://prod.example.test/jium/privacy/",
      supportRoute: "https://prod.example.test/jium/support/",
      hostedSecurityHeaderAuditReportPath: auditPath,
    },
    serverRuntime: {
      serverAllowedOrigins: ["https://ops.example.test"],
      serverOriginApprovalRef: "origin-ref-launch-receipt",
      trustedKeyCandidatePath: candidatePath,
      trustedKeyRegistryPatchPath: "ops/private/trusted-key-registry/key.registry-patch.json",
      trustedKeyApprovalRef: "trusted-key-ref-launch-receipt",
      auditLedgerDir: path.join(storageRoot, "audit-ledger"),
      accountRegistryDir: path.join(storageRoot, "account-registry"),
    },
    desktopRelease: {
      desktopReleaseChannel: "stable",
      desktopUpdateUrl: "https://updates.example.test/jium",
      desktopPublishApprovalRef: "desktop-publish-ref-launch-receipt",
      signedDesktopFeedDir: "dist/desktop",
    },
    approvalRecords: {
      approvedOperationalInputsPath: approvalInputsPath,
      approvalEvidenceDigest: `sha256-${"a".repeat(64)}`,
    },
    goLive: {
      incidentOwnerRef: "incident-owner-ref-launch-receipt",
    },
  });
  return relativePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational launch receipt", () => {
  it("builds a redacted receipt from private launch input and command packet", async () => {
    const root = await tempRepo();
    const inputPath = await writeLaunchInputs(root);
    const packet = buildOperationalLaunchCommandPacket({
      root,
      inputPath,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    writeOperationalLaunchCommandPacketFiles({ root, packet });

    const receipt = await buildOperationalLaunchReceipt({
      root,
      inputPath,
      generatedAt: "2026-06-02T00:01:00.000Z",
      now: Date.parse("2026-06-02T00:01:00.000Z"),
    });
    const markdown = formatOperationalLaunchReceiptMarkdown(receipt);
    const serialized = JSON.stringify(receipt);

    expect(receipt.schema).toBe(OPERATIONAL_LAUNCH_RECEIPT_SCHEMA);
    expect(receipt.status).toBe("BLOCKED");
    expect(receipt.summary.commandPacketStatus).toBe("READY");
    expect(receipt.summary.commandCount).toBe(13);
    expect(receipt.summary.inputDigestMatch).toBe("MATCH");
    expect(receipt.summary.goLiveStatus).toBe("BLOCKED");
    expect(receipt.leakScan.status).toBe("PASS");
    expect(markdown).toContain("Operational Launch Receipt");
    expect(markdown).toContain("Input digest match: MATCH");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("prod.example.test");
    expect(serialized).not.toContain("ops.example.test");
    expect(serialized).not.toContain("updates.example.test");
    expect(serialized).not.toContain("incident-owner-ref-launch-receipt");
    expect(serialized).not.toContain("origin-ref-launch-receipt");
  });

  it("detects launch input and private command packet digest mismatches", async () => {
    const root = await tempRepo();
    const inputPath = await writeLaunchInputs(root);
    const packet = buildOperationalLaunchCommandPacket({
      root,
      inputPath,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    writeOperationalLaunchCommandPacketFiles({ root, packet });
    await writeJson(root, "ops/private/production-onboarding/approved-launch-inputs.json", {
      schema: OPERATIONAL_LAUNCH_INPUTS_SCHEMA,
      packageVersion: "0.3.101",
      publicOperations: {
        publicBaseUrl: "https://changed.example.test/jium/",
        publicAppUrl: "https://changed.example.test/jium/",
        privacyNoticeUrl: "https://changed.example.test/jium/privacy/",
        supportRoute: "https://changed.example.test/jium/support/",
        hostedSecurityHeaderAuditReportPath: "ops/private/production-onboarding/hosted-security-header-audit.json",
      },
      serverRuntime: {
        serverAllowedOrigins: ["https://ops.example.test"],
        serverOriginApprovalRef: "origin-ref-launch-receipt",
        trustedKeyCandidatePath: "ops/private/trusted-key-candidates/key.public-candidate.json",
        trustedKeyRegistryPatchPath: "ops/private/trusted-key-registry/key.registry-patch.json",
        trustedKeyApprovalRef: "trusted-key-ref-launch-receipt",
        auditLedgerDir: path.join(os.tmpdir(), "jium-launch-receipt-mismatch", "audit-ledger"),
        accountRegistryDir: path.join(os.tmpdir(), "jium-launch-receipt-mismatch", "account-registry"),
      },
      desktopRelease: {
        desktopReleaseChannel: "stable",
        desktopUpdateUrl: "https://updates.example.test/jium",
        desktopPublishApprovalRef: "desktop-publish-ref-launch-receipt",
        signedDesktopFeedDir: "dist/desktop",
      },
      approvalRecords: {
        approvedOperationalInputsPath: "ops/private/production-onboarding/approved-operational-inputs.json",
        approvalEvidenceDigest: `sha256-${"a".repeat(64)}`,
      },
      goLive: {
        incidentOwnerRef: "incident-owner-ref-launch-receipt",
      },
    });

    const receipt = await buildOperationalLaunchReceipt({
      root,
      inputPath,
      generatedAt: "2026-06-02T00:01:00.000Z",
      now: Date.parse("2026-06-02T00:01:00.000Z"),
    });

    expect(receipt.summary.inputDigestMatch).toBe("MISMATCH_OR_MISSING");
    expect(receipt.status).toBe("BLOCKED");
    expect(receipt.nextActions.join("\n")).toContain("same private launch input file");
    expect(JSON.stringify(receipt)).not.toContain("changed.example.test");
  });

  it("writes reports and keeps CLI output paths constrained", async () => {
    const root = await tempRepo();
    const inputPath = await writeLaunchInputs(root);
    const packet = buildOperationalLaunchCommandPacket({
      root,
      inputPath,
      generatedAt: "2026-06-02T00:00:00.000Z",
    });
    writeOperationalLaunchCommandPacketFiles({ root, packet });

    const receipt = await buildOperationalLaunchReceipt({
      root,
      inputPath,
      generatedAt: "2026-06-02T00:01:00.000Z",
      now: Date.parse("2026-06-02T00:01:00.000Z"),
    });
    const written = writeOperationalLaunchReceiptFiles({ root, receipt });
    const json = JSON.parse(await readFile(written.jsonPath, "utf8"));

    expect(json.schema).toBe(OPERATIONAL_LAUNCH_RECEIPT_SCHEMA);

    const scriptPath = path.join(process.cwd(), "scripts", "build-operational-launch-receipt.mjs");
    const run = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--input", inputPath, "--json", "--output", "reports/launch-receipt.json"],
      { encoding: "utf8" },
    );
    const cliReport = JSON.parse(await readFile(path.join(root, "reports", "launch-receipt.json"), "utf8"));

    expect(run.status).toBe(1);
    expect(cliReport.schema).toBe(OPERATIONAL_LAUNCH_RECEIPT_SCHEMA);
    expect(JSON.stringify(cliReport)).not.toContain("prod.example.test");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--input", inputPath, "--json", "--output", "../unsafe-launch-receipt.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
  });
});
