import type { OperationalApprovalRecordsReadiness } from "./check-operational-approval-records.mjs";

export const REQUIRED_ONBOARDING_FILE_NAMES: string[];
export const REQUIRED_OPERATOR_CHECKLIST_RECORDS: string[];

export type ProductionOnboardingReadiness = {
  valid: boolean;
  errors: string[];
  packageVersion: string;
  onboardingDir: string;
  requiredFiles: Array<{
    fileName: string;
    status: "FOUND" | "MISSING";
  }>;
  serverEnv: {
    fileStatus: "FOUND" | "MISSING";
    JIUM_SERVER_ROUTES: "TRUE" | "MISSING_OR_FALSE";
    INSTITUTION_SESSION_SECRET: "SET" | "SET_WEAK" | "MISSING";
    INSTITUTION_ALLOWED_ORIGINS: "SET" | "MISSING" | "MISSING_OR_PLACEHOLDER";
    storageStatus: "READY" | "BLOCKED";
  };
  approvalRecords: OperationalApprovalRecordsReadiness;
  checklist: {
    valid: boolean;
    approvedRecordCount: number;
    requiredRecordCount: number;
    presentRecordIds: string[];
  };
  storageDecision: {
    valid: boolean;
    approvedSectionCount: number;
    requiredSectionCount: number;
  };
  publicOperations: {
    valid: boolean;
    approvedSectionCount: number;
    requiredSectionCount: number;
    httpsRouteCount: number;
    requiredRouteCount: number;
    envKeyStatuses: {
      JIUM_PUBLIC_APP_URL: "MISSING" | "PLACEHOLDER" | "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID";
      JIUM_PRIVACY_NOTICE_URL: "MISSING" | "PLACEHOLDER" | "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID";
      JIUM_SUPPORT_CONTACT_ROUTE: "MISSING" | "PLACEHOLDER" | "SET_HTTPS" | "SET_NOT_HTTPS" | "SET_INVALID";
    };
  };
  hostedSecurityHeaderAudit: {
    valid: boolean;
    status: string;
    envKeyStatus: "SET" | "MISSING";
    fileStatus: "FOUND" | "MISSING" | "INVALID_JSON";
    targetUrlState: string;
    fetchState: string;
    httpStatus: number | null;
    failureCount: number;
  };
  trustedKeyExample: {
    valid: boolean;
  };
};

export type ProductionOnboardingReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  summary: {
    errorCount: number;
    packageVersion: string;
    onboardingDir: string;
    requiredFileCount: number;
    foundFileCount: number;
    checklistApprovedRecordCount: number;
    checklistRequiredRecordCount: number;
    storageApprovedSectionCount: number;
    storageRequiredSectionCount: number;
    publicOperationsApprovedSectionCount: number;
    publicOperationsRequiredSectionCount: number;
    publicOperationsHttpsRouteCount: number;
    publicOperationsRequiredRouteCount: number;
    hostedSecurityHeaderAuditStatus: "READY" | "BLOCKED";
    hostedSecurityHeaderFailureCount: number;
    approvalRecordsStatus: "READY" | "BLOCKED";
    serverStorageStatus: "READY" | "BLOCKED";
  };
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateProductionOnboarding(options?: {
  root?: string;
  env?: Record<string, string | undefined>;
  onboardingDir?: string;
  now?: number;
}): ProductionOnboardingReadiness;

export function buildProductionOnboardingReport(
  readiness: ProductionOnboardingReadiness,
  options?: { generatedAt?: string },
): ProductionOnboardingReport;

export function formatProductionOnboardingMarkdown(report: ProductionOnboardingReport): string;
