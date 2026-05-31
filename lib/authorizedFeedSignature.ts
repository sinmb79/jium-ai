import {
  importAuthorizedFeedBundleForOperator,
  type AuthorizedFeedBundle,
  type AuthorizedFeedIndicator,
  type AuthorizedFeedValidationResult,
} from "@/lib/authorizedIntelligenceFeed";
import type { AuthorizedFeedOperatorSession } from "@/lib/authorizedFeedAccess";

export const SIGNED_AUTHORIZED_FEED_VERSION = "jium-authorized-feed-signed-v1";
export const AUTHORIZED_FEED_SIGNATURE_ALGORITHM = "RSASSA-PKCS1-v1_5";

export type AuthorizedFeedSignatureAlgorithm = typeof AUTHORIZED_FEED_SIGNATURE_ALGORITHM;

export type TrustedAuthorizedFeedKey = {
  keyId: string;
  issuerName: string;
  algorithm: AuthorizedFeedSignatureAlgorithm;
  publicKeyJwk: JsonWebKey;
  validFrom?: string;
  validUntil?: string;
};

export type SignedAuthorizedFeedPayload = {
  version: typeof SIGNED_AUTHORIZED_FEED_VERSION;
  keyId: string;
  signedAt: string;
  bundle: AuthorizedFeedBundle;
};

export type SignedAuthorizedFeedBundle = SignedAuthorizedFeedPayload & {
  signature: string;
};

function assertPlainJsonObject(value: object) {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Only plain JSON objects can be signed");
  }
}

export function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Non-finite numbers cannot be signed");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    assertPlainJsonObject(value);
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entryValue]) => {
        if (typeof entryValue === "undefined") {
          throw new Error(`Undefined value cannot be signed: ${key}`);
        }
        return `${JSON.stringify(key)}:${canonicalizeJson(entryValue)}`;
      })
      .join(",")}}`;
  }
  throw new Error(`Unsupported JSON value for signing: ${typeof value}`);
}

export function authorizedFeedSigningPayload(payload: SignedAuthorizedFeedPayload) {
  return canonicalizeJson({
    bundle: payload.bundle,
    keyId: payload.keyId,
    signedAt: payload.signedAt,
    version: payload.version,
  });
}

export function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function isSignedAuthorizedFeedBundle(value: unknown): value is SignedAuthorizedFeedBundle {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SignedAuthorizedFeedBundle>;
  return candidate.version === SIGNED_AUTHORIZED_FEED_VERSION && typeof candidate.keyId === "string" && typeof candidate.signature === "string";
}

export function findTrustedAuthorizedFeedKey(
  keyId: string,
  trustedKeys: readonly TrustedAuthorizedFeedKey[],
  now = Date.now(),
) {
  const trustedKey = trustedKeys.find((key) => key.keyId === keyId);
  if (!trustedKey) {
    return null;
  }
  if (trustedKey.validFrom && Date.parse(trustedKey.validFrom) > now) {
    return null;
  }
  if (trustedKey.validUntil && Date.parse(trustedKey.validUntil) <= now) {
    return null;
  }
  return trustedKey;
}

function requireSubtleCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto SubtleCrypto is required for authorized feed signature verification");
  }
  return globalThis.crypto.subtle;
}

function validateSignedEnvelopeSyntax(envelope: SignedAuthorizedFeedBundle) {
  const errors: string[] = [];
  if (envelope.version !== SIGNED_AUTHORIZED_FEED_VERSION) {
    errors.push("unsupported signed authorized feed version");
  }
  if (!envelope.keyId?.trim()) {
    errors.push("keyId is required");
  }
  if (!envelope.signature?.trim()) {
    errors.push("signature is required");
  }
  if (!Number.isFinite(Date.parse(envelope.signedAt))) {
    errors.push("signedAt must be an ISO date");
  }
  if (!envelope.bundle || envelope.bundle.version !== "jium-authorized-feed-v1") {
    errors.push("bundle must be a jium-authorized-feed-v1 payload");
  }
  return errors;
}

export async function verifyAuthorizedFeedSignature(
  envelope: SignedAuthorizedFeedBundle,
  trustedKeys: readonly TrustedAuthorizedFeedKey[],
  now = Date.now(),
): Promise<AuthorizedFeedValidationResult> {
  const errors = validateSignedEnvelopeSyntax(envelope);
  const trustedKey = findTrustedAuthorizedFeedKey(envelope.keyId, trustedKeys, now);

  if (!trustedKey) {
    errors.push("unknown or inactive authorized feed signing key");
  } else if (trustedKey.algorithm !== AUTHORIZED_FEED_SIGNATURE_ALGORITHM) {
    errors.push("unsupported authorized feed signature algorithm");
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
      new TextEncoder().encode(authorizedFeedSigningPayload(envelope)),
    );
    return verified ? { valid: true, errors: [] } : { valid: false, errors: ["signature verification failed"] };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "signature verification failed"],
    };
  }
}

export async function importSignedAuthorizedFeedBundleForOperator(
  envelope: SignedAuthorizedFeedBundle,
  trustedKeys: readonly TrustedAuthorizedFeedKey[],
  session: AuthorizedFeedOperatorSession | null | undefined,
  existing: AuthorizedFeedIndicator[] = [],
  importedAt = new Date().toISOString(),
  now = Date.now(),
) {
  const verification = await verifyAuthorizedFeedSignature(envelope, trustedKeys, now);
  if (!verification.valid) {
    throw new Error(`Signed authorized feed verification failed: ${verification.errors.join("; ")}`);
  }
  return importAuthorizedFeedBundleForOperator(envelope.bundle, session, existing, importedAt, now);
}
