import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH, validateOperationalApprovalRecords } from "../scripts/check-operational-approval-records.mjs";
import {
  buildOperationalApprovalRecordsTemplate,
  writeOperationalApprovalRecordsTemplate,
} from "../scripts/init-operational-approval-records.mjs";

const tempDirs: string[] = [];

async function tempRepo(version = "0.3.52") {
  const dir = path.join(os.tmpdir(), `jium-operational-approval-init-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ version }), "utf8");
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("operational approval records init", () => {
  it("builds a private approval packet template that remains blocked until human approval", async () => {
    const root = await tempRepo();

    const result = writeOperationalApprovalRecordsTemplate({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    const serialized = await readFile(path.join(root, DEFAULT_OPERATIONAL_APPROVAL_RECORDS_PATH), "utf8");
    const readiness = validateOperationalApprovalRecords({ root, now: Date.parse("2026-06-01T00:00:00.000Z") });

    expect(result.report.status).toBe("BLOCKED");
    expect(readiness.valid).toBe(false);
    expect(readiness.errors.join("\n")).toContain("placeholder value");
    expect(readiness.errors.join("\n")).toContain("must be APPROVED");
    expect(serialized).toContain("PENDING_APPROVAL");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("@");
  });

  it("refuses to overwrite an existing private approval packet unless forced", async () => {
    const root = await tempRepo();

    writeOperationalApprovalRecordsTemplate({
      root,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });

    expect(() =>
      writeOperationalApprovalRecordsTemplate({
        root,
        generatedAt: "2026-06-01T00:00:01.000Z",
      }),
    ).toThrow(/already exists/);

    const forced = writeOperationalApprovalRecordsTemplate({
      root,
      force: true,
      generatedAt: "2026-06-01T00:00:01.000Z",
    });

    expect(forced.template.generatedAt).toBe("2026-06-01T00:00:01.000Z");
  });

  it("aligns the template release tag with package version or explicit desktop tag", async () => {
    const root = await tempRepo("1.2.3");

    expect(buildOperationalApprovalRecordsTemplate({ root }).releaseTag).toBe("v1.2.3");
    expect(
      buildOperationalApprovalRecordsTemplate({
        root,
        env: { JIUM_DESKTOP_RELEASE_TAG: "v9.9.9" } as unknown as NodeJS.ProcessEnv,
      }).releaseTag,
    ).toBe("v9.9.9");
  });
});
