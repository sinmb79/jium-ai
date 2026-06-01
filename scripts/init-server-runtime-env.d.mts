export const DEFAULT_SERVER_RUNTIME_ENV_PATH: ".env.server.local";

export function buildServerRuntimeEnvTemplate(options?: {
  generatedAt?: string;
  secret?: string;
}): string;

export function writeServerRuntimeEnvTemplate(options?: {
  root?: string;
  outputPath?: string;
  force?: boolean;
  generatedAt?: string;
  secret?: string;
}): {
  outputPath: string;
  outputPathRelative: string;
  secretStatus: "GENERATED";
  originStatus: "PLACEHOLDER_BLOCKED";
};
