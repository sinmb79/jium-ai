import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateServerRuntimeReadiness } from "../scripts/check-server-readiness.mjs";

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
  return {
    JIUM_SERVER_ROUTES: "true",
    NODE_ENV: "production",
    INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
    INSTITUTION_AUDIT_LEDGER_DIR: path.join(root, "audit-ledger"),
    INSTITUTION_ACCOUNT_REGISTRY_DIR: path.join(root, "account-registry"),
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
});
