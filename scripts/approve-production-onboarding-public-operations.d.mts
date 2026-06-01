export const PRODUCTION_ONBOARDING_PUBLIC_OPERATIONS_APPROVAL_BUNDLE_DIR: "dist/production-onboarding-public-operations";
export const REQUIRED_PUBLIC_OPERATIONS_SECTIONS: readonly ["publicApp", "privacyNotice", "supportRoute"];

export type ProductionOnboardingPublicOperationsSection = (typeof REQUIRED_PUBLIC_OPERATIONS_SECTIONS)[number];

export type ProductionOnboardingPublicOperationsApprovalReport = {
  schema: "jium-production-onboarding-public-operations-approval-v1";
  generatedAt: string;
  status: "SECTION_APPROVED" | "BLOCKED";
  version: string;
  summary: {
    section: string;
    approvedSectionCount: number;
    requiredSectionCount: number;
    publicOperationsStatus: "APPROVED" | "PENDING_PUBLIC_OPERATIONS_APPROVAL" | "UNKNOWN" | string;
  };
  evidence: {
    evidenceRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    evidenceRefDigest: string;
  };
  target: {
    onboardingDir: string;
    file: "public-operations.template.json";
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateProductionOnboardingPublicOperationsApproval(options?: {
  root?: string;
  onboardingDir?: string;
  section?: ProductionOnboardingPublicOperationsSection | "public-app" | "privacy-notice" | "support-route" | string;
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

export function approveProductionOnboardingPublicOperationsSection(options?: {
  root?: string;
  onboardingDir?: string;
  section?: ProductionOnboardingPublicOperationsSection | "public-app" | "privacy-notice" | "support-route" | string;
  evidenceRef?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: ProductionOnboardingPublicOperationsApprovalReport;
}>;

export function formatProductionOnboardingPublicOperationsApprovalMarkdown(
  report: ProductionOnboardingPublicOperationsApprovalReport,
): string;
