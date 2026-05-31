export const AUTHORIZED_FEED_OPERATOR_MIN_PASSPHRASE_LENGTH = 16;
export const AUTHORIZED_FEED_SESSION_MS = 10 * 60 * 1000;

export type AuthorizedFeedCapability = "AUTHORIZED_FEED_IMPORT" | "AUTHORIZED_FEED_SUMMARY" | "AUTHORIZED_FEED_PURGE";

export type AuthorizedFeedOperatorSession = {
  role: "AUTHORIZED_OPERATOR";
  openedAt: number;
  lastActivityAt: number;
  expiresAt: number;
  capabilityIds: AuthorizedFeedCapability[];
  limitations: string[];
};

export function authorizedFeedAccessBoundaryText() {
  return "로컬 운영자 세션은 조직 인증이나 수사권한을 대신하지 않습니다. 승인된 비식별 피드 수입과 집계 확인만 허용합니다.";
}

export function openAuthorizedFeedOperatorSession(passphrase: string, now = Date.now()): AuthorizedFeedOperatorSession {
  if (passphrase.trim().length < AUTHORIZED_FEED_OPERATOR_MIN_PASSPHRASE_LENGTH) {
    throw new Error(`제한 피드 운영자 확인 문장은 ${AUTHORIZED_FEED_OPERATOR_MIN_PASSPHRASE_LENGTH}자 이상이어야 합니다.`);
  }

  return {
    role: "AUTHORIZED_OPERATOR",
    openedAt: now,
    lastActivityAt: now,
    expiresAt: now + AUTHORIZED_FEED_SESSION_MS,
    capabilityIds: ["AUTHORIZED_FEED_IMPORT", "AUTHORIZED_FEED_SUMMARY", "AUTHORIZED_FEED_PURGE"],
    limitations: [
      "조직 인증을 대신하지 않음",
      "원문 URL·초대링크·계정 핸들 저장 금지",
      "비공개방 접근·구매·잠입·다운로드 금지",
      "피해자 UI에는 집계 요약만 표시",
    ],
  };
}

export function refreshAuthorizedFeedOperatorSession(session: AuthorizedFeedOperatorSession, now = Date.now()): AuthorizedFeedOperatorSession {
  return {
    ...session,
    lastActivityAt: now,
    expiresAt: now + AUTHORIZED_FEED_SESSION_MS,
  };
}

export function canUseAuthorizedFeedCapability(
  session: AuthorizedFeedOperatorSession | null | undefined,
  capability: AuthorizedFeedCapability,
  now = Date.now(),
) {
  return Boolean(session && session.role === "AUTHORIZED_OPERATOR" && session.expiresAt > now && session.capabilityIds.includes(capability));
}

export function authorizedFeedSessionStatus(session: AuthorizedFeedOperatorSession | null | undefined, now = Date.now()) {
  if (!session) {
    return "잠김 · 운영자 세션 없음";
  }
  if (session.expiresAt <= now) {
    return "만료됨 · 다시 확인 필요";
  }
  const remainingSeconds = Math.ceil((session.expiresAt - now) / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `열림 · ${minutes}분 ${seconds.toString().padStart(2, "0")}초 후 만료`;
}
