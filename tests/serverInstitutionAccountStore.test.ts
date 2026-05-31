import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  emptyInstitutionAccountRegistry,
  provisionInstitutionAccount,
} from "@/lib/institutionAccountRegistry";
import {
  createInstitutionAccountRegistryFileStore,
  readInstitutionAccountRegistryFile,
  resolveInstitutionAccountRegistryPath,
} from "@/lib/serverInstitutionAccountStore";

const tempDirs: string[] = [];
const now = Date.parse("2026-06-01T01:00:00.000Z");

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jium-account-registry-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server institution account registry store", () => {
  it("reads an empty registry and persists provisioned accounts atomically", async () => {
    const dir = await tempDir();
    const store = createInstitutionAccountRegistryFileStore(dir, { now: () => now });
    const empty = await store.read();
    const { registry } = provisionInstitutionAccount(
      empty,
      {
        organizationId: "org-support-center-001",
        organizationName: "Authorized Support Center",
        subjectId: "operator:caseworker-001",
        role: "VICTIM_SUPPORT_CASEWORKER",
      },
      now,
    );

    await store.write(registry);

    const readBack = await readInstitutionAccountRegistryFile(store.filePath, now);
    expect(readBack.accounts[0]?.subjectId).toBe("operator:caseworker-001");
    expect(readBack.accounts[0]?.organizationName).toBe("Authorized Support Center");
  });

  it("constrains registry files to the configured directory", async () => {
    const dir = await tempDir();

    expect(resolveInstitutionAccountRegistryPath(dir)).toContain("institution-accounts.json");
    expect(() => resolveInstitutionAccountRegistryPath(dir, "../escape.json")).toThrow("simple .json");
    expect(() => resolveInstitutionAccountRegistryPath(dir, "accounts.txt")).toThrow("simple .json");
    expect(() => createInstitutionAccountRegistryFileStore(dir, { fileName: "nested/accounts.json" })).toThrow("simple .json");
  });

  it("rejects invalid registry contents before writing", async () => {
    const dir = await tempDir();
    const store = createInstitutionAccountRegistryFileStore(dir, { now: () => now });

    await expect(
      store.write({
        ...emptyInstitutionAccountRegistry(now),
        accounts: [
          {
            accountId: "bad",
            organizationId: "org",
            organizationName: "Org",
            subjectId: "caseworker@example.invalid",
            role: "VICTIM_SUPPORT_CASEWORKER",
            capabilityIds: ["AUTHORIZED_FEED_SUMMARY"],
            evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
            status: "ACTIVE",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          },
        ],
      }),
    ).rejects.toThrow("pseudonymous");
  });
});
