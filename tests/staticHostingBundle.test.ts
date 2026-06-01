import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildStaticHostingBundle,
  formatStaticHostingBundleMarkdown,
  validateStaticHostingExport,
} from "../scripts/build-static-hosting-bundle.mjs";
import { buildStaticHeadersFile } from "../scripts/security-headers-runtime.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.70") {
  const dir = path.join(os.tmpdir(), `jium-static-hosting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

function writeMinimalExport(root: string, headers = buildStaticHeadersFile()) {
  const out = path.join(root, "out");
  mkdirSync(path.join(out, "_next"), { recursive: true });
  for (const route of ["", "dashboard", "privacy", "support"]) {
    const dir = route ? path.join(out, route) : out;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "index.html"), `<html><body>${route || "home"}</body></html>`, "utf8");
  }
  writeFileSync(path.join(out, "_headers"), headers, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("static hosting bundle", () => {
  it("builds a redacted secure static hosting bundle with enforced headers", async () => {
    const root = await tempRepo();
    const result = await buildStaticHostingBundle({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
      runner: () => {
        writeMinimalExport(root);
        return { status: 0 };
      },
    });
    const reportMarkdown = formatStaticHostingBundleMarkdown(result.summary);
    const reportJson = JSON.stringify(result.summary);
    const bundledHeaders = await readFile(path.join(root, "dist", "static-hosting-bundle", "site", "_headers"), "utf8");

    expect(result.valid).toBe(true);
    expect(result.summary.status).toBe("READY");
    expect(result.summary.providerTargets).toEqual(["Cloudflare Pages", "Netlify"]);
    expect(result.summary.checks.find((check) => check.id === "security-headers")?.status).toBe("PASS");
    expect(bundledHeaders.replace(/\r\n/g, "\n")).toBe(buildStaticHeadersFile());
    expect(existsSync(path.join(root, "dist", "static-hosting-bundle", "site", "support", "index.html"))).toBe(true);
    expect(reportMarkdown).toContain("JiumAI Static Hosting Bundle");
    expect(reportJson).not.toContain(root);
    expect(reportJson).not.toContain("https://");
  });

  it("blocks static hosting validation when the exported _headers file is missing required policy", async () => {
    const root = await tempRepo();
    writeMinimalExport(root, "/*\n  X-Content-Type-Options: nosniff\n");

    const readiness = validateStaticHostingExport({ root, outDir: path.join(root, "out") });

    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("static hosting _headers file must match repository security policy");
    expect(JSON.stringify(readiness)).not.toContain(root);
  });
});
