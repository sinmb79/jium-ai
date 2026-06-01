export const SERVER_RUNTIME_ENV_FILE_KEYS: string[];

export function parseServerRuntimeEnvFile(content?: string): Record<string, string>;

export function loadServerRuntimeEnvFile(options?: {
  root?: string;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
}): NodeJS.ProcessEnv;
