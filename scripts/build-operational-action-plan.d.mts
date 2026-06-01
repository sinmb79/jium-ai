import type { OperationalHandoffBundleSummary } from "./build-operational-handoff-bundle.mjs";

export const OPERATIONAL_ACTION_PLAN_JSON: "operational-action-plan.json";
export const OPERATIONAL_ACTION_PLAN_MARKDOWN: "operational-action-plan.md";

export type OperationalActionPlanStatus = "READY" | "BLOCKED";
export type OperationalActionStatus = "TODO" | "DONE";
export type OperationalActionPriority = "P0" | "P1" | "P3";

export type OperationalActionPlanAction = {
  id: string;
  order: number;
  status: OperationalActionStatus;
  priority: OperationalActionPriority;
  source: "phase-runbook" | "handoff-next-action";
  action: string;
  evidenceTarget: string;
  verificationCommands: string[];
  reportRefs: string[];
  safetyBoundary: string;
};

export type OperationalActionPlanPhase = {
  id: string;
  order: number;
  title: string;
  status: OperationalActionPlanStatus;
  ownerRole: string;
  objective: string;
  gates: Array<{
    id: string;
    status: OperationalActionPlanStatus;
    errorCount: number;
  }>;
  reportRefs: string[];
  actions: OperationalActionPlanAction[];
  completionCriteria: string[];
};

export type OperationalActionPlan = {
  schema: "jium-operational-action-plan-v1";
  generatedAt: string;
  status: OperationalActionPlanStatus;
  source: {
    schema: OperationalHandoffBundleSummary["schema"];
    generatedAt: string;
    status: OperationalHandoffBundleSummary["status"];
    version: string;
    commit: string;
    platform: NodeJS.Platform | string;
  };
  summary: {
    phaseCount: number;
    actionCount: number;
    todoActionCount: number;
    doneActionCount: number;
    blockedPhaseCount: number;
    readyPhaseCount: number;
  };
  phases: OperationalActionPlanPhase[];
  runOrder: Array<{
    order: number;
    phaseId: string;
    status: OperationalActionPlanStatus;
    ownerRole: string;
    verificationCommands: string[];
  }>;
  safetyNotes: string[];
};

export function loadOperationalHandoffSummary(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
  summary?: OperationalHandoffBundleSummary;
  summaryPath?: string;
}): Promise<OperationalHandoffBundleSummary>;

export function buildOperationalActionPlan(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
  summary?: OperationalHandoffBundleSummary;
  summaryPath?: string;
}): Promise<OperationalActionPlan>;

export function formatOperationalActionPlanMarkdown(plan: OperationalActionPlan): string;

export function writeOperationalActionPlanFiles(options?: {
  root?: string;
  plan: OperationalActionPlan;
  outputPath?: string;
  format?: "json" | "markdown" | "text";
}): {
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};
