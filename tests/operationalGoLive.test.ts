import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildOperationalGoLiveReport,
  formatOperationalGoLiveMarkdown,
  summarizeOperationalGoLiveEnv,
  validateOperationalGoLive,
} from "../scripts/check-operational-go-live.mjs";
import {
  DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH,
  REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES,
} from "../scripts/check-operational-approval-records.mjs";
import type { ProductionOnboardingReadiness } from "../scripts/check-production-onboarding.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-operational-go-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version: "0.3.49" }), "utf8");
  return dir;
}

async function writeApprovalPacket(root: string, version = "0.3.49") {
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

async function writeHostedSecurityHeaderAudit(root: string, status: "READY" | "BLOCKED" = "READY") {
  const filePath = path.join(root, "dist", "security-header-audit.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        schema: "jium-security-header-url-audit-v1",
        generatedAt: "2026-06-01T00:00:00.000Z",
        status,
        summary: {
          targetUrlState: "HTTPS",
          fetchState: "COMPLETED",
          httpStatus: 200,
          checkedHeaderCount: 6,
          passCount: status === "READY" ? 6 : 0,
          failureCount: status === "READY" ? 0 : 6,
          missingCount: status === "READY" ? 0 : 6,
          mismatchCount: 0,
        },
        checks: [],
        errors: status === "READY" ? [] : [{ code: "SECURITY_HEADER_MISSING", header: "Content-Security-Policy" }],
        safetyNotes: ["The raw target URL, host, path, query, and response header values are intentionally omitted."],
      },
      null,
      2,
    ),
    "utf8",
  );
  return filePath;
}

function readyServerRuntime() {
  return {
    valid: true,
    errors: [],
    profile: "server-routes" as const,
    keyCount: 1,
    activeKeyCount: 1,
    templateFiles: [
      "api/institution/accounts/route.ts",
      "api/institution/audit-ledger/route.ts",
      "api/institution/login/route.ts",
      "api/institution/logout/route.ts",
      "api/institution/session/route.ts",
    ],
    envSummary: {
      JIUM_SERVER_ROUTES: "TRUE" as const,
      GITHUB_PAGES: "NOT_TRUE" as const,
      INSTITUTION_SESSION_SECRET: "SET" as const,
      NEXT_PUBLIC_INSTITUTION_SESSION_SECRET: "NOT_SET" as const,
      INSTITUTION_ALLOWED_ORIGINS: "SET" as const,
      INSTITUTION_ALLOWED_ORIGINS_COUNT: 1,
      INSTITUTION_AUDIT_LEDGER_DIR: "SET" as const,
      INSTITUTION_ACCOUNT_REGISTRY_DIR: "SET" as const,
      INSTITUTION_SECURE_COOKIES: "DEFAULT_OR_TRUE" as const,
    },
    storage: {
      valid: true,
      errors: [],
      writeProbe: "ENABLED" as const,
      summary: {
        requiredDirectoryCount: 2,
        configuredDirectoryCount: 2,
        readyDirectoryCount: 2,
      },
      targets: [],
    },
  };
}

function readyDesktopPublish() {
  return {
    valid: true,
    errors: [],
    packageVersion: "0.3.49",
    releaseTag: "v0.3.49",
    releaseTagVersion: "0.3.49",
    envSummary: {
      JIUM_DESKTOP_RELEASE_TAG: "SET" as const,
      JIUM_DESKTOP_PUBLISH_APPROVAL: "APPROVED" as const,
      GITHUB_REPOSITORY: "SET" as const,
      GITHUB_TOKEN: "SET" as const,
    },
    distribution: {
      valid: true,
      errors: [],
    },
    releaseReadiness: {
      valid: true,
      errors: [],
    },
    updateFeed: {
      valid: true,
      errors: [],
      metadata: {
        file: "latest.yml",
        version: "0.3.49",
        path: "JiumAI-0.3.49-win-x64.exe",
        releaseDate: "2026-06-01T00:00:00.000Z",
        fileCount: 2,
      },
      artifacts: [
        {
          path: "JiumAI-0.3.49-win-x64.exe",
          bytes: 123,
          sha512Status: "MATCH" as const,
          sizeStatus: "MATCH" as const,
        },
      ],
    },
    publishArtifacts: {
      valid: true,
      errors: [],
      files: ["JiumAI-0.3.49-win-x64.exe", "JiumAI-0.3.49-win-x64.exe.blockmap", "latest.yml"],
    },
  };
}

function readyProductionOnboarding(valid = true): ProductionOnboardingReadiness {
  return {
    valid,
    errors: valid ? [] : ["operator checklist status must be APPROVED"],
    packageVersion: "0.3.49",
    onboardingDir: "ops/private/production-onboarding",
    requiredFiles: [
      { fileName: "README.md", status: "FOUND" },
      { fileName: "operator-checklist.json", status: "FOUND" },
      { fileName: "storage-decision.template.json", status: "FOUND" },
      { fileName: "public-operations.template.json", status: "FOUND" },
      { fileName: "trusted-key-candidate.example.json", status: "FOUND" },
    ],
    serverEnv: {
      fileStatus: "FOUND",
      JIUM_SERVER_ROUTES: "TRUE",
      INSTITUTION_SESSION_SECRET: "SET",
      INSTITUTION_ALLOWED_ORIGINS: "SET",
      storageStatus: valid ? "READY" : "BLOCKED",
    },
    approvalRecords: {
      valid,
      errors: valid ? [] : ["operational approval records file missing"],
      packageVersion: "0.3.49",
      expectedReleaseTag: "v0.3.49",
      sourceSummary: {
        JIUM_OPERATIONAL_APPROVAL_RECORDS: "SET",
        fileStatus: valid ? "FOUND" : "MISSING",
      },
      recordTypesPresent: valid ? [...REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES] : [],
      requiredRecordStatus: Object.fromEntries(
        REQUIRED_OPERATIONAL_APPROVAL_RECORD_TYPES.map((type) => [type, valid ? "APPROVED" : "MISSING"]),
      ) as ProductionOnboardingReadiness["approvalRecords"]["requiredRecordStatus"],
    },
    checklist: {
      valid,
      approvedRecordCount: valid ? 7 : 0,
      requiredRecordCount: 7,
      presentRecordIds: [
        "desktop-signing-evidence",
        "hosted-security-header-audit",
        "legal-go-live-approval",
        "public-operations-routes",
        "server-origin-approval",
        "server-storage-decision",
        "trusted-public-key-approval",
      ],
    },
    storageDecision: {
      valid,
      approvedSectionCount: valid ? 2 : 0,
      requiredSectionCount: 2,
    },
    publicOperations: {
      valid,
      approvedSectionCount: valid ? 3 : 0,
      requiredSectionCount: 3,
      httpsRouteCount: valid ? 3 : 0,
      requiredRouteCount: 3,
      envKeyStatuses: {
        JIUM_PUBLIC_APP_URL: valid ? "SET_HTTPS" : "MISSING",
        JIUM_PRIVACY_NOTICE_URL: valid ? "SET_HTTPS" : "MISSING",
        JIUM_SUPPORT_CONTACT_ROUTE: valid ? "SET_HTTPS" : "MISSING",
      },
    },
    hostedSecurityHeaderAudit: {
      valid,
      status: valid ? "READY" : "BLOCKED",
      envKeyStatus: valid ? "SET" : "MISSING",
      fileStatus: valid ? "FOUND" : "MISSING",
      targetUrlState: valid ? "HTTPS" : "",
      fetchState: valid ? "COMPLETED" : "",
      httpStatus: valid ? 200 : null,
      failureCount: valid ? 0 : 1,
    },
    trustedKeyExample: {
      valid: true,
    },
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational go-live readiness", () => {
  it("summarizes approvals and URLs without storing raw values", () => {
    const summary = summarizeOperationalGoLiveEnv({
      JIUM_GO_LIVE_APPROVAL: "APPROVED",
      JIUM_PUBLIC_APP_URL: "https://prod.example.com/jium",
      JIUM_PRIVACY_NOTICE_URL: "http://privacy.example.com",
      JIUM_SUPPORT_CONTACT_ROUTE: "support@example.com",
      JIUM_INCIDENT_RESPONSE_OWNER: "owner@example.com",
      JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: "C:/private/prod/security-header-audit.json",
    } as unknown as NodeJS.ProcessEnv);

    expect(summary.JIUM_GO_LIVE_APPROVAL).toBe("APPROVED");
    expect(summary.JIUM_PUBLIC_APP_URL).toBe("SET_HTTPS");
    expect(summary.JIUM_PRIVACY_NOTICE_URL).toBe("SET_NOT_HTTPS");
    expect(summary.JIUM_SUPPORT_CONTACT_ROUTE).toBe("SET_INVALID");
    expect(summary.JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT).toBe("SET");
    expect(JSON.stringify(summary)).not.toContain("prod.example.com");
    expect(JSON.stringify(summary)).not.toContain("support@example.com");
    expect(JSON.stringify(summary)).not.toContain("security-header-audit.json");
  });

  it("accepts a fully approved server and desktop launch profile", async () => {
    const root = await tempRepo();
    await writeApprovalPacket(root);
    const hostedSecurityHeaderAudit = await writeHostedSecurityHeaderAudit(root);
    const readiness = await validateOperationalGoLive({
      root,
      env: {
        JIUM_GO_LIVE_APPROVAL: "APPROVED",
        JIUM_LEGAL_REVIEW_APPROVAL: "APPROVED",
        JIUM_RELEASE_EVIDENCE_REVIEW: "APPROVED",
        JIUM_DATA_RETENTION_POLICY_ACK: "APPROVED",
        JIUM_PUBLIC_APP_URL: "https://prod.example.com/jium",
        JIUM_PRIVACY_NOTICE_URL: "https://prod.example.com/privacy",
        JIUM_SUPPORT_CONTACT_ROUTE: "https://prod.example.com/support",
        JIUM_INCIDENT_RESPONSE_OWNER: "owner-redacted",
        JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: hostedSecurityHeaderAudit,
      } as unknown as NodeJS.ProcessEnv,
      validations: {
        serverRuntime: readyServerRuntime(),
        desktopPublish: readyDesktopPublish(),
        productionOnboarding: readyProductionOnboarding(),
      },
    });
    const report = buildOperationalGoLiveReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatOperationalGoLiveMarkdown(report);

    expect(readiness.valid).toBe(true);
    expect(report.status).toBe("READY");
    expect(report.summary.hostedSecurityHeaderAuditStatus).toBe("READY");
    expect(report.summary.approvalRecordsStatus).toBe("READY");
    expect(report.checks.find((check) => check.id === "hosted-security-headers")?.status).toBe("PASS");
    expect(markdown).toContain("JiumAI Operational Go-Live Report");
    expect(markdown).not.toContain("prod.example.com");
    expect(markdown).not.toContain("owner-redacted");
    expect(markdown).not.toContain("security-header-audit.json");
  });

  it("blocks go-live when hosted security header audit evidence is missing or blocked", async () => {
    const root = await tempRepo();
    await writeApprovalPacket(root);
    const blockedHeaderAudit = await writeHostedSecurityHeaderAudit(root, "BLOCKED");
    const baseEnv = {
      JIUM_GO_LIVE_APPROVAL: "APPROVED",
      JIUM_LEGAL_REVIEW_APPROVAL: "APPROVED",
      JIUM_RELEASE_EVIDENCE_REVIEW: "APPROVED",
      JIUM_DATA_RETENTION_POLICY_ACK: "APPROVED",
      JIUM_PUBLIC_APP_URL: "https://prod.example.com/jium",
      JIUM_PRIVACY_NOTICE_URL: "https://prod.example.com/privacy",
      JIUM_SUPPORT_CONTACT_ROUTE: "https://prod.example.com/support",
      JIUM_INCIDENT_RESPONSE_OWNER: "owner-redacted",
    } as unknown as NodeJS.ProcessEnv;
    const validations = {
      serverRuntime: readyServerRuntime(),
      desktopPublish: readyDesktopPublish(),
      productionOnboarding: readyProductionOnboarding(),
    };

    const missing = await validateOperationalGoLive({ root, env: baseEnv, validations });
    const blocked = await validateOperationalGoLive({
      root,
      env: { ...baseEnv, JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: blockedHeaderAudit },
      validations,
    });
    const blockedReport = buildOperationalGoLiveReport(blocked, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(missing.valid).toBe(false);
    expect(missing.errors.join("\n")).toContain("operational hosted security header audit evidence missing");
    expect(blocked.valid).toBe(false);
    expect(blocked.errors.join("\n")).toContain("operational hosted security header audit report is not READY");
    expect(blockedReport.summary.hostedSecurityHeaderAuditStatus).toBe("BLOCKED");
    expect(blockedReport.checks.find((check) => check.id === "hosted-security-headers")?.status).toBe("BLOCKED");
  });

  it("blocks missing approvals and downstream readiness failures", async () => {
    const root = await tempRepo();
    const readiness = await validateOperationalGoLive({
      root,
      env: {} as unknown as NodeJS.ProcessEnv,
      validations: {
        serverRuntime: { ...readyServerRuntime(), valid: false, errors: ["trusted key registry: missing active key"] },
        desktopPublish: { ...readyDesktopPublish(), valid: false, errors: ["desktop publish update feed: missing latest.yml"] },
        productionOnboarding: readyProductionOnboarding(false),
      },
    });
    const report = buildOperationalGoLiveReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("JIUM_GO_LIVE_APPROVAL");
    expect(report.nextActions).toContain(
      "Apply approved go-live approval flags with npm run ops:go-live:env:apply.",
    );
    expect(report.nextActions).toContain(
      "Build npm run ops:release-dossier and npm run ops:approvals:digest-evidence before approving release evidence.",
    );
    expect(report.nextActions).toContain(
      "Prepare approved HTTPS public, privacy, and support routes with npm run ops:public-env:init before final go-live review.",
    );
    expect(report.nextActions).toContain(
      "Complete the private production onboarding checklist, build npm run ops:onboarding:digest-evidence, and run npm run ops:onboarding:check.",
    );
    expect(readiness.errors.join("\n")).toContain("operational approval records");
    expect(readiness.errors.join("\n")).toContain("operational production onboarding");
    expect(readiness.errors.join("\n")).toContain("operational server runtime");
    expect(readiness.errors.join("\n")).toContain("operational desktop publish");
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toEqual(
      expect.arrayContaining(["human-go-live-approval", "server-runtime", "desktop-publish"]),
    );
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toContain("approval-records");
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toContain("production-onboarding");
  });
});
