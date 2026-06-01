export function updateFeedMetadataName(platform?: NodeJS.Platform | string): "latest.yml" | "latest-mac.yml" | "latest-linux.yml";

export function parseElectronUpdaterYaml(text: string): {
  version: string;
  path: string;
  sha512: string;
  releaseDate: string;
  files: Array<{
    url: string;
    sha512: string;
    size: number;
  }>;
};

export function sha512FileBase64(filePath: string): Promise<string>;

export function validateDesktopUpdateFeed(options?: {
  root?: string;
  feedDir?: string;
  platform?: NodeJS.Platform | string;
}): Promise<{
  valid: boolean;
  errors: string[];
  platform: NodeJS.Platform | string;
  metadata: {
    file: string;
    version: string;
    path: string;
    releaseDate: string;
    fileCount: number;
  };
  artifacts: Array<{
    path: string;
    bytes: number;
    sha512Status: "MATCH" | "MISMATCH";
    sizeStatus: "MATCH" | "MISMATCH";
  }>;
}>;

export function buildDesktopUpdateFeedReport(
  validation: Awaited<ReturnType<typeof validateDesktopUpdateFeed>>,
  options?: { generatedAt?: string },
): {
  generatedAt: string;
  status: "READY" | "BLOCKED";
  platform: NodeJS.Platform | string;
  metadata: Awaited<ReturnType<typeof validateDesktopUpdateFeed>>["metadata"];
  artifacts: Awaited<ReturnType<typeof validateDesktopUpdateFeed>>["artifacts"];
  errors: string[];
  nextActions: string[];
  safetyNotes: string[];
};

export function formatDesktopUpdateFeedMarkdown(report: ReturnType<typeof buildDesktopUpdateFeedReport>): string;
