export const SERVER_ORIGIN_CANDIDATE_SCHEMA: "jium-server-origin-candidate-v1";
export const SERVER_ORIGIN_CANDIDATE_DIR: "dist/server-origin-candidate";
export const SERVER_ORIGIN_CANDIDATE_JSON: "server-origin-candidate-report.json";
export const SERVER_ORIGIN_CANDIDATE_MARKDOWN: "server-origin-candidate-report.md";
export const PRIVATE_SERVER_ORIGIN_CANDIDATE_DIR: "ops/private/server-origin-candidate";
export const PRIVATE_SERVER_ORIGIN_COMMAND: "server-origin-apply-command.md";

export type ServerOriginCandidateReport = {
  schema: typeof SERVER_ORIGIN_CANDIDATE_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_ORIGIN_APPROVAL" | "BLOCKED";
  version: string;
  summary: {
    envPath: string;
    sourceUrlKeyCount: number;
    sourceUrlReadyCount: number;
    directOriginCount: number;
    originCount: number;
  };
  sourceUrls: Array<{
    envKey: string;
    status: string;
    originDigest: string;
  }>;
  directOrigins: Array<{
    id: string;
    status: string;
    originDigest: string;
  }>;
  privateCommand: {
    fileStatus: "WRITTEN" | "NOT_WRITTEN";
    path: string;
  };
  evidence: {
    originListDigest: string;
    privateCommandDigest: string;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function buildServerOriginCandidate(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
  fromPublicEnv?: boolean;
  origins?: string[];
  approvalRefPlaceholder?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  report: ServerOriginCandidateReport;
  reportDir: string;
  reportDirRelative: string;
  privateCommandPath: string;
  privateCommandPathRelative: string;
}>;

export function formatServerOriginCandidateMarkdown(report: ServerOriginCandidateReport): string;

export function writeServerOriginCandidateOutput(options?: {
  root?: string;
  report: ServerOriginCandidateReport;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  outputPath: string;
  outputPathRelative: string;
};
