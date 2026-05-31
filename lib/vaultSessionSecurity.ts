export const VAULT_AUTO_LOCK_MS = 5 * 60 * 1000;

export type VaultSessionState = {
  unlockedAt?: number;
  lastActivityAt?: number;
};

export function shouldAutoLockVault(session: VaultSessionState, now = Date.now(), timeoutMs = VAULT_AUTO_LOCK_MS) {
  if (!session.unlockedAt || !session.lastActivityAt) {
    return false;
  }
  return now - session.lastActivityAt >= timeoutMs;
}

export function vaultRemainingLockMs(session: VaultSessionState, now = Date.now(), timeoutMs = VAULT_AUTO_LOCK_MS) {
  if (!session.unlockedAt || !session.lastActivityAt) {
    return 0;
  }
  return Math.max(0, timeoutMs - (now - session.lastActivityAt));
}

export function formatVaultRemainingTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}초`;
  }
  return `${minutes}분 ${seconds.toString().padStart(2, "0")}초`;
}

export function vaultAutoLockPolicyText(timeoutMs = VAULT_AUTO_LOCK_MS) {
  return `보관함은 ${formatVaultRemainingTime(timeoutMs)} 동안 활동이 없거나 탭이 숨겨지면 자동으로 잠기고, 복호화 목록과 패스프레이즈 입력값을 화면 상태에서 지웁니다.`;
}
