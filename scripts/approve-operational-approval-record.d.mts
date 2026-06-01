import type { OperationalApprovalRecordType } from "./check-operational-approval-records.mjs";

export const OPERATIONAL_APPROVAL_RECORD_APPROVAL_BUNDLE_DIR: "dist/operational-approval-record";

export type OperationalApprovalRecordApprovalReport = {
  schema: "jium-operational-approval-record-approval-v1";
  generatedAt: string;
  status: "RECORD_APPROVED" | "BLOCKED";
  version: string;
  summary: {
    type: string;
    approvedRecordCount: number;
    requiredRecordCount: number;
    readinessStatus: "READY" | "BLOCKED" | string;
  };
  evidence: {
    approverRefDigest: string;
    referenceIdDigest: string;
    scopeDigest: string;
    evidenceDigestStatus: "SET_SHA256" | "BLOCKED" | string;
  };
  target: {
    sourceStatus: "SET" | "DEFAULT_PRIVATE_PATH";
    fileStatus: "FOUND" | "MISSING";
  };
  errors: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function validateOperationalApprovalRecordApproval(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  type?: OperationalApprovalRecordType | string;
  approvedByRef?: string;
  referenceId?: string;
  scope?: string;
  evidenceDigest?: string;
  approvedAt?: string;
  expiresAt?: string;
  now?: number;
}): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidence: OperationalApprovalRecordApprovalReport["evidence"];
  summary: {
    type: string;
    approvedRecordCountBefore: number;
    requiredRecordCount: number;
  };
};

export function approveOperationalApprovalRecord(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  type?: OperationalApprovalRecordType | string;
  approvedByRef?: string;
  referenceId?: string;
  scope?: string;
  evidenceDigest?: string;
  approvedAt?: string;
  expiresAt?: string;
  generatedAt?: string;
  now?: number;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  report: OperationalApprovalRecordApprovalReport;
}>;

export function formatOperationalApprovalRecordApprovalMarkdown(report: OperationalApprovalRecordApprovalReport): string;
