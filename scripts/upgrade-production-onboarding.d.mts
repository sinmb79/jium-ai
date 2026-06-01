import type { DEFAULT_PRODUCTION_ONBOARDING_DIR } from "./init-production-onboarding.mjs";

export type ProductionOnboardingUpgradeArtifactStatus =
  | "UPDATED"
  | "WOULD_UPDATE"
  | "UNCHANGED"
  | "MISSING"
  | "INVALID_JSON"
  | "INVALID_JSON_OBJECT"
  | "SKIPPED_SCHEMA_MISMATCH"
  | "SKIPPED_APPROVED_RELEASE_RECORDS";

export type ProductionOnboardingUpgradeArtifact = {
  label: string;
  path: string;
  status: ProductionOnboardingUpgradeArtifactStatus;
  previousPackageVersion?: string;
  previousReleaseTag?: string;
  packageVersion?: string;
  releaseTag?: string;
};

export type ProductionOnboardingUpgradeSummary = {
  schema: "jium-production-onboarding-upgrade-v1";
  generatedAt: string;
  status: "UPDATED" | "UNCHANGED" | "REVIEW" | "BLOCKED";
  dryRun: boolean;
  packageVersion: string;
  releaseTag: string;
  onboardingDir: string;
  artifacts: ProductionOnboardingUpgradeArtifact[];
  nextActions: string[];
  safetyNotes: string[];
};

export function upgradeProductionOnboarding(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  onboardingDir?: typeof DEFAULT_PRODUCTION_ONBOARDING_DIR | string;
  dryRun?: boolean;
}): ProductionOnboardingUpgradeSummary;

export function formatProductionOnboardingUpgradeMarkdown(summary: ProductionOnboardingUpgradeSummary): string;
