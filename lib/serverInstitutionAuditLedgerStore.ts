import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  appendInstitutionAuditLedgerRecord,
  verifyInstitutionAuditLedger,
  type InstitutionAuditLedgerRecord,
} from "@/lib/institutionAuditLedger";
import type { InstitutionAuditEvent, InstitutionAuditSink } from "@/lib/institutionAuditLog";

export const DEFAULT_INSTITUTION_AUDIT_LEDGER_FILE = "institution-auth-audit-ledger.jsonl";

export type InstitutionAuditLedgerFileStore = {
  filePath: string;
  append: InstitutionAuditSink;
  read: () => Promise<InstitutionAuditLedgerRecord[]>;
  verify: () => Promise<Awaited<ReturnType<typeof verifyInstitutionAuditLedger>>>;
};

function assertSafeLedgerFileName(fileName: string) {
  if (!/^[a-zA-Z0-9._-]+\.jsonl$/.test(fileName)) {
    throw new Error("institution audit ledger file name must be a simple .jsonl file name");
  }
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("institution audit ledger file name must not contain path traversal");
  }
}

export function resolveInstitutionAuditLedgerPath(baseDir: string, fileName = DEFAULT_INSTITUTION_AUDIT_LEDGER_FILE) {
  assertSafeLedgerFileName(fileName);
  const root = path.resolve(baseDir);
  const filePath = path.resolve(root, fileName);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("institution audit ledger path escapes the configured base directory");
  }
  return filePath;
}

export async function readInstitutionAuditLedgerFile(filePath: string): Promise<InstitutionAuditLedgerRecord[]> {
  try {
    const text = await readFile(filePath, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const parsed = JSON.parse(line);
        if (!parsed || typeof parsed !== "object") {
          throw new Error(`institution audit ledger line ${index + 1} is not a JSON object`);
        }
        return parsed as InstitutionAuditLedgerRecord;
      });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendInstitutionAuditLedgerFileRecord(
  filePath: string,
  event: InstitutionAuditEvent,
  now = Date.now(),
) {
  const records = await readInstitutionAuditLedgerFile(filePath);
  const verification = await verifyInstitutionAuditLedger(records);
  if (!verification.valid) {
    throw new Error(`institution audit ledger is not appendable: ${verification.errors.join("; ")}`);
  }

  const record = await appendInstitutionAuditLedgerRecord(records, event, now);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record)}\n`, { flag: "a", encoding: "utf8" });
  return record;
}

export function createInstitutionAuditLedgerFileStore(
  baseDir: string,
  options: { fileName?: string; now?: () => number } = {},
): InstitutionAuditLedgerFileStore {
  const filePath = resolveInstitutionAuditLedgerPath(baseDir, options.fileName);
  return {
    filePath,
    append: (event) => appendInstitutionAuditLedgerFileRecord(filePath, event, options.now?.() ?? Date.now()).then(() => undefined),
    read: () => readInstitutionAuditLedgerFile(filePath),
    verify: async () => verifyInstitutionAuditLedger(await readInstitutionAuditLedgerFile(filePath)),
  };
}
