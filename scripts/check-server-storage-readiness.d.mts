export const REQUIRED_SERVER_STORAGE_ENV_KEYS: string[];

export type ServerStorageReadinessTarget = {
  envKey: "INSTITUTION_AUDIT_LEDGER_DIR" | "INSTITUTION_ACCOUNT_REGISTRY_DIR";
  configured: boolean;
  status: "READY" | "BLOCKED" | "MISSING";
  checks: {
    present: "PASS" | "BLOCKED";
    noPlaceholder: "PASS" | "BLOCKED";
    absolutePath: "PASS" | "BLOCKED";
    outsideRepository: "PASS" | "BLOCKED";
    outsidePublicBuildDirs: "PASS" | "BLOCKED";
    writable: "PASS" | "BLOCKED" | "SKIPPED";
  };
};

export type ServerStorageReadiness = {
  valid: boolean;
  errors: string[];
  writeProbe: "ENABLED" | "SKIPPED";
  summary: {
    requiredDirectoryCount: number;
    configuredDirectoryCount: number;
    readyDirectoryCount: number;
  };
  targets: ServerStorageReadinessTarget[];
};

export type ServerStorageReadinessReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  writeProbe: "ENABLED" | "SKIPPED";
  summary: ServerStorageReadiness["summary"];
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
    detail: ServerStorageReadinessTarget["checks"];
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateServerStorageReadiness(options?: {
  root?: string;
  env?: Record<string, string | undefined>;
  writeProbe?: boolean;
}): ServerStorageReadiness;

export function buildServerStorageReadinessReport(
  readiness: ServerStorageReadiness,
  options?: { generatedAt?: string },
): ServerStorageReadinessReport;

export function formatServerStorageReadinessMarkdown(report: ServerStorageReadinessReport): string;
