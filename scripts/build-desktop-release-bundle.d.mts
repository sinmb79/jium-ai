export const DESKTOP_RELEASE_BUNDLE_DIR: string;

export function buildDesktopReleaseCandidateBundle(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform | string;
  generatedAt?: string;
}): Promise<{
  valid: boolean;
  bundleDir: string;
  bundleDirRelative: string;
  summary: {
    schema: "jium-desktop-release-candidate-bundle-v1";
    generatedAt: string;
    status: "READY" | "BLOCKED";
    version: string;
    commit: string;
    platform: NodeJS.Platform | string;
    gates: Array<{
      id: string;
      status: "READY" | "BLOCKED";
      errorCount: number;
    }>;
    artifact: {
      appDir: string;
      executable: string;
      appArchive: string;
      executableBytes: number;
      appArchiveBytes: number;
      executableSha256: string;
      appArchiveSha256: string;
    };
    reports: Record<string, string>;
    nextActions: string[];
    safetyNotes: string[];
  };
}>;

export function formatDesktopReleaseCandidateSummary(
  summary: Awaited<ReturnType<typeof buildDesktopReleaseCandidateBundle>>["summary"],
): string;
