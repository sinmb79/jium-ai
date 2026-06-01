export const OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA: "jium-operational-approval-command-packet-v1";
export const OPERATIONAL_APPROVAL_COMMAND_PACKET_DIR: "dist/operational-approval-command-packet";
export const OPERATIONAL_APPROVAL_COMMAND_PACKET_JSON: "operational-approval-command-packet.json";
export const OPERATIONAL_APPROVAL_COMMAND_PACKET_MARKDOWN: "operational-approval-command-packet.md";

export interface OperationalApprovalCommandPacketCommand {
  id: string;
  group: string;
  ownerRole: string;
  phaseId: string;
  command: string;
  evidencePlaceholder: string;
  externalApprovalRequired: boolean;
}

export interface OperationalApprovalCommandPacketReport {
  schema: typeof OPERATIONAL_APPROVAL_COMMAND_PACKET_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_EXTERNAL_APPROVALS" | "BLOCKED";
  version: string;
  summary: {
    commandCount: number;
    externalApprovalCommandCount: number;
    verificationCommandCount: number;
    groupCounts: Record<string, number>;
  };
  commands: OperationalApprovalCommandPacketCommand[];
  runOrder: string[];
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{
      id: string;
      label: string;
    }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export function buildOperationalApprovalCommandPacket(options?: {
  root?: string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  report: OperationalApprovalCommandPacketReport;
  reportDir: string;
  reportDirRelative: string;
}>;

export function formatOperationalApprovalCommandPacketMarkdown(report: OperationalApprovalCommandPacketReport): string;

export function writeOperationalApprovalCommandPacketOutput(options?: {
  root?: string;
  report: OperationalApprovalCommandPacketReport;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  outputPath: string;
  outputPathRelative: string;
};
