declare module "@/scripts/check-authorized-feed-keys.mjs" {
  export const TRUSTED_KEY_REGISTRY_PATH: string;
  export const TRUSTED_KEY_REGISTRY_VERSION: "jium-authorized-feed-trusted-keys-v1";
  export const AUTHORIZED_FEED_SIGNATURE_ALGORITHM: "RSASSA-PKCS1-v1_5";

  export type TrustedAuthorizedFeedKeyRegistryCheckOptions = {
    root?: string;
  };

  export type TrustedAuthorizedFeedKeyRegistryJson = {
    version?: string;
    keys?: unknown[];
  };

  export function loadTrustedAuthorizedFeedKeyRegistry(filePath?: string): TrustedAuthorizedFeedKeyRegistryJson;

  export function validateTrustedAuthorizedFeedKeyRegistry(registry: unknown): string[];

  export function runTrustedAuthorizedFeedKeyCheck(options?: TrustedAuthorizedFeedKeyRegistryCheckOptions): string[];
}
