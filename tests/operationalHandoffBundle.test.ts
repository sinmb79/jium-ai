import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildOperationalHandoffBundle } from "../scripts/build-operational-handoff-bundle.mjs";
import type { OperationalApprovalRecordsReadiness } from "../scripts/check-operational-approval-records.mjs";
import type { ProductionOnboardingReadiness } from "../scripts/check-production-onboarding.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.50") {
  const dir = path.join(os.tmpdir(), `jium-operational-handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

function serverRuntime(valid = true) {
  return {
    valid,
    errors: valid ? [] : ["trusted key registry: missing active key"],
    profile: "server-routes" as const,
    keyCount: valid ? 1 : 0,
    activeKeyCount: valid ? 1 : 0,
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
      valid,
      errors: valid ? [] : ["INSTITUTION_AUDIT_LEDGER_DIR must be outside the repository workspace"],
      writeProbe: "ENABLED" as const,
      summary: {
        requiredDirectoryCount: 2,
        configuredDirectoryCount: valid ? 2 : 1,
        readyDirectoryCount: valid ? 2 : 0,
      },
      targets: [],
    },
  };
}

function desktopPublish(valid = true) {
  return {
    valid,
    errors: valid ? [] : ["desktop publish update feed: missing latest.yml"],
    packageVersion: "0.3.50",
    releaseTag: "v0.3.50",
    releaseTagVersion: "0.3.50",
    envSummary: {
      JIUM_DESKTOP_RELEASE_TAG: "SET" as const,
      JIUM_DESKTOP_PUBLISH_APPROVAL: valid ? ("APPROVED" as const) : ("MISSING_OR_NOT_APPROVED" as const),
      GITHUB_REPOSITORY: "SET" as const,
      GITHUB_TOKEN: "SET" as const,
    },
    distribution: { valid: true, errors: [] },
    releaseReadiness: { valid: true, errors: [] },
    updateFeed: {
      valid,
      errors: valid ? [] : ["desktop update metadata missing: latest.yml"],
      metadata: {
        file: "latest.yml",
        version: valid ? "0.3.50" : "",
        path: "JiumAI-0.3.50-win-x64.exe",
        releaseDate: "2026-06-01T00:00:00.000Z",
        fileCount: valid ? 2 : 0,
      },
      artifacts: valid
        ? [
            {
              path: "JiumAI-0.3.50-win-x64.exe",
              bytes: 123,
              sha512Status: "MATCH" as const,
              sizeStatus: "MATCH" as const,
            },
          ]
        : [],
    },
    publishArtifacts: {
      valid,
      errors: valid ? [] : ["desktop publish Windows installer artifact missing: *.exe"],
      files: valid ? ["JiumAI-0.3.50-win-x64.exe", "JiumAI-0.3.50-win-x64.exe.blockmap", "latest.yml"] : [],
    },
    releaseEvidenceDigest: {
      valid,
      report: {
        status: valid ? ("READY" as const) : ("BLOCKED" as const),
        aggregateDigest: valid ? "sha256-desktop-release-evidence" : "",
        summary: {
          fileCount: valid ? 5 : 0,
          readyFileCount: valid ? 5 : 0,
          unsafeFindingCount: 0,
          errorCount: valid ? 0 : 1,
        },
        errors: valid ? [] : ["desktop release evidence digest report missing"],
      },
    },
  };
}

function approvalRecords(valid = true): OperationalApprovalRecordsReadiness {
  return {
    valid,
    errors: valid ? [] : ["operational approval records file missing"],
    packageVersion: "0.3.50",
    expectedReleaseTag: "v0.3.50",
    sourceSummary: {
      JIUM_OPERATIONAL_APPROVAL_RECORDS: "SET" as const,
      fileStatus: valid ? ("FOUND" as const) : ("MISSING" as const),
    },
    recordTypesPresent: valid
      ? [
          "DATA_RETENTION_POLICY_ACK",
          "GO_LIVE_APPROVAL",
          "INCIDENT_RESPONSE_OWNER_ASSIGNED",
          "LEGAL_REVIEW_APPROVAL",
          "RELEASE_EVIDENCE_REVIEW",
          "SUPPORT_CONTACT_ROUTE_ASSIGNED",
        ]
      : [],
    requiredRecordStatus: {
      GO_LIVE_APPROVAL: valid ? ("APPROVED" as const) : ("MISSING" as const),
      LEGAL_REVIEW_APPROVAL: "APPROVED" as const,
      RELEASE_EVIDENCE_REVIEW: "APPROVED" as const,
      DATA_RETENTION_POLICY_ACK: "APPROVED" as const,
      SUPPORT_CONTACT_ROUTE_ASSIGNED: "APPROVED" as const,
      INCIDENT_RESPONSE_OWNER_ASSIGNED: "APPROVED" as const,
    },
  };
}

function productionOnboarding(valid = true): ProductionOnboardingReadiness {
  return {
    valid,
    errors: valid ? [] : ["operator checklist status must be APPROVED"],
    packageVersion: "0.3.50",
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
    approvalRecords: approvalRecords(valid),
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
        JIUM_PUBLIC_APP_URL: valid ? ("SET_HTTPS" as const) : ("MISSING" as const),
        JIUM_PRIVACY_NOTICE_URL: valid ? ("SET_HTTPS" as const) : ("MISSING" as const),
        JIUM_SUPPORT_CONTACT_ROUTE: valid ? ("SET_HTTPS" as const) : ("MISSING" as const),
      },
    },
    hostedSecurityHeaderAudit: {
      valid,
      status: valid ? "READY" : "BLOCKED",
      envKeyStatus: valid ? ("SET" as const) : ("MISSING" as const),
      fileStatus: valid ? ("FOUND" as const) : ("MISSING" as const),
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

function goLive(valid = true) {
  return {
    valid,
    errors: valid ? [] : ["operational go-live approval missing: JIUM_GO_LIVE_APPROVAL=APPROVED"],
    envSummary: {
      JIUM_GO_LIVE_APPROVAL: valid ? ("APPROVED" as const) : ("MISSING_OR_NOT_APPROVED" as const),
      JIUM_LEGAL_REVIEW_APPROVAL: "APPROVED" as const,
      JIUM_RELEASE_EVIDENCE_REVIEW: "APPROVED" as const,
      JIUM_DATA_RETENTION_POLICY_ACK: "APPROVED" as const,
      JIUM_PUBLIC_APP_URL: "SET_HTTPS" as const,
      JIUM_PRIVACY_NOTICE_URL: "SET_HTTPS" as const,
      JIUM_SUPPORT_CONTACT_ROUTE: "SET_HTTPS" as const,
      JIUM_INCIDENT_RESPONSE_OWNER: "SET" as const,
      JIUM_OPERATIONAL_APPROVAL_RECORDS: "SET" as const,
      JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: "SET" as const,
    },
    serverRuntime: serverRuntime(valid),
    desktopPublish: desktopPublish(valid),
    approvalRecords: approvalRecords(valid),
    productionOnboarding: productionOnboarding(valid),
    hostedSecurityHeaderAudit: {
      valid: true,
      errors: [],
      sourceSummary: {
        JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: "SET" as const,
        fileStatus: "FOUND" as const,
        schema: "jium-security-header-url-audit-v1",
        status: "READY",
        targetUrlState: "HTTPS",
        fetchState: "COMPLETED",
        httpStatus: 200,
        checkedHeaderCount: 6,
        passCount: 6,
        failureCount: 0,
      },
    },
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational handoff bundle", () => {
  it("writes a ready redacted operational handoff packet", async () => {
    const root = await tempRepo();

    const result = await buildOperationalHandoffBundle({
      root,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
      validations: {
        serverRuntime: serverRuntime(true),
        desktopPublish: desktopPublish(true),
        approvalRecords: approvalRecords(true),
        productionOnboarding: productionOnboarding(true),
        goLive: goLive(true),
      },
    });
    const summaryMarkdown = await readFile(path.join(root, "dist", "operational-handoff-bundle", "operational-handoff-summary.md"), "utf8");
    const goLiveMarkdown = await readFile(path.join(root, "dist", "operational-handoff-bundle", "operational-go-live-report.md"), "utf8");
    const onboardingMarkdown = await readFile(
      path.join(root, "dist", "operational-handoff-bundle", "production-onboarding-readiness-report.md"),
      "utf8",
    );

    expect(result.valid).toBe(true);
    expect(result.summary.status).toBe("READY");
    expect(result.summary.gates.map((gate) => gate.status)).toEqual(["READY", "READY", "READY", "READY", "READY", "READY"]);
    expect(summaryMarkdown).toContain("JiumAI Operational Handoff Runbook");
    expect(goLiveMarkdown).toContain("JiumAI Operational Go-Live Report");
    expect(onboardingMarkdown).toContain("JiumAI Production Onboarding Readiness Report");
    expect(summaryMarkdown).not.toContain(root);
    expect(JSON.stringify(result.summary)).not.toContain("support@example.com");
  });

  it("keeps blocker evidence together without leaking raw operational values", async () => {
    const root = await tempRepo();

    const result = await buildOperationalHandoffBundle({
      root,
      env: {
        JIUM_PUBLIC_APP_URL: "https://prod.example.com/jium",
        JIUM_SUPPORT_CONTACT_ROUTE: "support@example.com",
        GITHUB_TOKEN: "ghs_secret",
      } as unknown as NodeJS.ProcessEnv,
      platform: "win32",
      generatedAt: "2026-06-01T00:00:00.000Z",
      validations: {
        serverRuntime: serverRuntime(false),
        desktopPublish: desktopPublish(false),
        approvalRecords: approvalRecords(false),
        productionOnboarding: productionOnboarding(false),
        goLive: goLive(false),
      },
    });
    const bundleText = await readFile(path.join(root, "dist", "operational-handoff-bundle", "operational-handoff-runbook.md"), "utf8");

    expect(result.valid).toBe(false);
    expect(result.summary.status).toBe("BLOCKED");
    expect(result.summary.gates).toEqual([
      { id: "server-runtime-readiness", status: "BLOCKED", errorCount: 1 },
      { id: "server-storage-readiness", status: "BLOCKED", errorCount: 1 },
      { id: "desktop-publish-readiness", status: "BLOCKED", errorCount: 2 },
      { id: "operational-approval-records", status: "BLOCKED", errorCount: 1 },
      { id: "production-onboarding-readiness", status: "BLOCKED", errorCount: 1 },
      { id: "operational-go-live", status: "BLOCKED", errorCount: 1 },
    ]);
    expect(bundleText).toContain("External Records Needed");
    expect(result.summary.externalRecordsNeeded).toContain(
      "Approved _headers-capable public static hosting deployment and READY hosted security header audit record",
    );
    expect(result.summary.nextActions).toContain(
      "Build npm run public:hosting:bundle and deploy dist/static-hosting-bundle/site to an approved _headers-capable host before public URL approval.",
    );
    expect(bundleText).not.toContain("prod.example.com");
    expect(bundleText).not.toContain("support@example.com");
    expect(bundleText).not.toContain("ghs_secret");
  });
});
