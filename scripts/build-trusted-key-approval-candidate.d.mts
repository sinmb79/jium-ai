export const TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA: "jium-trusted-key-approval-candidate-v1";
export const TRUSTED_KEY_APPROVAL_CANDIDATE_DIR: "dist/trusted-key-approval-candidate";
export const TRUSTED_KEY_APPROVAL_CANDIDATE_JSON: "trusted-key-approval-candidate-report.json";
export const TRUSTED_KEY_APPROVAL_CANDIDATE_MARKDOWN: "trusted-key-approval-candidate-report.md";

export type TrustedKeyApprovalCandidateReport = {
  schema: typeof TRUSTED_KEY_APPROVAL_CANDIDATE_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_TRUSTED_KEY_APPROVAL" | "NEEDS_TRUSTED_KEY_REVIEW" | "BLOCKED";
  version: string;
  key: {
    keyId: string;
    fingerprint: string;
    algorithm: string;
    validFromStatus: string;
    validUntilStatus: string;
  };
  source: {
    onboardingReportPath: string;
    onboardingReportStatus: string;
    sourceReportDigest: string;
  };
  review: {
    status: string;
    validationStatus: string;
    patchWritten: boolean;
    warningCount: number;
    errorCount: number;
  };
  privateKey: {
    pathState: string;
    fileStatus: string;
  };
  artifacts: Array<{
    label: string;
    path: string;
    fileStatus: "PRESENT" | "MISSING";
    bytes: number;
    digest: string;
    unsafeFindingCount: number;
    unsafeFindings: Array<{
      id: string;
      label: string;
      location: string;
    }>;
  }>;
  summary: {
    artifactCount: number;
    readyArtifactCount: number;
    unsafeFindingCount: number;
    errorCount: number;
    warningCount: number;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function buildTrustedKeyApprovalCandidate(options?: {
  root?: string;
  onboardingReportPath?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  report: TrustedKeyApprovalCandidateReport;
  reportDir: string;
  reportDirRelative: string;
}>;

export function formatTrustedKeyApprovalCandidateMarkdown(report: TrustedKeyApprovalCandidateReport): string;

export function writeTrustedKeyApprovalCandidateOutput(options?: {
  root?: string;
  report: TrustedKeyApprovalCandidateReport;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  outputPath: string;
  outputPathRelative: string;
};
