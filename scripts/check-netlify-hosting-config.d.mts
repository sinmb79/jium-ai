export const NETLIFY_HOSTING_CONFIG_SCHEMA: "jium-netlify-hosting-config-v1";
export const NETLIFY_HOSTING_CONFIG_DIR: "dist/netlify-hosting-config";
export const NETLIFY_HOSTING_CONFIG_JSON: "netlify-hosting-config-report.json";
export const NETLIFY_HOSTING_CONFIG_MARKDOWN: "netlify-hosting-config-report.md";

export type NetlifyHostingConfigReport = {
  schema: typeof NETLIFY_HOSTING_CONFIG_SCHEMA;
  generatedAt: string;
  status: "READY" | "BLOCKED";
  version: string;
  configPath: "netlify.toml" | string;
  required: {
    buildCommand: string;
    publishDirectory: string;
    nodeVersion: string;
    uploadIgnoreEntries: string[];
  };
  summary: {
    configFileStatus: "FOUND" | "MISSING" | string;
    uploadIgnoreFileStatus: "FOUND" | "MISSING" | string;
    buildCommandStatus: "READY" | "BLOCKED" | string;
    publishDirectoryStatus: "READY" | "BLOCKED" | string;
    nodeVersionStatus: "READY" | "BLOCKED" | string;
    uploadIgnoreStatus: "READY" | "BLOCKED" | string;
    telemetryStatus: "READY" | "WARNING" | string;
    unsafeFindingCount: number;
    missingIgnoreEntryCount: number;
  };
  unsafeFindings: Array<{
    id: string;
    label: string;
  }>;
  errors: string[];
  warnings: string[];
  missingIgnoreEntries: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateNetlifyHostingConfig(options?: {
  root?: string;
  generatedAt?: string;
}): {
  valid: boolean;
  report: NetlifyHostingConfigReport;
};

export function formatNetlifyHostingConfigMarkdown(report: NetlifyHostingConfigReport): string;

export function writeNetlifyHostingConfigReportFiles(options?: {
  root?: string;
  report: NetlifyHostingConfigReport;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  reportDir: string;
  reportDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};
