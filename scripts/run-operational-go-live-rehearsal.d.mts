export const OPERATIONAL_GO_LIVE_REHEARSAL_SCHEMA: "jium-operational-go-live-rehearsal-v1";
export const OPERATIONAL_GO_LIVE_REHEARSAL_BUNDLE_DIR: "dist/operational-go-live-rehearsal";

export interface OperationalGoLiveRehearsalCheck {
  id: string;
  label: string;
  status: "PASS" | "BLOCKED" | string;
}

export interface OperationalGoLiveRehearsalReport {
  schema: typeof OPERATIONAL_GO_LIVE_REHEARSAL_SCHEMA;
  generatedAt: string;
  status: "READY" | "BLOCKED";
  version: string;
  summary: {
    goLiveStatus: "READY" | "BLOCKED" | string;
    goLiveErrorCount: number;
    serverStatus: "READY" | "BLOCKED" | string;
    productionOnboardingStatus: "READY" | "BLOCKED" | string;
    approvalRecordsStatus: "READY" | "BLOCKED" | string;
    hostedSecurityHeaderAuditStatus: "READY" | "BLOCKED" | string;
    activeTrustedKeyCount: number;
    approvedApprovalRecordCount: number;
    requiredApprovalRecordCount: number;
    approvalInputsStatus: "APPLIED" | "READY_TO_APPLY" | "BLOCKED" | "MISSING" | string;
    approvalInputsReadyInputCount: number;
    approvalInputsTotalInputCount: number;
    approvalInputsAppliedCount: number;
    approvalInputsApprovalRecordsStatus: "READY" | "BLOCKED" | "MISSING" | string;
    approvalInputsProductionOnboardingStatus: "READY" | "BLOCKED" | "MISSING" | string;
    approvalInputsLeakScanStatus: "PASS" | "BLOCKED" | "MISSING" | string;
    cleanedTemporaryWorkspace: "YES" | "NO";
  };
  simulation: {
    desktopPublishMode: "SIMULATED_SIGNED_ARTIFACTS";
    publicRoutesMode: "SYNTHETIC_HTTPS_URLS";
    approvalsMode: "SYNTHETIC_BATCH_INPUTS";
    workspaceMode: "TEMPORARY_REPO_EXTERNAL";
  };
  checks: OperationalGoLiveRehearsalCheck[];
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
}

export function runOperationalGoLiveRehearsal(options?: {
  root?: string;
  generatedAt?: string;
  now?: number;
  platform?: NodeJS.Platform | string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: OperationalGoLiveRehearsalReport;
}>;

export function formatOperationalGoLiveRehearsalMarkdown(report: OperationalGoLiveRehearsalReport): string;
