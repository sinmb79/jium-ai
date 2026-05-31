import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  canonicalizeJson,
  type TrustedAuthorizedFeedKey,
} from "@/lib/authorizedFeedSignature";

export type TrustedKeyApprovalStatus = "READY_FOR_APPROVAL" | "NEEDS_REVIEW" | "BLOCKED";

export type TrustedKeyApprovalReview = {
  status: TrustedKeyApprovalStatus;
  keyId: string;
  issuerName: string;
  fingerprint?: string;
  errors: string[];
  warnings: string[];
  checklist: string[];
};

const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);
const PRIVATE_KEY_USAGES = new Set(["sign", "decrypt", "deriveBits", "deriveKey", "unwrapKey"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseIsoDate(value: string | undefined) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto SubtleCrypto is required to fingerprint trusted keys");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256-${bytesToHex(digest)}`;
}

export function isTrustedAuthorizedFeedKeyCandidate(value: unknown): value is TrustedAuthorizedFeedKey {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.keyId === "string" &&
    typeof value.issuerName === "string" &&
    value.algorithm === AUTHORIZED_FEED_SIGNATURE_ALGORITHM &&
    isPlainObject(value.publicKeyJwk)
  );
}

export async function fingerprintTrustedAuthorizedFeedKey(key: TrustedAuthorizedFeedKey) {
  return sha256Hex(
    canonicalizeJson({
      algorithm: key.algorithm,
      issuerName: key.issuerName,
      keyId: key.keyId,
      publicKeyJwk: key.publicKeyJwk,
    }),
  );
}

export async function reviewTrustedAuthorizedFeedKeyCandidate(
  value: unknown,
  existingKeys: readonly TrustedAuthorizedFeedKey[] = [],
  now = Date.now(),
): Promise<TrustedKeyApprovalReview> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isTrustedAuthorizedFeedKeyCandidate(value)) {
    return {
      status: "BLOCKED",
      keyId: "",
      issuerName: "",
      errors: ["후보 공개키는 keyId, issuerName, RSASSA-PKCS1-v1_5 algorithm, publicKeyJwk를 포함해야 합니다."],
      warnings: [],
      checklist: buildTrustedKeyApprovalChecklist("BLOCKED"),
    };
  }

  const key = value;
  const publicKeyJwk = key.publicKeyJwk as Record<string, unknown>;

  if (!key.keyId.trim()) {
    errors.push("keyId is required");
  }
  if (!key.issuerName.trim()) {
    errors.push("issuerName is required");
  }
  if (existingKeys.some((existing) => existing.keyId === key.keyId)) {
    errors.push(`keyId already exists in the trusted registry: ${key.keyId}`);
  }
  if (publicKeyJwk.kty !== "RSA") {
    errors.push("publicKeyJwk.kty must be RSA");
  }
  if (typeof publicKeyJwk.n !== "string" || !publicKeyJwk.n.trim()) {
    errors.push("publicKeyJwk.n is required");
  }
  if (typeof publicKeyJwk.e !== "string" || !publicKeyJwk.e.trim()) {
    errors.push("publicKeyJwk.e is required");
  }
  for (const privateField of PRIVATE_JWK_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(publicKeyJwk, privateField)) {
      errors.push(`publicKeyJwk must not include private JWK field: ${privateField}`);
    }
  }
  if (Array.isArray(publicKeyJwk.key_ops)) {
    publicKeyJwk.key_ops.forEach((usage) => {
      if (PRIVATE_KEY_USAGES.has(String(usage))) {
        errors.push(`publicKeyJwk.key_ops must not include private usage: ${usage}`);
      }
    });
  }
  if (publicKeyJwk.use && publicKeyJwk.use !== "sig") {
    errors.push("publicKeyJwk.use must be sig when present");
  }
  if (!key.validUntil) {
    warnings.push("validUntil이 없습니다. 운영 공개키는 회전 일정을 두는 것이 안전합니다.");
  }
  if (key.validFrom && !Number.isFinite(parseIsoDate(key.validFrom))) {
    errors.push("validFrom must be an ISO date when present");
  }
  if (key.validUntil && !Number.isFinite(parseIsoDate(key.validUntil))) {
    errors.push("validUntil must be an ISO date when present");
  }
  if (key.validFrom && key.validUntil && parseIsoDate(key.validUntil) <= parseIsoDate(key.validFrom)) {
    errors.push("validUntil must be later than validFrom");
  }
  if (key.validUntil && parseIsoDate(key.validUntil) <= now) {
    errors.push("validUntil must be in the future");
  }

  const status: TrustedKeyApprovalStatus = errors.length ? "BLOCKED" : warnings.length ? "NEEDS_REVIEW" : "READY_FOR_APPROVAL";
  return {
    status,
    keyId: key.keyId,
    issuerName: key.issuerName,
    fingerprint: errors.length ? undefined : await fingerprintTrustedAuthorizedFeedKey(key),
    errors,
    warnings,
    checklist: buildTrustedKeyApprovalChecklist(status),
  };
}

export function buildTrustedKeyApprovalChecklist(status: TrustedKeyApprovalStatus) {
  const prefix =
    status === "READY_FOR_APPROVAL"
      ? "승인 전 확인"
      : status === "NEEDS_REVIEW"
        ? "보강 후 확인"
        : "차단 사유 해소";
  return [
    `${prefix}: 기관명과 담당자 연락 경로를 저장소 밖 공식 채널로 대조`,
    `${prefix}: 공개키 fingerprint를 발급기관이 별도 채널에서 알려준 값과 대조`,
    `${prefix}: 개인키 원문, PEM private key, signing key material이 제출물에 없는지 확인`,
    `${prefix}: validUntil과 교체 담당자를 정하고 만료 전 회전 계획을 기록`,
    `${prefix}: registry 반영 뒤 npm run security:server-readiness를 통과시키기`,
  ];
}

export function buildTrustedKeyRegistryPatch(
  candidate: TrustedAuthorizedFeedKey,
  existingKeys: readonly TrustedAuthorizedFeedKey[] = [],
) {
  const keys = [...existingKeys.filter((key) => key.keyId !== candidate.keyId), candidate].sort((left, right) =>
    left.keyId.localeCompare(right.keyId),
  );
  return JSON.stringify(
    {
      version: "jium-authorized-feed-trusted-keys-v1",
      keys,
    },
    null,
    2,
  );
}
