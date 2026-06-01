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

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-operational-go-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version: "0.3.49" }), "utf8");
  return dir;
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
    } as unknown as NodeJS.ProcessEnv);

    expect(summary.JIUM_GO_LIVE_APPROVAL).toBe("APPROVED");
    expect(summary.JIUM_PUBLIC_APP_URL).toBe("SET_HTTPS");
    expect(summary.JIUM_PRIVACY_NOTICE_URL).toBe("SET_NOT_HTTPS");
    expect(JSON.stringify(summary)).not.toContain("prod.example.com");
    expect(JSON.stringify(summary)).not.toContain("support@example.com");
  });

  it("accepts a fully approved server and desktop launch profile", async () => {
    const root = await tempRepo();
    const readiness = await validateOperationalGoLive({
      root,
      env: {
        JIUM_GO_LIVE_APPROVAL: "APPROVED",
        JIUM_LEGAL_REVIEW_APPROVAL: "APPROVED",
        JIUM_RELEASE_EVIDENCE_REVIEW: "APPROVED",
        JIUM_DATA_RETENTION_POLICY_ACK: "APPROVED",
        JIUM_PUBLIC_APP_URL: "https://prod.example.com/jium",
        JIUM_PRIVACY_NOTICE_URL: "https://prod.example.com/privacy",
        JIUM_SUPPORT_CONTACT_ROUTE: "support-route-redacted",
        JIUM_INCIDENT_RESPONSE_OWNER: "owner-redacted",
      } as unknown as NodeJS.ProcessEnv,
      validations: {
        serverRuntime: readyServerRuntime(),
        desktopPublish: readyDesktopPublish(),
      },
    });
    const report = buildOperationalGoLiveReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatOperationalGoLiveMarkdown(report);

    expect(readiness.valid).toBe(true);
    expect(report.status).toBe("READY");
    expect(markdown).toContain("JiumAI Operational Go-Live Report");
    expect(markdown).not.toContain("prod.example.com");
    expect(markdown).not.toContain("owner-redacted");
  });

  it("blocks missing approvals and downstream readiness failures", async () => {
    const root = await tempRepo();
    const readiness = await validateOperationalGoLive({
      root,
      env: {} as unknown as NodeJS.ProcessEnv,
      validations: {
        serverRuntime: { ...readyServerRuntime(), valid: false, errors: ["trusted key registry: missing active key"] },
        desktopPublish: { ...readyDesktopPublish(), valid: false, errors: ["desktop publish update feed: missing latest.yml"] },
      },
    });
    const report = buildOperationalGoLiveReport(readiness, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("JIUM_GO_LIVE_APPROVAL");
    expect(readiness.errors.join("\n")).toContain("operational server runtime");
    expect(readiness.errors.join("\n")).toContain("operational desktop publish");
    expect(report.checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toEqual(
      expect.arrayContaining(["human-go-live-approval", "server-runtime", "desktop-publish"]),
    );
  });
});
