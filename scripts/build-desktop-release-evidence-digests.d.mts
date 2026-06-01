export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_SCHEMA: "jium-desktop-release-evidence-digests-v1";
export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_DIR: "dist/desktop-release-evidence-digests";
export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_JSON: "desktop-release-evidence-digests.json";
export const DESKTOP_RELEASE_EVIDENCE_DIGESTS_MARKDOWN: "desktop-release-evidence-digests.md";

export type DesktopReleaseEvidenceDigestStatus = "READY" | "BLOCKED";
export type DesktopReleaseEvidenceContentScan = "TEXT_SCANNED" | "BINARY_HASH_ONLY" | "NOT_RUN";

export type DesktopReleaseEvidenceUnsafeFinding = {
  fileName: string;
  id: string;
  label: string;
};

export type DesktopReleaseEvidenceDigestFile = {
  id: string;
  role: string;
  source: string;
  fileName: string;
  status: DesktopReleaseEvidenceDigestStatus;
  bytes: number;
  digest: string;
  contentScan: DesktopReleaseEvidenceContentScan;
  unsafeFindings: DesktopReleaseEvidenceUnsafeFinding[];
};

export type DesktopReleaseEvidenceDigestReport = {
  schema: typeof DESKTOP_RELEASE_EVIDENCE_DIGESTS_SCHEMA;
  generatedAt: string;
  status: DesktopReleaseEvidenceDigestStatus;
  version: string;
  platform: NodeJS.Platform | string;
  summary: {
    fileCount: number;
    readyFileCount: number;
    unsafeFindingCount: number;
    errorCount: number;
  };
  aggregateDigest: string;
  files: DesktopReleaseEvidenceDigestFile[];
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function buildDesktopReleaseEvidenceDigests(options?: {
  root?: string;
  feedDir?: string;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  report: DesktopReleaseEvidenceDigestReport;
}>;

export function formatDesktopReleaseEvidenceDigestsMarkdown(report: DesktopReleaseEvidenceDigestReport): string;

export function writeDesktopReleaseEvidenceDigestFiles(options?: {
  root?: string;
  report: DesktopReleaseEvidenceDigestReport;
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
