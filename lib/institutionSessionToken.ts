import {
  canonicalizeJson,
  base64UrlToBytes,
  bytesToBase64Url,
} from "@/lib/authorizedFeedSignature";
import {
  validateInstitutionAccountSession,
  type InstitutionAccountSession,
} from "@/lib/institutionAuth";
import type { AuthorizedFeedValidationResult } from "@/lib/authorizedIntelligenceFeed";

export const INSTITUTION_SESSION_TOKEN_VERSION = "jium-institution-session-token-v1";
export const INSTITUTION_SESSION_TOKEN_ALGORITHM = "HS256";
export const INSTITUTION_SESSION_TOKEN_TYPE = "JIUM_INSTITUTION_SESSION";
export const INSTITUTION_SESSION_SECRET_MIN_BYTES = 32;

export type InstitutionSessionTokenHeader = {
  version: typeof INSTITUTION_SESSION_TOKEN_VERSION;
  typ: typeof INSTITUTION_SESSION_TOKEN_TYPE;
  alg: typeof INSTITUTION_SESSION_TOKEN_ALGORITHM;
  keyId: string;
};

export type InstitutionSessionTokenPayload = {
  version: typeof INSTITUTION_SESSION_TOKEN_VERSION;
  tokenId: string;
  issuedAt: string;
  session: InstitutionAccountSession;
};

export type InstitutionSessionTokenKey = {
  keyId: string;
  secret: string | Uint8Array;
  validFrom?: string;
  validUntil?: string;
};

export type InstitutionSessionTokenVerification = AuthorizedFeedValidationResult & {
  header?: InstitutionSessionTokenHeader;
  payload?: InstitutionSessionTokenPayload;
  session?: InstitutionAccountSession;
};

function requireSubtleCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto SubtleCrypto is required for institution session tokens");
  }
  return globalThis.crypto.subtle;
}

function parseDate(value?: string) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function secretToBytes(secret: string | Uint8Array) {
  return typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function validateInstitutionSessionTokenKey(key: InstitutionSessionTokenKey | null | undefined, now = Date.now()) {
  const errors: string[] = [];
  if (!key) {
    return ["institution session signing key is required"];
  }
  if (!key.keyId?.trim()) {
    errors.push("keyId is required");
  }
  if (secretToBytes(key.secret).byteLength < INSTITUTION_SESSION_SECRET_MIN_BYTES) {
    errors.push(`institution session token secret must be at least ${INSTITUTION_SESSION_SECRET_MIN_BYTES} bytes`);
  }
  if (key.validFrom && !Number.isFinite(parseDate(key.validFrom))) {
    errors.push("validFrom must be an ISO date when present");
  }
  if (key.validUntil && !Number.isFinite(parseDate(key.validUntil))) {
    errors.push("validUntil must be an ISO date when present");
  }
  if (key.validFrom && Number.isFinite(parseDate(key.validFrom)) && parseDate(key.validFrom) > now) {
    errors.push("institution session token key is not active yet");
  }
  if (key.validUntil && Number.isFinite(parseDate(key.validUntil)) && parseDate(key.validUntil) <= now) {
    errors.push("institution session token key has expired");
  }
  if (key.validFrom && key.validUntil && Number.isFinite(parseDate(key.validFrom)) && Number.isFinite(parseDate(key.validUntil)) && parseDate(key.validUntil) <= parseDate(key.validFrom)) {
    errors.push("validUntil must be later than validFrom");
  }
  return errors;
}

function findActiveInstitutionSessionTokenKey(
  keyId: string,
  keys: readonly InstitutionSessionTokenKey[],
  now = Date.now(),
) {
  const key = keys.find((candidate) => candidate.keyId === keyId);
  if (!key || validateInstitutionSessionTokenKey(key, now).length) {
    return null;
  }
  return key;
}

function encodeCanonicalSegment(value: unknown) {
  return bytesToBase64Url(new TextEncoder().encode(canonicalizeJson(value)));
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
}

async function importHmacKey(key: InstitutionSessionTokenKey, usages: KeyUsage[]) {
  return requireSubtleCrypto().importKey(
    "raw",
    toArrayBuffer(secretToBytes(key.secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function validateServerIssuedInstitutionSession(session: InstitutionAccountSession, now = Date.now()) {
  const validation = validateInstitutionAccountSession(session, now);
  const errors = [...validation.errors];
  if (session.assuranceLevel === "LOCAL_SIGNED_CREDENTIAL") {
    errors.push("server session tokens cannot be issued for LOCAL_SIGNED_CREDENTIAL sessions");
  }
  return errors;
}

export async function createInstitutionSessionToken(
  session: InstitutionAccountSession,
  key: InstitutionSessionTokenKey,
  options: { tokenId?: string; now?: number } = {},
) {
  const now = options.now ?? Date.now();
  const keyErrors = validateInstitutionSessionTokenKey(key, now);
  const sessionErrors = validateServerIssuedInstitutionSession(session, now);
  if (keyErrors.length || sessionErrors.length) {
    throw new Error(`Institution session token cannot be issued: ${[...keyErrors, ...sessionErrors].join("; ")}`);
  }

  const header: InstitutionSessionTokenHeader = {
    version: INSTITUTION_SESSION_TOKEN_VERSION,
    typ: INSTITUTION_SESSION_TOKEN_TYPE,
    alg: INSTITUTION_SESSION_TOKEN_ALGORITHM,
    keyId: key.keyId.trim(),
  };
  const payload: InstitutionSessionTokenPayload = {
    version: INSTITUTION_SESSION_TOKEN_VERSION,
    tokenId: options.tokenId || `ist-${bytesToBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(16)))}`,
    issuedAt: new Date(now).toISOString(),
    session,
  };
  const encodedHeader = encodeCanonicalSegment(header);
  const encodedPayload = encodeCanonicalSegment(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const cryptoKey = await importHmacKey(key, ["sign"]);
  const signature = await requireSubtleCrypto().sign("HMAC", cryptoKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(signature)}`;
}

export async function verifyInstitutionSessionToken(
  token: string,
  keys: readonly InstitutionSessionTokenKey[],
  now = Date.now(),
): Promise<InstitutionSessionTokenVerification> {
  const errors: string[] = [];
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part.trim())) {
    return { valid: false, errors: ["institution session token must have three non-empty segments"] };
  }

  let header: InstitutionSessionTokenHeader;
  let payload: InstitutionSessionTokenPayload;
  try {
    header = decodeJsonSegment<InstitutionSessionTokenHeader>(parts[0]!);
    payload = decodeJsonSegment<InstitutionSessionTokenPayload>(parts[1]!);
  } catch {
    return { valid: false, errors: ["institution session token is not valid JSON"] };
  }

  if (header.version !== INSTITUTION_SESSION_TOKEN_VERSION || payload.version !== INSTITUTION_SESSION_TOKEN_VERSION) {
    errors.push("unsupported institution session token version");
  }
  if (header.typ !== INSTITUTION_SESSION_TOKEN_TYPE) {
    errors.push("unsupported institution session token type");
  }
  if (header.alg !== INSTITUTION_SESSION_TOKEN_ALGORITHM) {
    errors.push("unsupported institution session token algorithm");
  }
  if (!header.keyId?.trim()) {
    errors.push("institution session token keyId is required");
  }
  if (!payload.tokenId?.trim()) {
    errors.push("institution session token tokenId is required");
  }
  if (!Number.isFinite(parseDate(payload.issuedAt))) {
    errors.push("institution session token issuedAt must be an ISO date");
  }

  const key = findActiveInstitutionSessionTokenKey(header.keyId, keys, now);
  if (!key) {
    errors.push("unknown or inactive institution session token key");
  }
  if (payload.session) {
    errors.push(...validateServerIssuedInstitutionSession(payload.session, now));
  } else {
    errors.push("institution session token payload session is required");
  }
  if (errors.length) {
    return { valid: false, errors, header, payload };
  }

  const signingInput = `${parts[0]}.${parts[1]}`;
  const cryptoKey = await importHmacKey(key!, ["verify"]);
  const verified = await requireSubtleCrypto().verify(
    "HMAC",
    cryptoKey,
    base64UrlToBytes(parts[2]!),
    new TextEncoder().encode(signingInput),
  );
  if (!verified) {
    return { valid: false, errors: ["institution session token signature verification failed"], header, payload };
  }

  return { valid: true, errors: [], header, payload, session: payload.session };
}
