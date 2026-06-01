export const DEFAULT_PRODUCTION_ONBOARDING_DIR: "ops/private/production-onboarding";
export const PRODUCTION_ONBOARDING_SCHEMA: "jium-production-onboarding-v1";

export type ProductionOnboardingArtifact = {
  label: string;
  path: string;
  status: "CREATED" | "EXISTS";
};

export type ProductionOnboardingSummary = {
  schema: "jium-production-onboarding-v1";
  generatedAt: string;
  packageVersion: string;
  onboardingDir: string;
  force: boolean;
  artifacts: ProductionOnboardingArtifact[];
  nextCommands: string[];
  safetyNotes: string[];
};

export function writeProductionOnboardingScaffold(options?: {
  root?: string;
  env?: Record<string, string | undefined>;
  onboardingDir?: string;
  force?: boolean;
  generatedAt?: string;
}): ProductionOnboardingSummary;

export function formatProductionOnboardingMarkdown(summary: ProductionOnboardingSummary): string;
