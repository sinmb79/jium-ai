import { mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findAppRouteFiles,
  validateDeploymentProfile,
} from "../scripts/check-deployment-profile.mjs";

const tempDirs: string[] = [];

async function tempRepo() {
  const dir = path.join(os.tmpdir(), `jium-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(path.join(dir, "app", "api", "institution", "login"), { recursive: true });
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("deployment profile guard", () => {
  it("passes the current static/local repository profile", () => {
    const local = validateDeploymentProfile({}, process.cwd());
    const pages = validateDeploymentProfile({ GITHUB_PAGES: "true" }, process.cwd());

    expect(local.valid).toBe(true);
    expect(local.profile).toBe("local-build");
    expect(pages.valid).toBe(true);
    expect(pages.profile).toBe("github-pages-static");
  });

  it("rejects app route handlers in GitHub Pages static export", async () => {
    const dir = await tempRepo();
    await writeFile(path.join(dir, "app", "api", "institution", "login", "route.ts"), "export const POST = () => new Response();\n");

    expect(findAppRouteFiles(dir)).toEqual(["app/api/institution/login/route.ts"]);
    const result = validateDeploymentProfile({ GITHUB_PAGES: "true" }, dir);

    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toContain("static export cannot include app route handlers");
  });

  it("rejects unsafe server route environment configuration", () => {
    const missing = validateDeploymentProfile({ JIUM_SERVER_ROUTES: "true" }, process.cwd());
    const conflict = validateDeploymentProfile(
      {
        GITHUB_PAGES: "true",
        JIUM_SERVER_ROUTES: "true",
        INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
        INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
        INSTITUTION_AUDIT_LEDGER_DIR: "C:/audit",
      },
      process.cwd(),
    );
    const publicSecret = validateDeploymentProfile(
      {
        JIUM_SERVER_ROUTES: "true",
        INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
        NEXT_PUBLIC_INSTITUTION_SESSION_SECRET: "leak",
        INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
        INSTITUTION_AUDIT_LEDGER_DIR: "C:/audit",
      },
      process.cwd(),
    );

    expect(missing.valid).toBe(false);
    expect(missing.errors.join("\n")).toContain("INSTITUTION_SESSION_SECRET");
    expect(conflict.valid).toBe(false);
    expect(conflict.errors.join("\n")).toContain("cannot be combined");
    expect(publicSecret.valid).toBe(false);
    expect(publicSecret.errors.join("\n")).toContain("NEXT_PUBLIC_INSTITUTION_SESSION_SECRET");
  });

  it("accepts a minimally valid server route profile", () => {
    const result = validateDeploymentProfile(
      {
        JIUM_SERVER_ROUTES: "true",
        NODE_ENV: "production",
        INSTITUTION_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
        INSTITUTION_ALLOWED_ORIGINS: "https://agency.example",
        INSTITUTION_AUDIT_LEDGER_DIR: "C:/audit",
        INSTITUTION_SECURE_COOKIES: "true",
      },
      process.cwd(),
    );

    expect(result.valid).toBe(true);
    expect(result.profile).toBe("server-routes");
  });
});
