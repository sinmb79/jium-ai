import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildServerRuntimeReadinessReport,
  validateServerRuntimeReadiness,
} from "../scripts/check-server-readiness.mjs";
import {
  buildOperationalGoLiveReport,
  validateOperationalGoLive,
} from "../scripts/check-operational-go-live.mjs";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
} from "../scripts/check-operational-approval-records.mjs";
import type { ProductionOnboardingReadiness } from "../scripts/check-production-onboarding.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.82") {
  const dir = path.join(os.tmpdir(), `jium-server-env-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "data"), { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

async function writeRegistry(root: string) {
  await writeFile(
    path.join(root, "data", "trusted-authorized-feed-keys.json"),
    JSON.stringify(
      {
        version: "jium-authorized-feed-trusted-keys-v1",
        keys: [
          {
            keyId: "partner-key-2026-05",
            issuerName: "Authorized Partner",
            algorithm: "RSASSA-PKCS1-v1_5",
            publicKeyJwk: {
              kty: "RSA",
              n: "public-modulus-for-readiness-check",
              e: "AQAB",
              use: "sig",
            },
            validFrom: "2026-01-01T00:00:00.000Z",
            validUntil: "2027-01-01T00:00:00.000Z",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function writeRequiredRouteTemplates(root: string) {
  for (const relativePath of [
    "api/institution/accounts/route.ts",
    "api/institution/audit-ledger/route.ts",
    "api/institution/login/route.ts",
    "api/institution/logout/route.ts",
    "api/institution/session/route.ts",
  ]) {
    const target = path.join(root, "server-route-templates", "app", relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "export async function POST() { return new Response(); }\n", "utf8");
  }
}

async function writeServerEnv(root: string, values: Record<string, string>) {
  await writeFile(
    path.join(root, ".env.server.local"),
    ["\uFEFF# JiumAI private server runtime env", ...Object.entries(values).map(([key, value]) => `${key}=${value}`), ""].join("\n"),
    "utf8",
  );
}

async function writeApprovalPacket(root: string, version = "0.3.82") {
  const filePath = path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        schema: "jium-operational-approval-records-v1",
        generatedAt: "2026-06-01T00:00:00.000Z",
        packageVersion: version,
        releaseTag: `v${version}`,
        publicAppUrlStatus: "SET_HTTPS",
        privacyNoticeUrlStatus: "SET_HTTPS",
        records: REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type, index) => ({
          id: `approval-${index + 1}`,
          type,
          status: "APPROVED",
          approvedAt: "2026-06-01T00:00:00.000Z",
          approvedByRef: `approver-${index + 1}`,
          referenceId: `OPS-2026-${String(index + 1).padStart(4, "0")}`,
          scope: `release-v${version}`,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function writeHostedSecurityHeaderAudit(root: string) {
  const relativePath = "ops/private/production-onboarding/hosted-security-header-audit.json";
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        schema: "jium-security-header-url-audit-v1",
        generatedAt: "2026-06-01T00:00:00.000Z",
        status: "READY",
        summary: {
          targetUrlState: "HTTPS",
          fetchState: "COMPLETED",
          httpStatus: 200,
          checkedHeaderCount: 6,
          passCount: 6,
          failureCount: 0,
          missingCount: 0,
          mismatchCount: 0,
        },
        checks: [],
        errors: [],
        safetyNotes: ["redacted"],
      },
      null,
      2,
    ),
    "utf8",
  );
  return relativePath;
}

function storageEnv(root: string) {
  const storageRoot = path.join(os.tmpdir(), `${path.basename(root)}-private-storage`);
  tempDirs.push(storageRoot);
  return {
    INSTITUTION_AUDIT_LEDGER_DIR: path.join(storageRoot, "audit-ledger"),
    INSTITUTION_ACCOUNT_REGISTRY_DIR: path.join(storageRoot, "account-registry"),
  };
}

function readyDesktopPublish() {
  return {
    valid: true,
    errors: [],
    packageVersion: "0.3.82",
    releaseTag: "v0.3.82",
    releaseTagVersion: "0.3.82",
    envSummary: {
      JIUM_DESKTOP_RELEASE_TAG: "SET" as const,
      JIUM_DESKTOP_PUBLISH_APPROVAL: "APPROVED" as const,
      GITHUB_REPOSITORY: "SET" as const,
      GITHUB_TOKEN: "SET" as const,
    },
    distribution: { valid: true, errors: [] },
    releaseReadiness: { valid: true, errors: [] },
    updateFeed: {
      valid: true,
      errors: [],
      metadata: {
        file: "latest.yml",
        version: "0.3.82",
        path: "JiumAI-0.3.82-win-x64.exe",
        releaseDate: "2026-06-01T00:00:00.000Z",
        fileCount: 2,
      },
      artifacts: [{ path: "JiumAI-0.3.82-win-x64.exe", bytes: 123, sha512Status: "MATCH" as const, sizeStatus: "MATCH" as const }],
    },
    publishArtifacts: {
      valid: true,
      errors: [],
      files: ["JiumAI-0.3.82-win-x64.exe", "JiumAI-0.3.82-win-x64.exe.blockmap", "latest.yml"],
    },
    releaseEvidenceDigest: {
      valid: true,
      report: {
        status: "READY" as const,
        aggregateDigest: "sha256-desktop-release-evidence",
        summary: {
          fileCount: 5,
          readyFileCount: 5,
          unsafeFindingCount: 0,
          errorCount: 0,
        },
        errors: [],
      },
    },
  };
}

function readyProductionOnboarding(): ProductionOnboardingReadiness {
  return {
    valid: true,
    errors: [],
    packageVersion: "0.3.82",
    onboardingDir: "ops/private/production-onboarding",
    requiredFiles: [],
    serverEnv: {
      fileStatus: "FOUND",
      JIUM_SERVER_ROUTES: "TRUE",
      INSTITUTION_SESSION_SECRET: "SET",
      INSTITUTION_ALLOWED_ORIGINS: "SET",
      storageStatus: "READY",
    },
    approvalRecords: {
      valid: true,
      errors: [],
      packageVersion: "0.3.82",
      expectedReleaseTag: "v0.3.82",
      sourceSummary: { JIUM_OPERATIONAL_APPROVAL_RECORDS: "SET", fileStatus: "FOUND" },
      recordTypesPresent: [...REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES],
      requiredRecordStatus: Object.fromEntries(REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type) => [type, "APPROVED"])) as ProductionOnboardingReadiness["approvalRecords"]["requiredRecordStatus"],
    },
    checklist: { valid: true, approvedRecordCount: 7, requiredRecordCount: 7, presentRecordIds: [] },
    storageDecision: { valid: true, approvedSectionCount: 2, requiredSectionCount: 2 },
    publicOperations: {
      valid: true,
      approvedSectionCount: 3,
      requiredSectionCount: 3,
      httpsRouteCount: 3,
      requiredRouteCount: 3,
      envKeyStatuses: {
        JIUM_PUBLIC_APP_URL: "SET_HTTPS",
        JIUM_PRIVACY_NOTICE_URL: "SET_HTTPS",
        JIUM_SUPPORT_CONTACT_ROUTE: "SET_HTTPS",
      },
    },
    hostedSecurityHeaderAudit: {
      valid: true,
      status: "READY",
      envKeyStatus: "SET",
      fileStatus: "FOUND",
      targetUrlState: "HTTPS",
      fetchState: "COMPLETED",
      httpStatus: 200,
      failureCount: 0,
    },
    trustedKeyExample: { valid: true },
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server runtime private env loading", () => {
  it("loads .env.server.local for server readiness without leaking raw values", async () => {
    const root = await tempRepo();
    await writeRegistry(root);
    await writeRequiredRouteTemplates(root);
    const storage = storageEnv(root);
    await writeServerEnv(root, {
      JIUM_SERVER_ROUTES: "true",
      NODE_ENV: "production",
      INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
      INSTITUTION_AUDIT_LEDGER_DIR: storage.INSTITUTION_AUDIT_LEDGER_DIR,
      INSTITUTION_ACCOUNT_REGISTRY_DIR: storage.INSTITUTION_ACCOUNT_REGISTRY_DIR,
      INSTITUTION_SECURE_COOKIES: "true",
    });

    const readiness = validateServerRuntimeReadiness({ root, env: {} as NodeJS.ProcessEnv });
    const report = buildServerRuntimeReadinessReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const serialized = JSON.stringify(report);

    expect(readiness.valid).toBe(true);
    expect(readiness.envSummary.INSTITUTION_SESSION_SECRET).toBe("SET");
    expect(report.status).toBe("READY");
    expect(serialized).not.toContain("0123456789abcdef0123456789abcdef");
    expect(serialized).not.toContain("agency.example");
    expect(serialized).not.toContain(storage.INSTITUTION_AUDIT_LEDGER_DIR);
  });

  it("loads go-live env from .env.server.local while preserving process env override semantics", async () => {
    const root = await tempRepo();
    await writeRegistry(root);
    await writeRequiredRouteTemplates(root);
    await writeApprovalPacket(root);
    const auditReport = await writeHostedSecurityHeaderAudit(root);
    const storage = storageEnv(root);
    await writeServerEnv(root, {
      JIUM_SERVER_ROUTES: "true",
      NODE_ENV: "production",
      INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
      INSTITUTION_AUDIT_LEDGER_DIR: storage.INSTITUTION_AUDIT_LEDGER_DIR,
      INSTITUTION_ACCOUNT_REGISTRY_DIR: storage.INSTITUTION_ACCOUNT_REGISTRY_DIR,
      INSTITUTION_SECURE_COOKIES: "true",
      JIUM_GO_LIVE_APPROVAL: "APPROVED",
      JIUM_LEGAL_REVIEW_APPROVAL: "APPROVED",
      JIUM_RELEASE_EVIDENCE_REVIEW: "APPROVED",
      JIUM_DATA_RETENTION_POLICY_ACK: "APPROVED",
      JIUM_PUBLIC_APP_URL: "https://prod.example.com/jium",
      JIUM_PRIVACY_NOTICE_URL: "https://prod.example.com/privacy",
      JIUM_SUPPORT_CONTACT_ROUTE: "https://prod.example.com/support",
      JIUM_INCIDENT_RESPONSE_OWNER: "incident-owner-ref",
      JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: auditReport,
    });

    const readiness = await validateOperationalGoLive({
      root,
      env: {} as NodeJS.ProcessEnv,
      validations: {
        desktopPublish: readyDesktopPublish(),
        productionOnboarding: readyProductionOnboarding(),
      },
    });
    const overridden = await validateOperationalGoLive({
      root,
      env: { JIUM_GO_LIVE_APPROVAL: "DENIED" } as unknown as NodeJS.ProcessEnv,
      validations: {
        desktopPublish: readyDesktopPublish(),
        productionOnboarding: readyProductionOnboarding(),
      },
    });
    const report = buildOperationalGoLiveReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(readiness.valid).toBe(true);
    expect(readiness.envSummary.JIUM_PUBLIC_APP_URL).toBe("SET_HTTPS");
    expect(readiness.envSummary.JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT).toBe("SET");
    expect(report.status).toBe("READY");
    expect(JSON.stringify(report)).not.toContain("prod.example.com");
    expect(JSON.stringify(report)).not.toContain("incident-owner-ref");
    expect(overridden.valid).toBe(false);
    expect(overridden.envSummary.JIUM_GO_LIVE_APPROVAL).toBe("MISSING_OR_NOT_APPROVED");
  });
});
