import type { DesktopPublishReadiness } from "./check-desktop-publish-readiness.mjs";

export const DESKTOP_PUBLISH_CANDIDATE_SCHEMA: "jium-desktop-publish-candidate-v1";
export const DESKTOP_PUBLISH_CANDIDATE_DIR: "dist/desktop-publish-candidate";
export const DESKTOP_PUBLISH_CANDIDATE_JSON: "desktop-publish-candidate-report.json";
export const DESKTOP_PUBLISH_CANDIDATE_MARKDOWN: "desktop-publish-candidate-report.md";

export type DesktopPublishCandidateStatus =
  | "READY_FOR_PUBLISH_APPROVAL"
  | "READY_FOR_RELEASE_UPLOAD"
  | "BLOCKED";

export interface DesktopPublishCandidateReport {
  schema: typeof DESKTOP_PUBLISH_CANDIDATE_SCHEMA;
  generatedAt: string;
  status: DesktopPublishCandidateStatus;
  version: string;
  platform: NodeJS.Platform | string;
  summary: {
    packageVersion: string;
    releaseTag: string;
    releaseTagVersion: string;
    updateMetadata: string;
    updateVersion: string;
    artifactCount: number;
    publishArtifactCount: number;
    releaseEvidenceDigestStatus: string;
    releaseEvidenceReadyFileCount: number;
    releaseEvidenceFileCount: number;
    releaseEvidenceUnsafeFindingCount: number;
    releaseEvidenceAggregateDigest: string;
    publishReadinessErrorCount: number;
    technicalErrorCount: number;
    approvalOrUploadWarningCount: number;
  };
  envSummary: DesktopPublishReadiness["envSummary"];
  checks: Array<{
    id: string;
    label: string;
    status: "PASS" | "BLOCKED" | "PENDING";
  }>;
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
}

export function buildDesktopPublishCandidate(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  feedDir?: string;
  generatedAt?: string;
  validations?: {
    distribution?: DesktopPublishReadiness["distribution"];
    releaseReadiness?: DesktopPublishReadiness["releaseReadiness"];
    updateFeed?: DesktopPublishReadiness["updateFeed"];
    publishArtifacts?: DesktopPublishReadiness["publishArtifacts"];
    releaseEvidenceDigest?: DesktopPublishReadiness["releaseEvidenceDigest"];
  };
}): Promise<{
  valid: boolean;
  report: DesktopPublishCandidateReport;
  reportDir: string;
  reportDirRelative: string;
}>;

export function formatDesktopPublishCandidateMarkdown(report: DesktopPublishCandidateReport): string;

export function writeDesktopPublishCandidateOutput(options?: {
  root?: string;
  report: DesktopPublishCandidateReport;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  outputPath: string;
  outputPathRelative: string;
};
