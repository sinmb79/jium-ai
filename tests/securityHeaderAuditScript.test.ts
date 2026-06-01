import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import http from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";

let server: http.Server | undefined;
let root: string;

function listen(headers: Record<string, string>) {
  server = http.createServer((_, response) => {
    Object.entries(headers).forEach(([key, value]) => response.setHeader(key, value));
    response.end("ok");
  });
  return new Promise<string>((resolve) => {
    server!.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      if (!address || typeof address === "string") {
        throw new Error("unexpected server address");
      }
      resolve(`http://127.0.0.1:${address.port}/private/check?case=secret`);
    });
  });
}

function runScript(args: string[]) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`security header script timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 10000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

describe("security header audit script", () => {
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "jium-header-audit-"));
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
    }
    server = undefined;
    rmSync(root, { recursive: true, force: true });
  });

  it("writes a redacted JSON report for a hosted response with enforced headers", async () => {
    const url = await listen(Object.fromEntries(SECURITY_HEADERS.map((header) => [header.key, header.value])));
    const reportPath = path.join(root, "headers.json");

    const result = await runScript(["scripts/check-security-headers.mjs", url, "--json", "--output", reportPath]);
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const serialized = JSON.stringify(report);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\"schema\"");
    expect(report.schema).toBe("jium-security-header-url-audit-v1");
    expect(report.status).toBe("READY");
    expect(report.summary.passCount).toBe(SECURITY_HEADERS.length);
    expect(report.summary.targetUrlState).toBe("LOCAL_HTTP");
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("/private/check");
    expect(serialized).not.toContain("case=secret");
  });

  it("blocks and redacts a JSON report when hosted headers are missing", async () => {
    const url = await listen({ "X-Content-Type-Options": "nosniff" });
    const reportPath = path.join(root, "headers-blocked.json");

    const result = await runScript(["scripts/check-security-headers.mjs", url, "--json", "--output", reportPath]);
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const serialized = JSON.stringify(report);

    expect(result.status).toBe(1);
    expect(report.status).toBe("BLOCKED");
    expect(report.summary.failureCount).toBeGreaterThan(0);
    expect(report.checks.find((check: { key: string; status: string }) => check.key === "Content-Security-Policy")?.status).toBe("missing");
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("/private/check");
    expect(serialized).not.toContain("case=secret");
  });
});
