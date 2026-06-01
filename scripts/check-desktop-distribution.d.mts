export const REQUIRED_DESKTOP_ASAR_ENTRIES: string[];
export const FORBIDDEN_DESKTOP_ASAR_PATTERNS: string[];

export function sha256File(filePath: string): Promise<string>;

export function inspectDesktopAppArchive(
  appArchive: string,
  asarApi?: { listPackage: (archive: string) => string[] },
): {
  entryCount: number;
  requiredEntries: string[];
  missingEntries: string[];
  forbiddenEntries: string[];
};

export function validateDesktopDistribution(options?: {
  root?: string;
  platform?: NodeJS.Platform | string;
}): Promise<{
  valid: boolean;
  errors: string[];
  platform: NodeJS.Platform | string;
  artifact: {
    appDir: string;
    executable: string;
    appArchive: string;
    executableBytes: number;
    appArchiveBytes: number;
    executableSha256: string;
    appArchiveSha256: string;
  };
  archiveInspection: {
    entryCount: number;
    requiredEntries: string[];
    missingEntries: string[];
    forbiddenEntries: string[];
  };
  stagedApp: {
    packageJson: string;
    dependencies: string[];
  };
}>;

export function buildDesktopDistributionReport(
  validation: Awaited<ReturnType<typeof validateDesktopDistribution>>,
  options?: { generatedAt?: string },
): {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  platform: NodeJS.Platform | string;
  artifact: Awaited<ReturnType<typeof validateDesktopDistribution>>["artifact"];
  archiveInspection: Awaited<ReturnType<typeof validateDesktopDistribution>>["archiveInspection"];
  stagedApp: Awaited<ReturnType<typeof validateDesktopDistribution>>["stagedApp"];
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function formatDesktopDistributionMarkdown(report: ReturnType<typeof buildDesktopDistributionReport>): string;
