import type { DesktopExportVerification } from "./build-desktop-export.mjs";

export const REQUIRED_DESKTOP_FILES: string[];
export const REQUIRED_DESKTOP_PACKAGE_SCRIPTS: string[];
export const REQUIRED_DESKTOP_RUNTIME_DEPENDENCIES: string[];
export const REQUIRED_DESKTOP_DEV_DEPENDENCIES: string[];

export type DesktopReleaseEnvSummary = {
  JIUM_DESKTOP_RELEASE_CHANNEL: "SET" | "MISSING";
  JIUM_DESKTOP_UPDATE_URL: "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID" | "MISSING";
  WINDOWS_SIGNING_PROFILE: "SET" | "MISSING";
  APPLE_SIGNING_PROFILE: "SET" | "MISSING";
  LINUX_SIGNING_PROFILE: "SET" | "MISSING";
  SIGNING_PROFILE_COUNT: number;
  WINDOWS_ELECTRON_BUILDER_SIGNING_PROFILE: "SET" | "MISSING";
};

export type DesktopReleaseReadiness = {
  valid: boolean;
  errors: string[];
  envSummary: DesktopReleaseEnvSummary;
  staticExport: DesktopExportVerification;
  requiredFiles: string[];
  requiredScripts: string[];
  requiredRuntimeDependencies: string[];
  requiredDevDependencies: string[];
};

export type DesktopReleaseReadinessReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  summary: {
    errorCount: number;
    signingProfileCount: number;
    staticRouteCount: number;
    requiredStaticRouteCount: number;
  };
  envSummary: DesktopReleaseEnvSummary;
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function summarizeDesktopReleaseEnv(env?: NodeJS.ProcessEnv): DesktopReleaseEnvSummary;

export function validateDesktopReleaseReadiness(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  outDir?: string;
}): DesktopReleaseReadiness;

export function buildDesktopReleaseReadinessReport(
  readiness: DesktopReleaseReadiness,
  options?: { generatedAt?: string },
): DesktopReleaseReadinessReport;

export function formatDesktopReleaseReadinessMarkdown(report: DesktopReleaseReadinessReport): string;
