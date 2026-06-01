export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_SCHEMA: "jium-production-onboarding-evidence-digests-v1";
export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_DIR: "dist/production-onboarding-evidence-digests";
export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_JSON: "production-onboarding-evidence-digests.json";
export const PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_MARKDOWN: "production-onboarding-evidence-digests.md";

export type ProductionOnboardingEvidenceDigestStatus = "READY" | "BLOCKED";

export type ProductionOnboardingEvidenceUnsafeFinding = {
  fileName: string;
  id: string;
  label: string;
};

export type ProductionOnboardingEvidenceDigestFile = {
  id: string;
  role: string;
  fileName: string;
  status: ProductionOnboardingEvidenceDigestStatus;
  bytes: number;
  digest: string;
  unsafeFindings: ProductionOnboardingEvidenceUnsafeFinding[];
};

export type ProductionOnboardingEvidenceDigestReport = {
  schema: typeof PRODUCTION_ONBOARDING_EVIDENCE_DIGESTS_SCHEMA;
  generatedAt: string;
  status: ProductionOnboardingEvidenceDigestStatus;
  version: string;
  summary: {
    fileCount: number;
    readyFileCount: number;
    unsafeFindingCount: number;
    errorCount: number;
  };
  aggregateDigest: string;
  files: ProductionOnboardingEvidenceDigestFile[];
  excludedSources: Array<{
    id: string;
    fileName: string;
    reason: string;
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function getProductionOnboardingEvidenceSources(files?: string[]): Array<{
  role: string;
  fileName: string;
}>;

export function buildProductionOnboardingEvidenceDigests(options?: {
  root?: string;
  generatedAt?: string;
  files?: string[];
}): Promise<{
  valid: boolean;
  report: ProductionOnboardingEvidenceDigestReport;
}>;

export function formatProductionOnboardingEvidenceDigestsMarkdown(report: ProductionOnboardingEvidenceDigestReport): string;

export function writeProductionOnboardingEvidenceDigestFiles(options?: {
  root?: string;
  report: ProductionOnboardingEvidenceDigestReport;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  digestDir: string;
  digestDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};
