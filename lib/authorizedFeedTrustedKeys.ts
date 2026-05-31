import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import trustedKeyRegistry from "@/data/trusted-authorized-feed-keys.json";

export type TrustedAuthorizedFeedKeyRegistry = {
  version: "jium-authorized-feed-trusted-keys-v1";
  keys: TrustedAuthorizedFeedKey[];
};

const registry = trustedKeyRegistry as TrustedAuthorizedFeedKeyRegistry;

// 운영 공개키만 JSON 레지스트리에 고정합니다. 개인키는 저장소, 브라우저 번들, 환경변수에 넣지 않습니다.
export const TRUSTED_AUTHORIZED_FEED_KEY_REGISTRY_VERSION = registry.version;
export const TRUSTED_AUTHORIZED_FEED_KEYS: TrustedAuthorizedFeedKey[] = registry.keys;

export function authorizedFeedTrustedKeyStatus(keys: readonly TrustedAuthorizedFeedKey[] = TRUSTED_AUTHORIZED_FEED_KEYS) {
  if (!keys.length) {
    return "서명 검증 공개키 미등록";
  }
  return `서명 검증 공개키 ${keys.length}개 등록`;
}
