import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";
import {
  buildTrustedKeyRegistryPatch,
  fingerprintTrustedAuthorizedFeedKey,
  reviewTrustedAuthorizedFeedKeyCandidate,
} from "@/lib/trustedKeyApproval";

export type TrustedKeyLifecycleStatus = "ACTIVE" | "EXPIRING_SOON" | "NO_EXPIRY" | "NOT_YET_ACTIVE" | "EXPIRED";

export type TrustedKeyLifecycleEntry = {
  keyId: string;
  issuerName: string;
  status: TrustedKeyLifecycleStatus;
  fingerprint: string;
  validFrom?: string;
  validUntil?: string;
  daysUntilExpiry?: number;
};

export type TrustedKeyLifecycleReview = {
  entries: TrustedKeyLifecycleEntry[];
  activeCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  noExpiryCount: number;
  notYetActiveCount: number;
  errors: string[];
  warnings: string[];
  checklist: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIso(value?: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function statusForKey(key: TrustedAuthorizedFeedKey, now: number, expiringWithinDays: number): TrustedKeyLifecycleStatus {
  const validFrom = parseIso(key.validFrom);
  const validUntil = parseIso(key.validUntil);
  if (Number.isFinite(validFrom) && validFrom > now) {
    return "NOT_YET_ACTIVE";
  }
  if (Number.isFinite(validUntil) && validUntil <= now) {
    return "EXPIRED";
  }
  if (!Number.isFinite(validUntil)) {
    return "NO_EXPIRY";
  }
  if (validUntil - now <= expiringWithinDays * DAY_MS) {
    return "EXPIRING_SOON";
  }
  return "ACTIVE";
}

function isActiveStatus(status: TrustedKeyLifecycleStatus) {
  return status === "ACTIVE" || status === "EXPIRING_SOON" || status === "NO_EXPIRY";
}

export async function reviewTrustedKeyLifecycle(
  keys: readonly TrustedAuthorizedFeedKey[],
  options: { now?: number; expiringWithinDays?: number } = {},
): Promise<TrustedKeyLifecycleReview> {
  const now = options.now ?? Date.now();
  const expiringWithinDays = options.expiringWithinDays ?? 30;
  const entries = await Promise.all(
    keys.map(async (key) => {
      const validUntil = parseIso(key.validUntil);
      const status = statusForKey(key, now, expiringWithinDays);
      return {
        keyId: key.keyId,
        issuerName: key.issuerName,
        status,
        fingerprint: await fingerprintTrustedAuthorizedFeedKey(key),
        validFrom: key.validFrom,
        validUntil: key.validUntil,
        daysUntilExpiry: Number.isFinite(validUntil) ? Math.ceil((validUntil - now) / DAY_MS) : undefined,
      };
    }),
  );
  const activeCount = entries.filter((entry) => isActiveStatus(entry.status)).length;
  const expiringSoonCount = entries.filter((entry) => entry.status === "EXPIRING_SOON").length;
  const expiredCount = entries.filter((entry) => entry.status === "EXPIRED").length;
  const noExpiryCount = entries.filter((entry) => entry.status === "NO_EXPIRY").length;
  const notYetActiveCount = entries.filter((entry) => entry.status === "NOT_YET_ACTIVE").length;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!activeCount) {
    errors.push("운영 가능한 활성 공개키가 없습니다.");
  }
  if (expiringSoonCount) {
    warnings.push(`만료 ${expiringWithinDays}일 이내 공개키 ${expiringSoonCount}개가 있습니다.`);
  }
  if (expiredCount) {
    warnings.push(`만료된 공개키 ${expiredCount}개는 registry에서 폐기 또는 기록 보존 대상으로 분리하세요.`);
  }
  if (noExpiryCount) {
    warnings.push(`validUntil이 없는 공개키 ${noExpiryCount}개는 회전 일정을 보강하세요.`);
  }

  return {
    entries: entries.sort((left, right) => left.keyId.localeCompare(right.keyId)),
    activeCount,
    expiringSoonCount,
    expiredCount,
    noExpiryCount,
    notYetActiveCount,
    errors,
    warnings,
    checklist: [
      "활성 공개키가 최소 1개 이상 남아 있는지 확인",
      "만료 30일 이내 공개키는 새 공개키 승인과 credential 재발급 계획을 수립",
      "폐기 patch는 운영 승인 기록과 함께 PR 또는 관리자 검토로 반영",
      "폐기 후 npm run security:server-readiness로 활성 공개키 존재 여부 확인",
    ],
  };
}

export function parseTrustedKeyRegistryText(text: string): TrustedAuthorizedFeedKey[] {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { keys?: unknown }).keys)) {
    throw new Error("trusted key registry JSON must include a keys array");
  }
  return (parsed as { keys: TrustedAuthorizedFeedKey[] }).keys;
}

export function buildTrustedKeyRetirementPatch(
  keyId: string,
  existingKeys: readonly TrustedAuthorizedFeedKey[],
  retireAtIso: string,
) {
  const retireAt = parseIso(retireAtIso);
  if (!Number.isFinite(retireAt)) {
    throw new Error("retireAt must be an ISO date");
  }
  const target = existingKeys.find((key) => key.keyId === keyId);
  if (!target) {
    throw new Error(`trusted key not found: ${keyId}`);
  }
  const validFrom = parseIso(target.validFrom);
  if (Number.isFinite(validFrom) && retireAt <= validFrom) {
    throw new Error("retireAt must be later than the key validFrom");
  }
  return buildTrustedKeyRegistryPatch({ ...target, validUntil: new Date(retireAt).toISOString() }, existingKeys);
}

export async function buildTrustedKeyRotationPatch(
  retiringKeyId: string,
  replacement: TrustedAuthorizedFeedKey,
  existingKeys: readonly TrustedAuthorizedFeedKey[],
  retireAtIso: string,
  now = Date.now(),
) {
  const approval = await reviewTrustedAuthorizedFeedKeyCandidate(replacement, existingKeys, now);
  if (approval.status === "BLOCKED") {
    throw new Error(`replacement key is not approvable: ${approval.errors.join("; ")}`);
  }
  const retired = JSON.parse(buildTrustedKeyRetirementPatch(retiringKeyId, existingKeys, retireAtIso)) as {
    keys: TrustedAuthorizedFeedKey[];
  };
  return buildTrustedKeyRegistryPatch(replacement, retired.keys);
}
