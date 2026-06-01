import type { OperationalActionPlan } from "./build-operational-action-plan.mjs";
import type { OperationalHandoffBundleSummary } from "./build-operational-handoff-bundle.mjs";
import type { OperationalGoLiveRehearsalReport } from "./run-operational-go-live-rehearsal.mjs";

export const OPERATIONAL_RELEASE_DOSSIER_SCHEMA: "jium-operational-release-dossier-v1";
export const OPERATIONAL_RELEASE_DOSSIER_DIR: "dist/operational-release-dossier";
export const OPERATIONAL_RELEASE_DOSSIER_JSON: "operational-release-dossier.json";
export const OPERATIONAL_RELEASE_DOSSIER_MARKDOWN: "operational-release-dossier.md";

export type OperationalReleaseDossierStatus =
  | "READY_FOR_EXTERNAL_REVIEW"
  | "READY_FOR_GO_LIVE_ARCHIVE"
  | "BLOCKED";

export interface OperationalReleaseDossierReviewFile {
  id: string;
  label: string;
  path: string;
  purpose: string;
}

export interface OperationalReleaseDossierPriorityAction {
  phaseId: string;
  phaseTitle: string;
  ownerRole: string;
  actionId: string;
  status: string;
  priority: string;
  action: string;
  evidenceTarget: string;
  verificationCommands: string[];
  reportRefs: string[];
}

export interface OperationalReleaseDossier {
  schema: typeof OPERATIONAL_RELEASE_DOSSIER_SCHEMA;
  generatedAt: string;
  status: OperationalReleaseDossierStatus;
  source: {
    handoffSchema: OperationalHandoffBundleSummary["schema"];
    handoffStatus: OperationalHandoffBundleSummary["status"];
    actionPlanSchema: OperationalActionPlan["schema"];
    actionPlanStatus: OperationalActionPlan["status"];
    rehearsalSchema: OperationalGoLiveRehearsalReport["schema"];
    rehearsalStatus: OperationalGoLiveRehearsalReport["status"];
    version: string;
    commit: string;
    platform: NodeJS.Platform | string;
  };
  summary: {
    gateCount: number;
    blockedGateCount: number;
    readyGateCount: number;
    openActionCount: number;
    completedActionCount: number;
    externalRecordCount: number;
    requiredReviewFileCount: number;
    rehearsalStatus: OperationalGoLiveRehearsalReport["status"];
  };
  requiredReviewFiles: OperationalReleaseDossierReviewFile[];
  gateSummary: Array<{
    id: string;
    status: "READY" | "BLOCKED" | string;
    errorCount: number;
  }>;
  externalRecordsNeeded: string[];
  priorityActions: OperationalReleaseDossierPriorityAction[];
  reviewRunOrder: Array<{
    order: number;
    phaseId: string;
    status: string;
    ownerRole: string;
    verificationCommands: string[];
  }>;
  rehearsal: {
    status: string;
    version: string;
    goLiveStatus: string;
    goLiveErrorCount: number;
    passCheckCount: number;
    blockedCheckCount: number;
    simulation: Record<string, string>;
  };
  nextCommands: string[];
  leakScan: {
    status: "PASS" | "BLOCKED";
    checkedPatternCount: number;
    findings: Array<{
      id: string;
      label: string;
    }>;
  };
  safetyNotes: string[];
}

export function buildOperationalReleaseDossier(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
  summary?: OperationalHandoffBundleSummary;
  summaryPath?: string;
  actionPlan?: OperationalActionPlan;
  actionPlanPath?: string;
  deriveMissingActionPlan?: boolean;
  rehearsalReport?: OperationalGoLiveRehearsalReport;
  rehearsalPath?: string;
}): Promise<OperationalReleaseDossier>;

export function formatOperationalReleaseDossierMarkdown(dossier: OperationalReleaseDossier): string;

export function writeOperationalReleaseDossierFiles(options?: {
  root?: string;
  dossier: OperationalReleaseDossier;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  dossierDir: string;
  dossierDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};
