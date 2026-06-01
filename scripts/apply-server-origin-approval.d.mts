export const SERVER_ORIGIN_APPROVAL_BUNDLE_DIR: "dist/server-origin-approval";

export type ServerOriginApprovalReport = {
  schema: "jium-server-origin-approval-v1";
  generatedAt: string;
  status: "APPLIED" | "BLOCKED";
  summary: {
    originCount: number;
    envPath: string;
    envUpdateStatus: "UPDATED" | "UNCHANGED" | "SKIPPED" | string;
    serverRoutesStatus: "SET_TRUE" | "BLOCKED" | string;
    secureCookiesStatus: "SET_TRUE" | "BLOCKED" | string;
  };
  evidence: {
    approvalRefStatus: "SET_REDACTED" | "MISSING" | "BLOCKED";
    approvalRefDigest: string;
    originListDigest: string;
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateServerOriginApproval(options?: {
  root?: string;
  envPath?: string;
  origins?: string[] | string;
  approvalRef?: string;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidence: ServerOriginApprovalReport["evidence"];
  summary: {
    originCount: number;
    envPath: string;
  };
};

export function applyServerOriginApproval(options?: {
  root?: string;
  envPath?: string;
  origins?: string[] | string;
  approvalRef?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: ServerOriginApprovalReport;
}>;

export function formatServerOriginApprovalMarkdown(report: ServerOriginApprovalReport): string;
