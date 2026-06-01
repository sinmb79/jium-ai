import type { ServerRuntimeReadiness } from "./check-server-readiness.mjs";

export const SERVER_DEPLOYMENT_BUNDLE_DIR: "dist/server-deployment-bundle";

export type ServerRouteMaterializationReadiness = {
  valid: boolean;
  errors: string[];
  profile: string;
  templateFiles: string[];
  routeFiles: string[];
  summary: {
    templateFileCount: number;
    routeFileCount: number;
  };
};

export type ServerRouteMaterializationReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  profile: string;
  summary: ServerRouteMaterializationReadiness["summary"];
  templateFiles: string[];
  routeFiles: string[];
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export type ServerDeploymentBundleSummary = {
  schema: "jium-server-deployment-bundle-v1";
  generatedAt: string;
  status: "READY" | "BLOCKED";
  version: string;
  commit: string;
  profile: "github-pages-static" | "server-routes" | "local-build";
  gates: Array<{
    id: string;
    status: "READY" | "BLOCKED";
    errorCount: number;
  }>;
  summary: {
    activeTrustedKeyCount: number;
    trustedKeyCount: number;
    routeTemplateCount: number;
    plannedRouteFileCount: number;
    storageReadyDirectoryCount: number;
    storageRequiredDirectoryCount: number;
  };
  reports: Record<string, string>;
  deploymentCommands: string[];
  externalRecordsNeeded: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateServerRouteMaterialization(options?: {
  root?: string;
  templateRoot?: string;
  env?: Record<string, string | undefined>;
}): ServerRouteMaterializationReadiness;

export function buildServerRouteMaterializationReport(
  plan: ServerRouteMaterializationReadiness,
  options?: { generatedAt?: string },
): ServerRouteMaterializationReport;

export function formatServerRouteMaterializationMarkdown(report: ServerRouteMaterializationReport): string;

export function buildServerDeploymentBundle(options?: {
  root?: string;
  templateRoot?: string;
  env?: Record<string, string | undefined>;
  generatedAt?: string;
  validations?: {
    serverRuntime?: ServerRuntimeReadiness;
    routeMaterialization?: ServerRouteMaterializationReadiness;
  };
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  summary: ServerDeploymentBundleSummary;
}>;

export function formatServerDeploymentSummary(summary: ServerDeploymentBundleSummary): string;
