export const OPERATIONAL_GO_LIVE_ENV_APPLY_BUNDLE_DIR: "dist/operational-go-live-env";

export type OperationalGoLiveEnvApplyReport = {
  schema: "jium-operational-go-live-env-apply-v1";
  generatedAt: string;
  status: "APPLIED" | "BLOCKED";
  summary: {
    approvalRecordsStatus: "READY" | "BLOCKED" | string;
    approvalFlagCount: number;
    envPath: string;
    envUpdateStatus: "UPDATED" | "UNCHANGED" | "SKIPPED" | string;
    incidentOwnerStatus: "SET_REDACTED" | "BLOCKED" | string;
    approvalRecordsSourceStatus: string;
    approvalRecordsFileStatus: string;
  };
  evidence: {
    incidentOwnerRefStatus: "SET_REDACTED" | "BLOCKED";
    incidentOwnerRefDigest: string;
    approvalRecordsDigest: string;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateOperationalGoLiveEnvApply(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
  incidentOwnerRef?: string;
  now?: number;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidence: OperationalGoLiveEnvApplyReport["evidence"];
  summary: {
    approvalRecordsStatus: string;
    approvalFlagCount: number;
    envPath: string;
    incidentOwnerRefStatus: string;
  };
};

export function applyOperationalGoLiveEnv(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
  incidentOwnerRef?: string;
  generatedAt?: string;
  now?: number;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: OperationalGoLiveEnvApplyReport;
}>;

export function formatOperationalGoLiveEnvApplyMarkdown(report: OperationalGoLiveEnvApplyReport): string;
