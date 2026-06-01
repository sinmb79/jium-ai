export const TRUSTED_KEY_REGISTRY_APPLY_BUNDLE_DIR: "dist/trusted-key-onboarding";

export type TrustedKeyRegistryApplyStatus = "APPLIED" | "BLOCKED";

export type TrustedKeyRegistryApplyReport = {
  schema: "jium-trusted-key-registry-apply-v1";
  generatedAt: string;
  status: TrustedKeyRegistryApplyStatus;
  version: string;
  summary: {
    previousKeyCount: number;
    newKeyCount: number;
    activeKeyCount: number;
    changedKeyCount: number;
  };
  approval: {
    approvalRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    approvalRefDigest: string;
  };
  patch: {
    source: string;
    validationStatus: "PASS" | "BLOCKED";
    applied: boolean;
  };
  registry: {
    target: string;
    fileStatus: "WRITTEN" | "UNCHANGED";
    validationStatus: "PASS" | "BLOCKED";
  };
  changedKeyIds: string[];
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateTrustedKeyRegistryPatchApplication(options?: {
  root?: string;
  patchPath?: string;
  approvalRef?: string;
  now?: number;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  approval: {
    approvalRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    approvalRefDigest: string;
  };
  patch: {
    source: string;
    keyCount: number;
    activeKeyCount: number;
    validationStatus: "PASS" | "BLOCKED";
  };
};

export function applyTrustedKeyRegistryPatch(options?: {
  root?: string;
  patchPath?: string;
  approvalRef?: string;
  generatedAt?: string;
  now?: number;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: TrustedKeyRegistryApplyReport;
}>;

export function formatTrustedKeyRegistryApplyMarkdown(report: TrustedKeyRegistryApplyReport): string;
