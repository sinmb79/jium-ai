import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildServerRuntimeReadinessReport,
  formatServerRuntimeReadinessMarkdown,
  summarizeServerRuntimeEnv,
  validateServerRuntimeReadiness,
} from "../scripts/check-server-readiness.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-server-readiness-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "data"), { recursive: true });
  return dir;
}

async function writeRegistry(root: string, keys: unknown[]) {
  await writeFile(
    path.join(root, "data", "trusted-authorized-feed-keys.json"),
    JSON.stringify(
      {
        version: "jium-authorized-feed-trusted-keys-v1",
        keys,
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

function validKey() {
  return {
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
  };
}

function serverEnv(root: string, overrides: Record<string, string | undefined> = {}) {
  const storageRoot = path.join(os.tmpdir(), `${path.basename(root)}-private-storage`);
  if (!tempDirs.includes(storageRoot)) {
    tempDirs.push(storageRoot);
  }
  return {
    JIUM_SERVER_ROUTES: "true",
    NODE_ENV: "production",
    INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
    INSTITUTION_AUDIT_LEDGER_DIR: path.join(storageRoot, "audit-ledger"),
    INSTITUTION_ACCOUNT_REGISTRY_DIR: path.join(storageRoot, "account-registry"),
    INSTITUTION_SECURE_COOKIES: "true",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server runtime readiness", () => {
  it("accepts a server profile with a trusted public key registry and route templates", async () => {
    const root = await tempRepo();
    await writeRegistry(root, [validKey()]);
    await writeRequiredRouteTemplates(root);

    const result = validateServerRuntimeReadiness({ root, env: serverEnv(root) });

    expect(result.valid).toBe(true);
    expect(result.keyCount).toBe(1);
    expect(result.activeKeyCount).toBe(1);
    expect(result.templateFiles).toContain("api/institution/login/route.ts");
    expect(result.envSummary.INSTITUTION_SESSION_SECRET).toBe("SET");
    expect(JSON.stringify(result)).not.toContain("0123456789abcdef0123456789abcdef");
  });

  it("rejects registries that only contain expired keys", async () => {
    const root = await tempRepo();
    await writeRegistry(root, [{ ...validKey(), validUntil: "2026-01-01T00:00:00.000Z" }]);
    await writeRequiredRouteTemplates(root);

    const result = validateServerRuntimeReadiness({ root, env: serverEnv(root) });

    expect(result.valid).toBe(false);
    expect(result.keyCount).toBe(1);
    expect(result.activeKeyCount).toBe(0);
    expect(result.errors.join("\n")).toContain("at least one active");
  });

  it("rejects empty trusted key registries, Pages mode, and incomplete server env", async () => {
    const root = await tempRepo();
    await writeRegistry(root, []);
    await writeRequiredRouteTemplates(root);

    const result = validateServerRuntimeReadiness({
      root,
      env: serverEnv(root, {
        GITHUB_PAGES: "true",
        INSTITUTION_SESSION_SECRET: "",
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("GITHUB_PAGES=true");
    expect(result.errors.join("\n")).toContain("INSTITUTION_SESSION_SECRET");
    expect(result.errors.join("\n")).toContain("at least one RSASSA-PKCS1-v1_5 institution public key");
  });

  it("rejects missing required route templates", async () => {
    const root = await tempRepo();
    const emptyTemplateRoot = path.join(root, "server-route-templates", "app");
    await mkdir(emptyTemplateRoot, { recursive: true });
    await writeRegistry(root, [validKey()]);

    const result = validateServerRuntimeReadiness({
      root,
      templateRoot: emptyTemplateRoot,
      env: serverEnv(root),
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("server route template missing");
  });

  it("runs the CLI readiness check from a deployment workspace", async () => {
    const root = await tempRepo();
    await writeRequiredRouteTemplates(root);
    await writeRegistry(root, [validKey()]);
    const scriptPath = path.join(process.cwd(), "scripts", "check-server-readiness.mjs");

    const passed = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...serverEnv(root) } as NodeJS.ProcessEnv,
    });
    const failed = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...serverEnv(root, { JIUM_SERVER_ROUTES: "false" }) } as NodeJS.ProcessEnv,
    });

    expect(passed.status).toBe(0);
    expect(passed.stdout).toContain("active trusted key");
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("Server runtime readiness check failed");
  });

  it("builds a redacted JSON and Markdown readiness report", async () => {
    const root = await tempRepo();
    await writeRequiredRouteTemplates(root);
    await writeRegistry(root, [validKey()]);
    const env = serverEnv(root);
    const result = validateServerRuntimeReadiness({ root, env });
    const report = buildServerRuntimeReadinessReport(result, { generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatServerRuntimeReadinessMarkdown(report);
    const serialized = JSON.stringify(report);

    expect(report.status).toBe("READY");
    expect(report.summary.allowedOriginCount).toBe(1);
    expect(report.summary.storageStatus).toBe("READY");
    expect(report.checks.every((check) => check.status === "PASS")).toBe(true);
    expect(markdown).toContain("JiumAI Server Runtime Readiness Report");
    expect(markdown).toContain("Status: READY");
    expect(serialized).not.toContain("0123456789abcdef0123456789abcdef");
    expect(serialized).not.toContain("https://agency.example");
    expect(serialized).not.toContain(env.INSTITUTION_AUDIT_LEDGER_DIR);
    expect(serialized).not.toContain(env.INSTITUTION_ACCOUNT_REGISTRY_DIR);
  });

  it("reports blocked checks and safe next actions without leaking env values", async () => {
    const root = await tempRepo();
    await writeRegistry(root, []);
    const result = validateServerRuntimeReadiness({
      root,
      env: serverEnv(root, {
        JIUM_SERVER_ROUTES: "false",
        INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
        INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      }),
    });
    const report = buildServerRuntimeReadinessReport(result, { generatedAt: "2026-06-01T00:00:00.000Z" });

    expect(report.status).toBe("BLOCKED");
    expect(report.checks.some((check) => check.status === "BLOCKED")).toBe(true);
    expect(report.nextActions.join("\n")).toContain("server:origin:candidate");
    expect(report.nextActions.join("\n")).toContain("server:origin:apply");
    expect(JSON.stringify(report)).not.toContain("0123456789abcdef0123456789abcdef");
    expect(JSON.stringify(report)).not.toContain("https://agency.example");
  });

  it("writes CLI JSON and Markdown reports to operator-selected files", async () => {
    const root = await tempRepo();
    await writeRequiredRouteTemplates(root);
    await writeRegistry(root, [validKey()]);
    const scriptPath = path.join(process.cwd(), "scripts", "check-server-readiness.mjs");
    const jsonPath = path.join(root, "reports", "readiness.json");
    const markdownPath = path.join(root, "reports", "readiness.md");

    const jsonRun = spawnSync(process.execPath, [scriptPath, "--json", "--output", jsonPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...serverEnv(root) } as NodeJS.ProcessEnv,
    });
    const markdownRun = spawnSync(process.execPath, [scriptPath, "--markdown", "--output", markdownPath], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...serverEnv(root) } as NodeJS.ProcessEnv,
    });
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    const markdown = await readFile(markdownPath, "utf8");

    expect(jsonRun.status).toBe(0);
    expect(markdownRun.status).toBe(0);
    expect(json.status).toBe("READY");
    expect(markdown).toContain("Status: READY");
    expect(JSON.stringify(json)).not.toContain("0123456789abcdef0123456789abcdef");
    expect(markdown).not.toContain("https://agency.example");
  });

  it("summarizes server env presence rather than raw values", () => {
    const summary = summarizeServerRuntimeEnv({
      JIUM_SERVER_ROUTES: "true",
      GITHUB_PAGES: "false",
      INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
      INSTITUTION_ALLOWED_ORIGINS: "https://agency.example,https://partner.example",
      INSTITUTION_AUDIT_LEDGER_DIR: "C:/secure/audit",
      INSTITUTION_ACCOUNT_REGISTRY_DIR: "C:/secure/accounts",
      NEXT_PUBLIC_INSTITUTION_SESSION_SECRET: "",
    });

    expect(summary.INSTITUTION_SESSION_SECRET).toBe("SET");
    expect(summary.INSTITUTION_ALLOWED_ORIGINS_COUNT).toBe(2);
    expect(JSON.stringify(summary)).not.toContain("agency.example");
    expect(JSON.stringify(summary)).not.toContain("0123456789abcdef");
  });
});
