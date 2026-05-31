import {
  AUTHORIZED_FEED_SESSION_MS,
  isAuthorizedFeedCapability,
  type AuthorizedFeedCapability,
  type AuthorizedFeedOperatorSession,
} from "@/lib/authorizedFeedAccess";
import {
  AUTHORIZED_FEED_SIGNATURE_ALGORITHM,
  base64UrlToBytes,
  canonicalizeJson,
  findTrustedAuthorizedFeedKey,
  type TrustedAuthorizedFeedKey,
} from "@/lib/authorizedFeedSignature";
import type { AuthorizedFeedValidationResult } from "@/lib/authorizedIntelligenceFeed";

export const SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION = "jium-authorized-operator-credential-signed-v1";

const UNSAFE_CREDENTIAL_MARKERS = ["http://", "https://", "discord.gg/", "t.me/", "telegram.me/", ".onion", "@", "010-"];

export type AuthorizedOperatorCredential = {
  credentialId: string;
  subjectId: string;
  issuerName: string;
  issuedAt: string;
  expiresAt: string;
  capabilityIds: AuthorizedFeedCapability[];
  limitations: string[];
};

export type SignedAuthorizedOperatorCredentialPayload = {
  version: typeof SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION;
  keyId: string;
  signedAt: string;
  credential: AuthorizedOperatorCredential;
};

export type SignedAuthorizedOperatorCredential = SignedAuthorizedOperatorCredentialPayload & {
  signature: string;
};

function credentialContainsUnsafeMarker(value: unknown) {
  const serialized = JSON.stringify(value ?? "").toLowerCase();
  return UNSAFE_CREDENTIAL_MARKERS.filter((marker) => serialized.includes(marker));
}

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compactList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 20);
}

function requireSubtleCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto SubtleCrypto is required for authorized operator credential verification");
  }
  return globalThis.crypto.subtle;
}

export function isSignedAuthorizedOperatorCredential(value: unknown): value is SignedAuthorizedOperatorCredential {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SignedAuthorizedOperatorCredential>;
  return (
    candidate.version === SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION &&
    typeof candidate.keyId === "string" &&
    typeof candidate.signature === "string"
  );
}

export function authorizedOperatorCredentialSigningPayload(payload: SignedAuthorizedOperatorCredentialPayload) {
  return canonicalizeJson({
    credential: payload.credential,
    keyId: payload.keyId,
    signedAt: payload.signedAt,
    version: payload.version,
  });
}

export function validateAuthorizedOperatorCredentialEnvelope(
  envelope: SignedAuthorizedOperatorCredential,
  now = Date.now(),
): AuthorizedFeedValidationResult {
  const errors: string[] = [];
  const credential = envelope.credential;

  if (envelope.version !== SIGNED_AUTHORIZED_OPERATOR_CREDENTIAL_VERSION) {
    errors.push("unsupported authorized operator credential version");
  }
  if (!envelope.keyId?.trim()) {
    errors.push("keyId is required");
  }
  if (!envelope.signature?.trim()) {
    errors.push("signature is required");
  }
  if (!Number.isFinite(parseDate(envelope.signedAt))) {
    errors.push("signedAt must be an ISO date");
  }
  if (!credential || typeof credential !== "object") {
    errors.push("credential is required");
    return { valid: false, errors };
  }
  if (!credential.credentialId?.trim()) {
    errors.push("credentialId is required");
  }
  if (!credential.subjectId?.trim()) {
    errors.push("subjectId is required");
  }
  if (!credential.issuerName?.trim()) {
    errors.push("issuerName is required");
  }
  if (credentialContainsUnsafeMarker({ subjectId: credential.subjectId, issuerName: credential.issuerName }).length) {
    errors.push("credential subject and issuer must use pseudonymous IDs, not raw URLs, handles, invites, or phone numbers");
  }

  const issuedAt = parseDate(credential.issuedAt);
  const expiresAt = parseDate(credential.expiresAt);
  const signedAt = parseDate(envelope.signedAt);
  if (!Number.isFinite(issuedAt)) {
    errors.push("issuedAt must be an ISO date");
  }
  if (!Number.isFinite(expiresAt)) {
    errors.push("expiresAt must be an ISO date");
  }
  if (Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && expiresAt <= issuedAt) {
    errors.push("expiresAt must be later than issuedAt");
  }
  if (Number.isFinite(expiresAt) && expiresAt <= now) {
    errors.push("authorized operator credential has expired");
  }
  if (Number.isFinite(issuedAt) && Number.isFinite(signedAt) && signedAt < issuedAt) {
    errors.push("signedAt must be later than issuedAt");
  }

  if (!Array.isArray(credential.capabilityIds) || !credential.capabilityIds.length) {
    errors.push("capabilityIds must include at least one authorized feed capability");
  } else {
    credential.capabilityIds.forEach((capability) => {
      if (!isAuthorizedFeedCapability(capability)) {
        errors.push(`unsupported authorized feed capability: ${String(capability)}`);
      }
    });
  }
  if (!Array.isArray(credential.limitations) || !compactList(credential.limitations).length) {
    errors.push("limitations must include at least one operating boundary");
  }
  if (credentialContainsUnsafeMarker(credential.limitations).length) {
    errors.push("credential limitations must not contain raw operational indicators");
  }

  return { valid: errors.length === 0, errors };
}

export async function verifyAuthorizedOperatorCredential(
  envelope: SignedAuthorizedOperatorCredential,
  trustedKeys: readonly TrustedAuthorizedFeedKey[],
  now = Date.now(),
): Promise<AuthorizedFeedValidationResult> {
  const syntax = validateAuthorizedOperatorCredentialEnvelope(envelope, now);
  const errors = [...syntax.errors];
  const trustedKey = findTrustedAuthorizedFeedKey(envelope.keyId, trustedKeys, now);

  if (!trustedKey) {
    errors.push("unknown or inactive authorized operator credential signing key");
  } else if (trustedKey.algorithm !== AUTHORIZED_FEED_SIGNATURE_ALGORITHM) {
    errors.push("unsupported authorized operator credential signature algorithm");
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  try {
    const subtle = requireSubtleCrypto();
    const publicKey = await subtle.importKey(
      "jwk",
      trustedKey!.publicKeyJwk,
      { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM, hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await subtle.verify(
      { name: AUTHORIZED_FEED_SIGNATURE_ALGORITHM },
      publicKey,
      base64UrlToBytes(envelope.signature),
      new TextEncoder().encode(authorizedOperatorCredentialSigningPayload(envelope)),
    );
    return verified ? { valid: true, errors: [] } : { valid: false, errors: ["operator credential signature verification failed"] };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "operator credential signature verification failed"],
    };
  }
}

export async function openAuthorizedFeedOperatorSessionFromCredential(
  envelope: SignedAuthorizedOperatorCredential,
  trustedKeys: readonly TrustedAuthorizedFeedKey[],
  now = Date.now(),
): Promise<AuthorizedFeedOperatorSession> {
  const verification = await verifyAuthorizedOperatorCredential(envelope, trustedKeys, now);
  if (!verification.valid) {
    throw new Error(`Authorized operator credential verification failed: ${verification.errors.join("; ")}`);
  }

  const credentialExpiresAt = parseDate(envelope.credential.expiresAt);
  const sessionExpiresAt = Math.min(now + AUTHORIZED_FEED_SESSION_MS, credentialExpiresAt);

  return {
    role: "AUTHORIZED_OPERATOR",
    openedAt: now,
    lastActivityAt: now,
    expiresAt: sessionExpiresAt,
    capabilityIds: compactList(envelope.credential.capabilityIds) as AuthorizedFeedCapability[],
    limitations: compactList([
      ...envelope.credential.limitations,
      "기관·파트너 서명 credential 확인 완료",
      "원문 URL·초대링크·계정 핸들 저장 금지",
      "비공개방 접근·구매·잠입·다운로드 금지",
    ]),
    identity: {
      credentialId: envelope.credential.credentialId.trim(),
      subjectId: envelope.credential.subjectId.trim(),
      issuerName: envelope.credential.issuerName.trim(),
      keyId: envelope.keyId.trim(),
      credentialExpiresAt: new Date(credentialExpiresAt).toISOString(),
      authenticatedAt: new Date(now).toISOString(),
    },
  };
}
