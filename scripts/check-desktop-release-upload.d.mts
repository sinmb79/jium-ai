export const DESKTOP_RELEASE_UPLOAD_SCHEMA: "jium-desktop-release-upload-v1";
export const DESKTOP_RELEASE_UPLOAD_DIR: "dist/desktop-release-upload";
export const DESKTOP_RELEASE_UPLOAD_JSON: "desktop-release-upload-report.json";
export const DESKTOP_RELEASE_UPLOAD_MARKDOWN: "desktop-release-upload-report.md";

export function buildDesktopReleaseUploadReport(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  releaseTag?: string;
  releaseView?: any;
  releaseViewJsonPath?: string;
  runner?: (...args: any[]) => any;
  generatedAt?: string;
}): any;

export function writeDesktopReleaseUploadReportFiles(options?: {
  root?: string;
  report: any;
  outputPath?: string;
  format?: "json" | "markdown";
}): {
  reportDir: string;
  reportDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};

export function formatDesktopReleaseUploadMarkdown(report: any): string;
