import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";

// 운영 공개키만 여기에 고정합니다. 개인키는 저장소, 브라우저 번들, 환경변수에 넣지 않습니다.
export const TRUSTED_AUTHORIZED_FEED_KEYS: TrustedAuthorizedFeedKey[] = [];

export function authorizedFeedTrustedKeyStatus(keys: readonly TrustedAuthorizedFeedKey[] = TRUSTED_AUTHORIZED_FEED_KEYS) {
  if (!keys.length) {
    return "서명 검증 공개키 미등록";
  }
  return `서명 검증 공개키 ${keys.length}개 등록`;
}
