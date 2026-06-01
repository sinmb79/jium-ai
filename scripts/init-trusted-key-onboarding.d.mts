export const TRUSTED_KEY_ONBOARDING_BUNDLE_DIR: "dist/trusted-key-onboarding";

export type TrustedKeyOnboardingStatus = "READY_FOR_APPROVAL" | "NEEDS_REVIEW" | "BLOCKED";

export type TrustedKeyOnboardingPlan = {
  valid: boolean;
  errors: string[];
  keyId: string;
  issuerName: string;
  privateKeyPathState: "REPO_EXTERNAL" | "BLOCKED";
  validFrom: string;
  validUntil: string;
};

export type TrustedKeyOnboardingReport = {
  schema: "jium-trusted-key-onboarding-v1";
  generatedAt: string;
  status: TrustedKeyOnboardingStatus;
  version: string;
  key: {
    keyId: string;
    issuerName: string;
    fingerprint?: string;
    algorithm: string;
    validFromStatus: "SET" | "INVALID_OR_MISSING";
    validUntilStatus: "SET" | "INVALID_OR_MISSING";
  };
  privateKey: {
    pathState: "REPO_EXTERNAL" | "BLOCKED";
    fileStatus: "WRITTEN" | "NOT_WRITTEN";
    fileName?: string;
  };
  candidate: {
    fileStatus: "WRITTEN" | "NOT_WRITTEN";
    relativePath: string;
  };
  patch?: {
    fileStatus: "WRITTEN" | "NOT_WRITTEN";
    relativePath: string;
  };
  review: {
    status: TrustedKeyOnboardingStatus;
    fingerprint: string;
    validationStatus: "PASS" | "BLOCKED";
    patchWritten: boolean;
    warningCount: number;
    errorCount: number;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateTrustedKeyOnboardingPlan(options?: {
  root?: string;
  privateKeyDir?: string;
  keyId?: string;
  issuerName?: string;
  validFrom?: string;
  validUntil?: string;
  now?: number;
}): TrustedKeyOnboardingPlan;

export function buildTrustedKeyOnboardingBundle(options?: {
  root?: string;
  privateKeyDir?: string;
  keyId?: string;
  issuerName?: string;
  validFrom?: string;
  validUntil?: string;
  candidateOutputPath?: string;
  patchOutputPath?: string;
  generatedAt?: string;
  now?: number;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: TrustedKeyOnboardingReport;
}>;

export function formatTrustedKeyOnboardingMarkdown(report: TrustedKeyOnboardingReport): string;
