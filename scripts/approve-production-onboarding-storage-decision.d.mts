export const PRODUCTION_ONBOARDING_STORAGE_DECISION_APPROVAL_BUNDLE_DIR: "dist/production-onboarding-storage-decision";
export const REQUIRED_STORAGE_DECISION_SECTIONS: readonly ["auditLedgerStorage", "accountRegistryStorage"];

export type ProductionOnboardingStorageDecisionSection = (typeof REQUIRED_STORAGE_DECISION_SECTIONS)[number];

export type ProductionOnboardingStorageDecisionApprovalReport = {
  schema: "jium-production-onboarding-storage-decision-approval-v1";
  generatedAt: string;
  status: "SECTION_APPROVED" | "BLOCKED";
  version: string;
  summary: {
    section: string;
    approvedSectionCount: number;
    requiredSectionCount: number;
    decisionStatus: "APPROVED" | "PENDING_STORAGE_APPROVAL" | "UNKNOWN" | string;
  };
  evidence: {
    evidenceRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    evidenceRefDigest: string;
  };
  target: {
    onboardingDir: string;
    file: "storage-decision.template.json";
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateProductionOnboardingStorageDecisionApproval(options?: {
  root?: string;
  onboardingDir?: string;
  section?: ProductionOnboardingStorageDecisionSection | "audit-ledger" | "account-registry" | string;
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
    section: string;
    approvedSectionCountBefore: number;
    requiredSectionCount: number;
  };
};

export function approveProductionOnboardingStorageDecisionSection(options?: {
  root?: string;
  onboardingDir?: string;
  section?: ProductionOnboardingStorageDecisionSection | "audit-ledger" | "account-registry" | string;
  evidenceRef?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: ProductionOnboardingStorageDecisionApprovalReport;
}>;

export function formatProductionOnboardingStorageDecisionApprovalMarkdown(
  report: ProductionOnboardingStorageDecisionApprovalReport,
): string;
