import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatNetlifyHostingConfigMarkdown,
  validateNetlifyHostingConfig,
} from "../scripts/check-netlify-hosting-config.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.89") {
  const dir = path.join(os.tmpdir(), `jium-netlify-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

async function writeNetlifyToml(root: string, text = "") {
  const config = text || [
    "[build]",
    "  command = \"npm run public:hosting:bundle\"",
    "  publish = \"dist/static-hosting-bundle/site\"",
    "",
    "[build.environment]",
    "  NODE_VERSION = \"24\"",
    "  NEXT_TELEMETRY_DISABLED = \"1\"",
    "",
  ].join("\n");
  await writeFile(path.join(root, "netlify.toml"), config, "utf8");
}

async function writeNetlifyIgnore(root: string, text = "") {
  await writeFile(
    path.join(root, ".netlifyignore"),
    text || ["node_modules", ".git", ".next", "out", "dist", "coverage", ".env", ".env*.local", "ops/private", ""].join("\n"),
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("netlify hosting config", () => {
  it("validates the production static hosting build command and publish directory", async () => {
    const root = await tempRepo();
    await writeNetlifyToml(root);
    await writeNetlifyIgnore(root);

    const result = validateNetlifyHostingConfig({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    const markdown = formatNetlifyHostingConfigMarkdown(result.report);
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(true);
    expect(result.report.status).toBe("READY");
    expect(result.report.summary.buildCommandStatus).toBe("READY");
    expect(result.report.summary.publishDirectoryStatus).toBe("READY");
    expect(result.report.summary.nodeVersionStatus).toBe("READY");
    expect(result.report.summary.uploadIgnoreStatus).toBe("READY");
    expect(markdown).toContain("JiumAI Netlify Hosting Config");
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("https://");
  });

  it("blocks missing or unsafe Netlify config without echoing raw values", async () => {
    const root = await tempRepo();
    await writeNetlifyToml(
      root,
      [
        "[build]",
        "  command = \"npm run build\"",
        "  publish = \"out\"",
        "",
        "# do not leak https://prod.example.com/private",
      ].join("\n"),
    );
    await writeNetlifyIgnore(root, "node_modules\n.git\n");

    const result = validateNetlifyHostingConfig({ root, generatedAt: "2026-06-01T00:00:00.000Z" });
    const serialized = JSON.stringify(result.report);

    expect(result.valid).toBe(false);
    expect(result.report.status).toBe("BLOCKED");
    expect(result.report.errors.join("\n")).toContain("Netlify build command must run npm run public:hosting:bundle");
    expect(result.report.errors.join("\n")).toContain("Netlify publish directory must be dist/static-hosting-bundle/site");
    expect(result.report.errors.join("\n")).toContain("Netlify config contains unsafe raw deployment values");
    expect(result.report.errors.join("\n")).toContain("Netlify upload ignore file must exclude generated directories and private files");
    expect(serialized).not.toContain("prod.example.com");
  });

  it("runs the CLI and rejects unsafe output paths", async () => {
    const root = await tempRepo();
    await writeNetlifyToml(root);
    await writeNetlifyIgnore(root);
    const scriptPath = path.join(process.cwd(), "scripts", "check-netlify-hosting-config.mjs");

    const blocked = spawnSync(process.execPath, [scriptPath, "--root", root, "--json", "--output", "../unsafe.json"], {
      encoding: "utf8",
    });
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("output path must stay inside the repository");

    const run = spawnSync(process.execPath, [scriptPath, "--root", root, "--json", "--output", "reports/netlify-config.json"], {
      encoding: "utf8",
    });
    const report = JSON.parse(await readFile(path.join(root, "reports", "netlify-config.json"), "utf8"));

    expect(run.status).toBe(0);
    expect(report.status).toBe("READY");
  });
});
