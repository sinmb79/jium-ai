import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildServerDeploymentBundle,
  formatServerDeploymentSummary,
  validateServerRouteMaterialization,
} from "../scripts/build-server-deployment-bundle.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.56") {
  const dir = path.join(os.tmpdir(), `jium-server-deployment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "data"), { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

async function writeRegistry(root: string, keys: unknown[]) {
  await writeFile(
    path.join(root, "data", "trusted-authorized-feed-keys.json"),
    JSON.stringify({ version: "jium-authorized-feed-trusted-keys-v1", keys }, null, 2),
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
    keyId: "partner-key-2026-06",
    issuerName: "Authorized Partner",
    algorithm: "RSASSA-PKCS1-v1_5",
    publicKeyJwk: {
      kty: "RSA",
      n: "public-modulus-for-server-deployment-bundle",
      e: "AQAB",
      use: "sig",
    },
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2027-01-01T00:00:00.000Z",
  };
}

function serverEnv(storageRoot: string, overrides: Record<string, string | undefined> = {}) {
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

async function tempStorageRoot() {
  const dir = path.join(os.tmpdir(), `jium-server-deployment-storage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server deployment bundle", () => {
  it("writes ready server deployment evidence without leaking env values", async () => {
    const root = await tempRepo();
    const storageRoot = await tempStorageRoot();
    await writeRegistry(root, [validKey()]);
    await writeRequiredRouteTemplates(root);

    const result = await buildServerDeploymentBundle({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: serverEnv(storageRoot),
    });
    const summaryMarkdown = await readFile(path.join(root, "dist", "server-deployment-bundle", "server-deployment-summary.md"), "utf8");
    const routeMarkdown = await readFile(path.join(root, "dist", "server-deployment-bundle", "server-route-materialization-report.md"), "utf8");
    const serialized = JSON.stringify(result.summary);

    expect(result.valid).toBe(true);
    expect(result.summary.status).toBe("READY");
    expect(result.summary.gates).toEqual([
      { id: "server-runtime-readiness", status: "READY", errorCount: 0 },
      { id: "server-storage-readiness", status: "READY", errorCount: 0 },
      { id: "server-route-materialization", status: "READY", errorCount: 0 },
    ]);
    expect(summaryMarkdown).toContain("JiumAI Server Deployment Bundle");
    expect(routeMarkdown).toContain("app/api/institution/login/route.ts");
    expect(formatServerDeploymentSummary(result.summary)).toContain("server-route-materialization");
    expect(result.summary.deploymentCommands).toContain(
      "npm run server:trusted-key:init -- --private-key-dir <approved-repo-external-private-key-dir> --key-id <approved-key-id> --issuer <approved-issuer-name>",
    );
    expect(result.summary.deploymentCommands).toContain(
      "npm run server:trusted-key:approval-candidate",
    );
    expect(result.summary.deploymentCommands).toContain(
      "npm run server:origin:candidate -- --from-public-env",
    );
    expect(result.summary.deploymentCommands).toContain(
      "npm run server:origin:apply -- --origin <approved-https-operator-origin> --approval-ref <pseudonymous-origin-approval-reference>",
    );
    expect(result.summary.deploymentCommands).toContain(
      "npm run server:trusted-key:apply -- --patch <trusted-key-registry.patch.json> --approval-ref <pseudonymous-approval-reference>",
    );
    expect(result.summary.deploymentCommands).toContain(
      "npm run server:storage:init -- --storage-root <approved-absolute-storage-root> --write-env",
    );
    expect(serialized).not.toContain("0123456789abcdef");
    expect(serialized).not.toContain("agency.example");
    expect(summaryMarkdown).not.toContain(storageRoot);
    expect(summaryMarkdown).not.toContain(root);
  });

  it("keeps blocked route materialization evidence redacted", async () => {
    const root = await tempRepo();
    const storageRoot = await tempStorageRoot();
    await writeRegistry(root, []);

    const result = await buildServerDeploymentBundle({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      env: serverEnv(storageRoot, {
        JIUM_SERVER_ROUTES: "false",
        INSTITUTION_ALLOWED_ORIGINS: "https://agency.example/private",
      }),
    });
    const runbook = await readFile(path.join(root, "dist", "server-deployment-bundle", "server-deployment-runbook.md"), "utf8");

    expect(result.valid).toBe(false);
    expect(result.summary.gates.map((gate) => gate.status)).toContain("BLOCKED");
    expect(result.summary.reports.routeMaterializationMarkdown).toBe("server-route-materialization-report.md");
    expect(runbook).toContain("External Records Needed");
    expect(runbook).not.toContain("agency.example");
    expect(runbook).not.toContain(storageRoot);
    expect(runbook).not.toContain(root);
  });

  it("validates route materialization without writing generated app routes", async () => {
    const root = await tempRepo();
    const storageRoot = await tempStorageRoot();
    await writeRequiredRouteTemplates(root);

    const result = validateServerRouteMaterialization({
      root,
      env: serverEnv(storageRoot),
    });

    expect(result.valid).toBe(true);
    expect(result.routeFiles).toContain("app/api/institution/login/route.ts");
    await expect(readFile(path.join(root, "app", "api", "institution", "login", "route.ts"), "utf8")).rejects.toThrow();
  });
});
