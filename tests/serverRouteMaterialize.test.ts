import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findAppRouteFiles } from "../scripts/check-deployment-profile.mjs";
import {
  GENERATED_SERVER_ROUTE_MARKER,
  cleanMaterializedServerRoutes,
  listServerRouteTemplates,
  materializeServerRoutes,
} from "../scripts/materialize-server-routes.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-server-routes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  return dir;
}

function routeEnv(root: string, overrides: Record<string, string | undefined> = {}) {
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

describe("server route materialization", () => {
  it("keeps the server route templates explicit and lazy-loaded", () => {
    expect(listServerRouteTemplates().map((template) => template.relativePath)).toEqual([
      "api/institution/accounts/route.ts",
      "api/institution/audit-ledger/route.ts",
      "api/institution/login/route.ts",
      "api/institution/logout/route.ts",
      "api/institution/session/route.ts",
    ]);
  });

  it("materializes and cleans generated app route handlers only for the server profile", async () => {
    const root = await tempRepo();
    const result = materializeServerRoutes({ root, env: routeEnv(root) });
    const loginRoute = path.join(root, "app", "api", "institution", "login", "route.ts");
    const nextTypesDir = path.join(root, ".next", "types");
    await mkdir(nextTypesDir, { recursive: true });
    await writeFile(path.join(nextTypesDir, "validator.ts"), "// stale route cache\n", "utf8");
    const loginText = await readFile(loginRoute, "utf8");

    expect(result.profile).toBe("server-routes");
    expect(result.routeFiles).toEqual([
      "app/api/institution/accounts/route.ts",
      "app/api/institution/audit-ledger/route.ts",
      "app/api/institution/login/route.ts",
      "app/api/institution/logout/route.ts",
      "app/api/institution/session/route.ts",
    ]);
    expect(findAppRouteFiles(root)).toEqual(result.routeFiles);
    expect(loginText).toContain(GENERATED_SERVER_ROUTE_MARKER);
    expect(loginText).toContain("loadInstitutionServerRouteConfig");
    expect(loginText).toContain("export async function POST");

    const clean = cleanMaterializedServerRoutes({ root });
    expect(clean.removed).toEqual(result.routeFiles);
    expect(clean.skipped).toEqual([]);
    expect(clean.removedCaches).toEqual([".next/types"]);
    expect(findAppRouteFiles(root)).toEqual([]);
    expect(existsSync(loginRoute)).toBe(false);
    expect(existsSync(path.join(root, "app", "api"))).toBe(false);
    expect(existsSync(nextTypesDir)).toBe(false);
  });

  it("rejects Pages mode and incomplete server route environments", async () => {
    const root = await tempRepo();

    expect(() =>
      materializeServerRoutes({
        root,
        env: routeEnv(root, { GITHUB_PAGES: "true" }),
      }),
    ).toThrow("GITHUB_PAGES=true");

    expect(() =>
      materializeServerRoutes({
        root,
        env: routeEnv(root, { JIUM_SERVER_ROUTES: "false" }),
      }),
    ).toThrow("requires JIUM_SERVER_ROUTES=true");

    expect(() =>
      materializeServerRoutes({
        root,
        env: routeEnv(root, { INSTITUTION_SESSION_SECRET: "" }),
      }),
    ).toThrow("Deployment profile is not ready");
  });

  it("does not overwrite non-generated route handlers", async () => {
    const root = await tempRepo();
    const routePath = path.join(root, "app", "api", "institution", "login", "route.ts");
    await mkdir(path.dirname(routePath), { recursive: true });
    await writeFile(routePath, "export async function POST() { return new Response('custom'); }\n", "utf8");

    expect(() => materializeServerRoutes({ root, env: routeEnv(root) })).toThrow("Refusing to overwrite");
  });

  it("executes the CLI entry point", () => {
    const result = spawnSync(process.execPath, ["scripts/materialize-server-routes.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, JIUM_SERVER_ROUTES: "false" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires JIUM_SERVER_ROUTES=true");
  });
});
