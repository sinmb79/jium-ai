export const OPERATIONAL_LAUNCH_INPUTS_SCHEMA: "jium-operational-launch-inputs-v1";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA: "jium-operational-launch-inputs-review-v1";
export const OPERATIONAL_LAUNCH_INPUTS_DIR: "dist/operational-launch-inputs";
export const OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_JSON: "operational-launch-inputs-template.json";
export const OPERATIONAL_LAUNCH_INPUTS_TEMPLATE_MARKDOWN: "operational-launch-inputs-template.md";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_JSON: "operational-launch-inputs-review.json";
export const OPERATIONAL_LAUNCH_INPUTS_REVIEW_MARKDOWN: "operational-launch-inputs-review.md";
export const OPERATIONAL_LAUNCH_COMMAND_PACKET_SCHEMA: "jium-operational-launch-command-packet-v1";
export const OPERATIONAL_LAUNCH_COMMAND_PACKET_DIR: "dist/operational-launch-command-packet";
export const OPERATIONAL_LAUNCH_COMMAND_PACKET_JSON: "operational-launch-command-packet.json";
export const OPERATIONAL_LAUNCH_COMMAND_PACKET_MARKDOWN: "operational-launch-command-packet.md";
export const OPERATIONAL_LAUNCH_PRIVATE_COMMAND_PACKET_DIR: "ops/private/production-onboarding/launch-apply-commands";
export const OPERATIONAL_LAUNCH_PRIVATE_COMMAND_PACKET_JSON: "operational-launch-private-command-packet.json";
export const OPERATIONAL_LAUNCH_PRIVATE_COMMAND_PACKET_PS1: "operational-launch-apply-commands.ps1";

export interface OperationalLaunchInputsTemplate {
  schema: typeof OPERATIONAL_LAUNCH_INPUTS_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_PRIVATE_FILL" | "BLOCKED";
  version: string;
  summary: {
    totalInputCount: number;
    groupCounts: Record<string, number>;
  };
  input: Record<string, unknown>;
  reviewCommand: string;
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export interface OperationalLaunchInputsReview {
  schema: typeof OPERATIONAL_LAUNCH_INPUTS_REVIEW_SCHEMA;
  generatedAt: string;
  status: "READY_FOR_OPERATOR_APPLY" | "BLOCKED";
  version: string;
  summary: {
    totalInputCount: number;
    readyInputCount: number;
    blockedInputCount: number;
    groupCounts: Record<string, number>;
    inputDigest: string;
  };
  fields: Array<{
    group: string;
    id: string;
    type: string;
    status: "READY" | "BLOCKED" | string;
    errorCount: number;
    errors: string[];
    evidence: Record<string, string | number>;
  }>;
  commandPlan: string[];
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export interface OperationalLaunchCommandPacketReport {
  schema: typeof OPERATIONAL_LAUNCH_COMMAND_PACKET_SCHEMA;
  generatedAt: string;
  status: "READY_PRIVATE_COMMAND_PACKET" | "BLOCKED";
  version: string;
  summary: {
    inputDigest: string;
    commandCount: number;
    readyInputCount: number;
    blockedInputCount: number;
    privateOutputStatus: string;
    privateOutputDir: string;
    privatePacketDigest: string;
  };
  commands: Array<{
    id: string;
    description: string;
    commandDigest: string;
    status: string;
  }>;
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{ id: string; label: string }>;
  };
  errors: string[];
  warnings: string[];
  safetyNotes: string[];
}

export interface OperationalLaunchCommandPacket {
  report: OperationalLaunchCommandPacketReport;
  privatePacket: Record<string, unknown>;
  privateScript: string;
}

export function buildOperationalLaunchInputsTemplate(options?: {
  root?: string;
  generatedAt?: string;
}): OperationalLaunchInputsTemplate;

export function reviewOperationalLaunchInputs(options?: {
  root?: string;
  inputPath: string;
  generatedAt?: string;
}): OperationalLaunchInputsReview;

export function buildOperationalLaunchCommandPacket(options?: {
  root?: string;
  inputPath: string;
  privateOutputDir?: string;
  generatedAt?: string;
}): OperationalLaunchCommandPacket;

export function writeOperationalLaunchInputsTemplateFiles(options?: {
  root?: string;
  template: OperationalLaunchInputsTemplate;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  reportDir: string;
  reportDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};

export function writeOperationalLaunchInputsReviewFiles(options?: {
  root?: string;
  review: OperationalLaunchInputsReview;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  reportDir: string;
  reportDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};

export function writeOperationalLaunchCommandPacketFiles(options?: {
  root?: string;
  packet: OperationalLaunchCommandPacket;
  privateOutputDir?: string;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  reportDir: string;
  reportDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
  privateDir: string;
  privateDirRelative: string;
  privateJsonPath: string;
  privateScriptPath: string;
};

export function formatOperationalLaunchInputsTemplateMarkdown(template: OperationalLaunchInputsTemplate): string;
export function formatOperationalLaunchInputsReviewMarkdown(review: OperationalLaunchInputsReview): string;
export function formatOperationalLaunchCommandPacketMarkdown(report: OperationalLaunchCommandPacketReport): string;
