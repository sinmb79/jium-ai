export type TrustedKeyCandidateReviewStatus = "READY_FOR_APPROVAL" | "NEEDS_REVIEW" | "BLOCKED";

export type TrustedKeyCandidateReviewReport = {
  generatedAt: string;
  status: TrustedKeyCandidateReviewStatus;
  key: {
    keyId: string;
    issuerName: string;
    fingerprint: string;
    algorithm: "RSASSA-PKCS1-v1_5" | "INVALID_OR_MISSING";
    validFromStatus: "SET" | "MISSING";
    validUntilStatus: "SET" | "MISSING";
  };
  registry: {
    version: "jium-authorized-feed-trusted-keys-v1" | "INVALID_OR_MISSING";
    keyCount: number;
    validationStatus: "PASS" | "BLOCKED";
  };
  patch: {
    requested: boolean;
    written: boolean;
  };
  errors: string[];
  warnings: string[];
  checklist: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function reviewTrustedKeyCandidateFile(options?: {
  root?: string;
  candidatePath?: string;
  registryPath?: string;
  patchOutputPath?: string;
  generatedAt?: string;
  now?: number;
}): Promise<{
  valid: boolean;
  report: TrustedKeyCandidateReviewReport;
}>;

export function formatTrustedKeyCandidateReviewMarkdown(report: TrustedKeyCandidateReviewReport): string;
