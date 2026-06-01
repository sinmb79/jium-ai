import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { summarizeServerRuntimeEnv, validateServerRuntimeReadiness } from "../scripts/check-server-readiness.mjs";
import {
  DEFAULT_SERVER_RUNTIME_ENV_PATH,
  buildServerRuntimeEnvTemplate,
  writeServerRuntimeEnvTemplate,
} from "../scripts/init-server-runtime-env.mjs";

const tempDirs: string[] = [];

async function tempRoot() {
  const dir = path.join(os.tmpdir(), `jium-server-env-init-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  return dir;
}

function parseEnv(content: string) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server runtime env initializer", () => {
  it("writes a private server env template with a generated strong secret and blocked origin placeholder", async () => {
    const root = await tempRoot();

    const result = writeServerRuntimeEnvTemplate({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const content = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");
    const env = parseEnv(content);
    const summary = summarizeServerRuntimeEnv(env);
    const readiness = validateServerRuntimeReadiness({ root, env });

    expect(result.outputPathRelative).toBe(DEFAULT_SERVER_RUNTIME_ENV_PATH);
    expect(env.INSTITUTION_SESSION_SECRET).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(summary.INSTITUTION_SESSION_SECRET).toBe("SET");
    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("INSTITUTION_ALLOWED_ORIGINS");
    expect(readiness.errors.join("\n")).toContain("placeholder");
    expect(readiness.errors.join("\n")).toContain("INSTITUTION_AUDIT_LEDGER_DIR");
    expect(readiness.errors.join("\n")).toContain("INSTITUTION_ACCOUNT_REGISTRY_DIR");
    expect(content).not.toContain("NEXT_PUBLIC_INSTITUTION_SESSION_SECRET");
  });

  it("refuses to overwrite an existing server env template unless forced", async () => {
    const root = await tempRoot();

    writeServerRuntimeEnvTemplate({ root, generatedAt: "2026-06-01T00:00:00.000Z", secret: "a".repeat(48) });

    expect(() =>
      writeServerRuntimeEnvTemplate({ root, generatedAt: "2026-06-01T00:00:01.000Z", secret: "b".repeat(48) }),
    ).toThrow(/already exists/);

    writeServerRuntimeEnvTemplate({ root, force: true, generatedAt: "2026-06-01T00:00:01.000Z", secret: "b".repeat(48) });
    const content = await readFile(path.join(root, DEFAULT_SERVER_RUNTIME_ENV_PATH), "utf8");

    expect(content).toContain(`INSTITUTION_SESSION_SECRET=${"b".repeat(48)}`);
  });

  it("keeps weak manually supplied secrets blocked in server readiness", () => {
    const env = parseEnv(
      buildServerRuntimeEnvTemplate({
        generatedAt: "2026-06-01T00:00:00.000Z",
        secret: "too-short",
      }),
    );
    const summary = summarizeServerRuntimeEnv(env);

    expect(summary.INSTITUTION_SESSION_SECRET).toBe("SET_WEAK");
  });
});
