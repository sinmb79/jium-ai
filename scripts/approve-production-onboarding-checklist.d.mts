export const PRODUCTION_ONBOARDING_CHECKLIST_APPROVAL_BUNDLE_DIR: "dist/production-onboarding-checklist";

export type ProductionOnboardingChecklistApprovalReport = {
  schema: "jium-production-onboarding-checklist-approval-v1";
  generatedAt: string;
  status: "RECORD_APPROVED" | "BLOCKED";
  version: string;
  summary: {
    recordId: string;
    approvedRecordCount: number;
    requiredRecordCount: number;
    checklistStatus: "APPROVED" | "PENDING_EXTERNAL_APPROVALS" | "UNKNOWN" | string;
  };
  evidence: {
    evidenceRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    evidenceRefDigest: string;
  };
  target: {
    onboardingDir: string;
    file: "operator-checklist.json";
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateProductionOnboardingChecklistApproval(options?: {
  root?: string;
  onboardingDir?: string;
  recordId?: string;
  evidenceRef?: string;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidence: {
    evidenceRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    evidenceRefDigest: string;
  };
  summary: {
    recordId: string;
    approvedRecordCountBefore: number;
    requiredRecordCount: number;
  };
};

export function approveProductionOnboardingChecklistRecord(options?: {
  root?: string;
  onboardingDir?: string;
  recordId?: string;
  evidenceRef?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: ProductionOnboardingChecklistApprovalReport;
}>;

export function formatProductionOnboardingChecklistApprovalMarkdown(report: ProductionOnboardingChecklistApprovalReport): string;
