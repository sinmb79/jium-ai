import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  emptyInstitutionAccountRegistry,
  validateInstitutionAccountRegistry,
  type InstitutionAccountRegistry,
} from "@/lib/institutionAccountRegistry";

export const DEFAULT_INSTITUTION_ACCOUNT_REGISTRY_FILE = "institution-accounts.json";

export type InstitutionAccountRegistryStore = {
  filePath: string;
  read: () => Promise<InstitutionAccountRegistry>;
  write: (registry: InstitutionAccountRegistry) => Promise<void>;
};

function assertSafeRegistryFileName(fileName: string) {
  if (!/^[a-zA-Z0-9._-]+\.json$/.test(fileName)) {
    throw new Error("institution account registry file name must be a simple .json file name");
  }
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("institution account registry file name must not contain path traversal");
  }
}

export function resolveInstitutionAccountRegistryPath(baseDir: string, fileName = DEFAULT_INSTITUTION_ACCOUNT_REGISTRY_FILE) {
  assertSafeRegistryFileName(fileName);
  const root = path.resolve(baseDir);
  const filePath = path.resolve(root, fileName);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("institution account registry path escapes the configured base directory");
  }
  return filePath;
}

export async function readInstitutionAccountRegistryFile(filePath: string, now = Date.now()): Promise<InstitutionAccountRegistry> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as InstitutionAccountRegistry;
    const errors = validateInstitutionAccountRegistry(parsed, now);
    if (errors.length) {
      throw new Error(`institution account registry is invalid: ${errors.join("; ")}`);
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyInstitutionAccountRegistry(now);
    }
    throw error;
  }
}

export async function writeInstitutionAccountRegistryFile(filePath: string, registry: InstitutionAccountRegistry, now = Date.now()) {
  const errors = validateInstitutionAccountRegistry(registry, now);
  if (errors.length) {
    throw new Error(`institution account registry is invalid: ${errors.join("; ")}`);
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export function createInstitutionAccountRegistryFileStore(
  baseDir: string,
  options: { fileName?: string; now?: () => number } = {},
): InstitutionAccountRegistryStore {
  const filePath = resolveInstitutionAccountRegistryPath(baseDir, options.fileName);
  return {
    filePath,
    read: () => readInstitutionAccountRegistryFile(filePath, options.now?.() ?? Date.now()),
    write: (registry) => writeInstitutionAccountRegistryFile(filePath, registry, options.now?.() ?? Date.now()),
  };
}
