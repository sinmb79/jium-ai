import type { OperationalApprovalRecordsReport } from "./check-operational-approval-records.mjs";

export type OperationalApprovalRecordsTemplate = {
  schema: "jium-operational-approval-records-v1";
  generatedAt: string;
  packageVersion: string;
  releaseTag: string;
  publicAppUrlStatus: "SET_HTTPS";
  privacyNoticeUrlStatus: "SET_HTTPS";
  records: Array<{
    id: string;
    type:
      | "GO_LIVE_APPROVAL"
      | "LEGAL_REVIEW_APPROVAL"
      | "RELEASE_EVIDENCE_REVIEW"
      | "DATA_RETENTION_POLICY_ACK"
      | "SUPPORT_CONTACT_ROUTE_ASSIGNED"
      | "INCIDENT_RESPONSE_OWNER_ASSIGNED";
    status: "PENDING_APPROVAL";
    approvedAt: string;
    approvedByRef: string;
    referenceId: string;
    scope: string;
    evidenceDigest: string;
    expiresAt: string;
  }>;
};

export function buildOperationalApprovalRecordsTemplate(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  generatedAt?: string;
}): OperationalApprovalRecordsTemplate;

export function writeOperationalApprovalRecordsTemplate(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  outputPath?: string;
  force?: boolean;
  generatedAt?: string;
}): {
  filePath: string;
  sourceStatus: "SET" | "DEFAULT_PRIVATE_PATH";
  template: OperationalApprovalRecordsTemplate;
  report: OperationalApprovalRecordsReport;
};
