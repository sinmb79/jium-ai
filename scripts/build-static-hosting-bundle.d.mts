export const STATIC_HOSTING_BUNDLE_DIR: "dist/static-hosting-bundle";

export type StaticHostingExportReadiness = {
  valid: boolean;
  errors: string[];
  outDir: "out";
  foundFiles: string[];
  requiredFiles: string[];
  headerPolicyStatus: "READY" | "BLOCKED";
};

export type StaticHostingBundleReport = {
  schema: "jium-static-hosting-bundle-v1";
  generatedAt: string;
  status: "READY" | "BLOCKED";
  version: string;
  commit: string;
  providerTargets: string[];
  summary: {
    bundleDir: string;
    siteDir: string;
    requiredFileCount: number;
    foundFileCount: number;
    headerPolicyStatus: "READY" | "BLOCKED";
  };
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
  }>;
  errors: string[];
  deploymentCommands: string[];
  safetyNotes: string[];
};

export function validateStaticHostingExport(options?: {
  root?: string;
  outDir?: string;
}): StaticHostingExportReadiness;

export function formatStaticHostingBundleMarkdown(report: StaticHostingBundleReport): string;

export function buildStaticHostingBundle(options?: {
  root?: string;
  runner?: (...args: unknown[]) => { status?: number; error?: Error };
  generatedAt?: string;
  clean?: boolean;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  summary: StaticHostingBundleReport;
}>;
