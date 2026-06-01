import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPublicHostingGoLivePreflight,
  formatPublicHostingGoLivePreflightMarkdown,
} from "../scripts/check-public-hosting-go-live-preflight.mjs";
import { buildStaticHeadersFile, getSecurityHeaders } from "../scripts/security-headers-runtime.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.88") {
  const dir = path.join(os.tmpdir(), `jium-public-hosting-preflight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

function writeMinimalStaticExport(root: string, headers = buildStaticHeadersFile()) {
  const out = path.join(root, "out");
  mkdirSync(path.join(out, "_next"), { recursive: true });
  for (const route of ["", "dashboard", "privacy", "support"]) {
    const dir = route ? path.join(out, route) : out;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.html"), `<html><body>${route || "home"}</body></html>`, "utf8");
  }
  writeFileSync(path.join(out, "_headers"), headers, "utf8");
}

function response(headers: Headers, status = 200) {
  return {
    status,
    headers,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("public hosting go-live preflight", () => {
  it("builds a redacted READY preflight for a _headers-capable HTTPS deployment", async () => {
    const root = await tempRepo();
    writeMinimalStaticExport(root);
    const result = await buildPublicHostingGoLivePreflight({
      root,
      targetUrl: "https://prod.example.com/jium-ai/private?token=secret",
      noBuild: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
      fetcher: async () => response(new Headers(Object.fromEntries(getSecurityHeaders().map((header) => [header.key, header.value])))),
    });
    const serialized = JSON.stringify(result.report);
    const markdown = formatPublicHostingGoLivePreflightMarkdown(result.report);
    const auditCandidate = JSON.parse(await readFile(path.join(root, "dist", "public-hosting-go-live-preflight", "hosted-security-header-audit-candidate.json"), "utf8"));

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("READY");
    expect(result.report.summary.staticHostingStatus).toBe("READY");
    expect(result.report.summary.hostedAuditStatus).toBe("READY");
    expect(result.report.summary.headerFailureCount).toBe(0);
    expect(result.report.applyCommand).toContain("npm run ops:hosted-audit:apply");
    expect(auditCandidate.schema).toBe("jium-security-header-url-audit-v1");
    expect(auditCandidate.status).toBe("READY");
    expect(markdown).toContain("JiumAI Public Hosting Go-Live Preflight");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("prod.example.com");
    expect(serialized).not.toContain("token=secret");
  });

  it("blocks a deployed response that does not enforce required security headers", async () => {
    const root = await tempRepo();
    writeMinimalStaticExport(root);
    const result = await buildPublicHostingGoLivePreflight({
      root,
      targetUrl: "https://sinmb79.github.io/jium-ai/",
      noBuild: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
      fetcher: async () => response(new Headers(), 200),
    });
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.summary.targetUrlState).toBe("HTTPS");
    expect(result.report.summary.headerFailureCount).toBe(getSecurityHeaders().length);
    expect(result.report.errors.join("\n")).toContain("hosted response is missing or mismatching required security headers");
    expect(result.report.nextActions.join("\n")).toContain("_headers-capable provider");
    expect(serialized).not.toContain("sinmb79.github.io");
    expect(serialized).not.toContain("/jium-ai/");
  });

  it("runs the CLI and rejects unsafe output paths before network fetch", async () => {
    const root = await tempRepo();
    writeMinimalStaticExport(root);
    const scriptPath = path.join(process.cwd(), "scripts", "check-public-hosting-go-live-preflight.mjs");

    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "--root", root, "--no-build", "--url", "https://prod.example.com", "--json", "--output", "../unsafe-report.json"],
      { encoding: "utf8" },
    );

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");
  });
});
