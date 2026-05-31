import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendInstitutionAuditLedgerFileRecord,
  createInstitutionAuditLedgerFileStore,
  readInstitutionAuditLedgerFile,
  resolveInstitutionAuditLedgerPath,
} from "@/lib/serverInstitutionAuditLedgerStore";
import { createInstitutionAuditEvent } from "@/lib/institutionAuditLog";

const now = Date.parse("2026-05-31T05:00:00.000Z");
const tempDirs: string[] = [];

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jium-audit-ledger-"));
  tempDirs.push(dir);
  return dir;
}

function event(index: number) {
  return createInstitutionAuditEvent(
    {
      eventType: index === 1 ? "INSTITUTION_LOGIN_SUCCESS" : "INSTITUTION_LOGOUT",
      outcome: "SUCCESS",
      requestId: `req-file-ledger-${index}`,
      originClassification: "ALLOWED",
      organizationName: "Authorized Support Center",
      subjectId: "operator:caseworker-001",
      role: "PLATFORM_TRUST_SAFETY",
      capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY"],
      evidenceAccessScope: "ASSIGNED_CASE_REDACTED",
      sessionExpiresAt: "2026-05-31T06:00:00.000Z",
    },
    now + index,
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("server institution audit ledger file store", () => {
  it("appends and verifies JSONL audit ledger records", async () => {
    const dir = await tempDir();
    const store = createInstitutionAuditLedgerFileStore(dir, { now: () => now });

    await store.append(event(1));
    await store.append(event(2));
    const records = await store.read();
    const verification = await store.verify();
    const text = await readFile(store.filePath, "utf8");

    expect(records).toHaveLength(2);
    expect(records[1]?.previousRecordDigest).toBe(records[0]?.recordDigest);
    expect(verification.valid).toBe(true);
    expect(text.trim().split(/\r?\n/)).toHaveLength(2);
    expect(text).not.toContain("header.payload.signature");
    expect(text).not.toContain("https://agency.example");
  });

  it("refuses to append when the existing ledger has been tampered with", async () => {
    const dir = await tempDir();
    const filePath = resolveInstitutionAuditLedgerPath(dir);
    const first = await appendInstitutionAuditLedgerFileRecord(filePath, event(1), now);
    const tampered = { ...first, event: { ...first.event, outcome: "DENIED" } };
    await writeFile(filePath, `${JSON.stringify(tampered)}\n`, "utf8");

    await expect(appendInstitutionAuditLedgerFileRecord(filePath, event(2), now + 1)).rejects.toThrow("not appendable");
    expect(await readInstitutionAuditLedgerFile(filePath)).toHaveLength(1);
  });

  it("keeps ledger paths inside the configured base directory", async () => {
    const dir = await tempDir();

    expect(resolveInstitutionAuditLedgerPath(dir)).toContain("institution-auth-audit-ledger.jsonl");
    expect(() => resolveInstitutionAuditLedgerPath(dir, "../escape.jsonl")).toThrow("simple .jsonl");
    expect(() => resolveInstitutionAuditLedgerPath(dir, "audit.txt")).toThrow("simple .jsonl");
  });
});
