export const DEFAULT_SERVER_STORAGE_DIR_NAMES: {
  INSTITUTION_AUDIT_LEDGER_DIR: "audit-ledger";
  INSTITUTION_ACCOUNT_REGISTRY_DIR: "account-registry";
};

export type ServerStorageInitPlan = {
  schema: "jium-server-storage-init-v1";
  generatedAt: string;
  status: "READY" | "BLOCKED";
  mode: "DIRECTORY_ONLY" | "DIRECTORY_AND_ENV_UPDATE";
  summary: {
    createdDirectoryCount: number;
    readyDirectoryCount: number;
    requiredDirectoryCount: number;
    envUpdateStatus: "UPDATED" | "UNCHANGED" | "SKIPPED";
  };
  envFile: {
    path: string;
    status: "UPDATED" | "UNCHANGED" | "SKIPPED";
    keyStatuses: Record<string, "ADDED" | "UPDATED" | "UNCHANGED" | "PRESERVED" | "SKIPPED">;
  };
  targets: Array<{
    envKey: string;
    directoryName: string;
    pathStatus: "REPO_EXTERNAL" | "BLOCKED_REPOSITORY_PATH";
  }>;
  readiness: {
    status: "READY" | "BLOCKED";
    errorCount: number;
    nextActions: string[];
  };
  safetyNotes: string[];
};

export function buildServerStorageInitPlan(options?: {
  root?: string;
  storageRoot?: string;
  platform?: NodeJS.Platform | string;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
  createDirs?: boolean;
  writeEnv?: boolean;
  forceEnv?: boolean;
  generatedAt?: string;
}): ServerStorageInitPlan;

export function formatServerStorageInitMarkdown(plan: ServerStorageInitPlan): string;
