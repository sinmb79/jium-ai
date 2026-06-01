import type { DesktopPublishReadiness } from "./check-desktop-publish-readiness.mjs";
import type { OperationalApprovalRecordsReadiness } from "./check-operational-approval-records.mjs";
import type { ProductionOnboardingReadiness } from "./check-production-onboarding.mjs";
import type { ServerRuntimeReadiness } from "./check-server-readiness.mjs";

export type OperationalGoLiveEnvSummary = {
  JIUM_GO_LIVE_APPROVAL: "APPROVED" | "MISSING_OR_NOT_APPROVED";
  JIUM_LEGAL_REVIEW_APPROVAL: "APPROVED" | "MISSING_OR_NOT_APPROVED";
  JIUM_RELEASE_EVIDENCE_REVIEW: "APPROVED" | "MISSING_OR_NOT_APPROVED";
  JIUM_DATA_RETENTION_POLICY_ACK: "APPROVED" | "MISSING_OR_NOT_APPROVED";
  JIUM_PUBLIC_APP_URL: "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID" | "MISSING";
  JIUM_PRIVACY_NOTICE_URL: "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID" | "MISSING";
  JIUM_SUPPORT_CONTACT_ROUTE: "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID" | "MISSING";
  JIUM_INCIDENT_RESPONSE_OWNER: "SET" | "MISSING";
  JIUM_OPERATIONAL_APPROVAL_RECORDS: "SET" | "DEFAULT_PRIVATE_PATH";
  JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: "SET" | "MISSING";
};

export type HostedSecurityHeaderAuditReadiness = {
  valid: boolean;
  errors: string[];
  sourceSummary: {
    JIUM_HOSTED_SECURITY_HEADER_AUDIT_REPORT: "SET" | "MISSING";
    fileStatus: "FOUND" | "MISSING" | "INVALID_JSON";
    schema: string;
    status: string;
    targetUrlState: string;
    fetchState: string;
    httpStatus: number | null;
    checkedHeaderCount: number;
    passCount: number;
    failureCount: number;
  };
};

export type OperationalGoLiveReadiness = {
  valid: boolean;
  errors: string[];
  envSummary: OperationalGoLiveEnvSummary;
  serverRuntime: ServerRuntimeReadiness;
  desktopPublish: DesktopPublishReadiness;
  approvalRecords: OperationalApprovalRecordsReadiness;
  productionOnboarding: ProductionOnboardingReadiness;
  hostedSecurityHeaderAudit: HostedSecurityHeaderAuditReadiness;
};

export type OperationalGoLiveReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  summary: {
    errorCount: number;
    serverStatus: "READY" | "BLOCKED";
    desktopPublishStatus: "READY" | "BLOCKED";
    approvalRecordsStatus: "READY" | "BLOCKED";
    productionOnboardingStatus: "READY" | "BLOCKED";
    hostedSecurityHeaderAuditStatus: "READY" | "BLOCKED";
    approvedApprovalRecordCount: number;
    requiredApprovalRecordCount: number;
    onboardingErrorCount: number;
    onboardingChecklistApprovedRecordCount: number;
    onboardingChecklistRequiredRecordCount: number;
    activeTrustedKeyCount: number;
    desktopReleaseTag: string;
    desktopPackageVersion: string;
    desktopPublishArtifactCount: number;
    hostedSecurityHeaderFailureCount: number;
  };
  envSummary: OperationalGoLiveEnvSummary;
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function summarizeOperationalGoLiveEnv(env?: NodeJS.ProcessEnv): OperationalGoLiveEnvSummary;

export function validateHostedSecurityHeaderAuditEvidence(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
}): HostedSecurityHeaderAuditReadiness;

export function validateOperationalGoLive(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  validations?: {
    serverRuntime?: ServerRuntimeReadiness;
    desktopPublish?: DesktopPublishReadiness;
    approvalRecords?: OperationalApprovalRecordsReadiness;
    productionOnboarding?: ProductionOnboardingReadiness;
    hostedSecurityHeaderAudit?: HostedSecurityHeaderAuditReadiness;
  };
}): Promise<OperationalGoLiveReadiness>;

export function buildOperationalGoLiveReport(
  readiness: OperationalGoLiveReadiness,
  options?: { generatedAt?: string },
): OperationalGoLiveReport;

export function formatOperationalGoLiveMarkdown(report: OperationalGoLiveReport): string;
