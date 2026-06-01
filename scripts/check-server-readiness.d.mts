import type { ServerStorageReadiness } from "./check-server-storage-readiness.mjs";

export type ServerRuntimeReadiness = {
  valid: boolean;
  errors: string[];
  profile: "github-pages-static" | "server-routes" | "local-build";
  keyCount: number;
  activeKeyCount: number;
  templateFiles: string[];
  envSummary: ServerRuntimeEnvSummary;
  storage: ServerStorageReadiness;
};

export const REQUIRED_SERVER_ROUTE_TEMPLATES: string[];
export const REQUIRED_SERVER_ENV_KEYS: string[];

export type ServerRuntimeEnvSummary = {
  JIUM_SERVER_ROUTES: "TRUE" | "MISSING_OR_FALSE";
  GITHUB_PAGES: "TRUE_BLOCKED" | "NOT_TRUE";
  INSTITUTION_SESSION_SECRET: "SET" | "SET_WEAK" | "MISSING";
  NEXT_PUBLIC_INSTITUTION_SESSION_SECRET: "SET_BLOCKED" | "NOT_SET";
  INSTITUTION_ALLOWED_ORIGINS: "SET" | "MISSING";
  INSTITUTION_ALLOWED_ORIGINS_COUNT: number;
  INSTITUTION_AUDIT_LEDGER_DIR: "SET" | "MISSING";
  INSTITUTION_ACCOUNT_REGISTRY_DIR: "SET" | "MISSING";
  INSTITUTION_SECURE_COOKIES: "FALSE" | "DEFAULT_OR_TRUE";
};

export type ServerRuntimeReadinessReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  profile: "github-pages-static" | "server-routes" | "local-build";
  summary: {
    errorCount: number;
    keyCount: number;
    activeKeyCount: number;
    routeTemplateCount: number;
    requiredRouteTemplateCount: number;
    allowedOriginCount: number;
    storageStatus: "READY" | "BLOCKED";
    storageReadyDirectoryCount: number;
    storageRequiredDirectoryCount: number;
  };
  envSummary: ServerRuntimeEnvSummary;
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function summarizeServerRuntimeEnv(env?: Record<string, string | undefined>): ServerRuntimeEnvSummary;

export function validateServerRuntimeReadiness(options?: {
  root?: string;
  templateRoot?: string;
  env?: Record<string, string | undefined>;
}): ServerRuntimeReadiness;

export function buildServerRuntimeReadinessReport(
  readiness: ServerRuntimeReadiness,
  options?: { generatedAt?: string },
): ServerRuntimeReadinessReport;

export function formatServerRuntimeReadinessMarkdown(report: ServerRuntimeReadinessReport): string;
