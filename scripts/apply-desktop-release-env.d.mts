export const DESKTOP_RELEASE_ENV_APPLY_BUNDLE_DIR: "dist/desktop-release-env";

export type DesktopReleaseEnvApplyReport = {
  schema: "jium-desktop-release-env-apply-v1";
  generatedAt: string;
  status: "APPLIED" | "BLOCKED";
  summary: {
    packageVersion: string;
    releaseTag: string;
    envPath: string;
    envUpdateStatus: "UPDATED" | "UNCHANGED" | "SKIPPED" | string;
    releaseTagStatus: "SET" | "BLOCKED" | string;
    channelStatus: "SET_REDACTED" | "BLOCKED" | string;
    updateUrlStatus: "SET_HTTPS_REDACTED" | "BLOCKED" | string;
    publishApprovalRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED" | string;
  };
  evidence: {
    channelStatus: "SET_REDACTED" | "BLOCKED";
    updateUrlStatus: "SET_HTTPS_REDACTED" | "BLOCKED";
    releaseTagStatus: "SET" | "BLOCKED";
    publishApprovalRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    channelDigest: string;
    updateUrlDigest: string;
    publishApprovalRefDigest: string;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateDesktopReleaseEnvApply(options?: {
  root?: string;
  envPath?: string;
  channel?: string;
  updateUrl?: string;
  releaseTag?: string;
  publishApprovalRef?: string;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidence: DesktopReleaseEnvApplyReport["evidence"];
  summary: {
    envPath: string;
    packageVersion: string;
    releaseTagStatus: string;
    channelStatus: string;
    updateUrlStatus: string;
    publishApprovalRefStatus: string;
  };
};

export function applyDesktopReleaseEnv(options?: {
  root?: string;
  envPath?: string;
  channel?: string;
  updateUrl?: string;
  releaseTag?: string;
  publishApprovalRef?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: DesktopReleaseEnvApplyReport;
}>;

export function formatDesktopReleaseEnvApplyMarkdown(report: DesktopReleaseEnvApplyReport): string;
