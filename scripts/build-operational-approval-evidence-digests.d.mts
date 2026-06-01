export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA: "jium-operational-approval-evidence-digests-v1";
export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_DIR: "dist/operational-approval-evidence-digests";
export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_JSON: "operational-approval-evidence-digests.json";
export const OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_MARKDOWN: "operational-approval-evidence-digests.md";

export interface OperationalApprovalEvidenceDigestFile {
  id: string;
  path: string;
  status: "READY" | "BLOCKED";
  bytes: number;
  digest: string;
  unsafeFindings: Array<{
    file: string;
    id: string;
    label: string;
  }>;
}

export interface OperationalApprovalEvidenceDigestReport {
  schema: typeof OPERATIONAL_APPROVAL_EVIDENCE_DIGESTS_SCHEMA;
  generatedAt: string;
  status: "READY" | "BLOCKED";
  version: string;
  summary: {
    fileCount: number;
    readyFileCount: number;
    unsafeFindingCount: number;
    errorCount: number;
  };
  aggregateDigest: string;
  files: OperationalApprovalEvidenceDigestFile[];
  approvalRecordCommands: Array<{
    type: string;
    command: string;
  }>;
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
}

export function buildOperationalApprovalEvidenceDigests(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
  files?: string[];
  noBuild?: boolean;
}): Promise<{
  valid: boolean;
  report: OperationalApprovalEvidenceDigestReport;
}>;

export function formatOperationalApprovalEvidenceDigestsMarkdown(report: OperationalApprovalEvidenceDigestReport): string;

export function writeOperationalApprovalEvidenceDigestFiles(options?: {
  root?: string;
  report: OperationalApprovalEvidenceDigestReport;
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
