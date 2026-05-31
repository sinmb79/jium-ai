export const NATIVE_SECURE_VAULT_BRIDGE_VERSION: string;
export const NATIVE_SECURE_VAULT_SERVICE: string;

export type NativeSecureVaultBridgeDescriptor = {
  version: string;
  providerName: string;
  platform: "windows-dpapi" | "macos-keychain" | "linux-secret-service" | "custom";
  platformProtected: boolean;
  storageModel: string;
  warning: string;
};

export type NativeSecureVaultCommandResult = {
  stdout: string;
  stderr?: string;
};

export type NativeSecureVaultCommandRunner = (
  command: string,
  args: string[],
  options?: { input?: string; env?: Record<string, string | undefined> },
) => Promise<NativeSecureVaultCommandResult>;

export type NativeSecureVaultOptions = {
  platform?: NodeJS.Platform | string;
  dataDir?: string;
  env?: Record<string, string | undefined>;
  runner?: NativeSecureVaultCommandRunner;
};

export function assertVaultKey(key: string): string;
export function vaultKeyDigest(key: string): string;
export function defaultDataDir(platform?: string, env?: Record<string, string | undefined>): string;
export function bridgeDescriptor(platform?: string): NativeSecureVaultBridgeDescriptor;
export function defaultCommandRunner(command: string, args: string[], options?: { input?: string; env?: Record<string, string | undefined> }): Promise<NativeSecureVaultCommandResult>;
export function writeEncryptedVault(key: string, value: string, options?: NativeSecureVaultOptions): Promise<void>;
export function readEncryptedVault(key: string, options?: NativeSecureVaultOptions): Promise<string | null>;
export function deleteEncryptedVault(key: string, options?: NativeSecureVaultOptions): Promise<void>;
export function hasEncryptedVault(key: string, options?: NativeSecureVaultOptions): Promise<boolean>;
export function runCli(argv: string[], options?: NativeSecureVaultOptions): Promise<string>;
