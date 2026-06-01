export function parseDesktopReleaseTag(tag: string): {
  tag: string;
  valid: boolean;
  version: string;
};

export type DesktopPublishReadiness = {
  valid: boolean;
  errors: string[];
  packageVersion: string;
  releaseTag: string;
  releaseTagVersion: string;
  envSummary: {
    JIUM_DESKTOP_RELEASE_TAG: "SET" | "MISSING";
    JIUM_DESKTOP_PUBLISH_APPROVAL: "APPROVED" | "MISSING_OR_NOT_APPROVED";
    GITHUB_REPOSITORY: "SET" | "MISSING";
    GITHUB_TOKEN: "SET" | "MISSING";
  };
  distribution: {
    valid: boolean;
    errors: string[];
    artifact?: unknown;
  };
  releaseReadiness: {
    valid: boolean;
    errors: string[];
  };
  updateFeed: {
    valid: boolean;
    errors: string[];
    metadata: {
      file: string;
      version: string;
      path: string;
      releaseDate: string;
      fileCount: number;
    };
    artifacts: Array<{
      path: string;
      bytes: number;
      sha512Status: "MATCH" | "MISMATCH";
      sizeStatus: "MATCH" | "MISMATCH";
    }>;
  };
  publishArtifacts: {
    valid: boolean;
    errors: string[];
    files: string[];
  };
  releaseEvidenceDigest: {
    valid: boolean;
    report: {
      status: "READY" | "BLOCKED";
      aggregateDigest: string;
      summary: {
        fileCount: number;
        readyFileCount: number;
        unsafeFindingCount: number;
        errorCount: number;
      };
      errors: string[];
    };
  };
};

export function inspectDesktopPublishArtifacts(options?: {
  feedDir?: string;
  platform?: NodeJS.Platform | string;
}): DesktopPublishReadiness["publishArtifacts"];

export function validateDesktopPublishReadiness(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  feedDir?: string;
  validations?: {
    distribution?: DesktopPublishReadiness["distribution"];
    releaseReadiness?: DesktopPublishReadiness["releaseReadiness"];
    updateFeed?: DesktopPublishReadiness["updateFeed"];
    publishArtifacts?: DesktopPublishReadiness["publishArtifacts"];
    releaseEvidenceDigest?: DesktopPublishReadiness["releaseEvidenceDigest"];
  };
}): Promise<DesktopPublishReadiness>;

export type DesktopPublishReadinessReport = {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  summary: {
    errorCount: number;
    packageVersion: string;
    releaseTag: string;
    releaseTagVersion: string;
    updateMetadata: string;
    updateVersion: string;
    artifactCount: number;
    publishArtifactCount: number;
    releaseEvidenceDigestStatus: string;
    releaseEvidenceFileCount: number;
    releaseEvidenceReadyFileCount: number;
    releaseEvidenceUnsafeFindingCount: number;
    releaseEvidenceAggregateDigest: string;
  };
  envSummary: DesktopPublishReadiness["envSummary"];
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED";
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function buildDesktopPublishReadinessReport(
  readiness: DesktopPublishReadiness,
  options?: { generatedAt?: string },
): DesktopPublishReadinessReport;

export function formatDesktopPublishReadinessMarkdown(report: DesktopPublishReadinessReport): string;
