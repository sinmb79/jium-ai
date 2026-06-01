export const DEFAULT_DESKTOP_RELEASE_ENV_PATH: ".env.desktop.local";
export const DESKTOP_RELEASE_ENV_KEYS: string[];

export function cleanDesktopEnvValue(value?: unknown): string;
export function presentDesktopEnvValue(value?: unknown): boolean;
export function sha256DesktopReleaseText(value?: unknown): string;
export function isPathInside(parent: string, child: string): boolean;
export function relativePath(root: string, target: string): string;
export function parseDesktopReleaseEnvFile(content?: string): Record<string, string>;
export function loadDesktopReleaseEnv(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
}): NodeJS.ProcessEnv;
export function validateDesktopReleaseChannel(channel?: unknown): string[];
export function validateDesktopUpdateUrl(updateUrl?: unknown): string[];
export function validateDesktopReleaseTag(releaseTag?: unknown): string[];
export function validateDesktopPublishApprovalRef(publishApprovalRef?: unknown): string[];
