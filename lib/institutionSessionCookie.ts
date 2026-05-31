export const INSTITUTION_SESSION_COOKIE_NAME = "__Host-jium_institution_session";
export const INSTITUTION_DEV_SESSION_COOKIE_NAME = "jium_institution_session_dev";
export const INSTITUTION_SESSION_COOKIE_PATH = "/";
export const INSTITUTION_SESSION_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export type InstitutionSessionCookieOptions = {
  secure: boolean;
  maxAgeSeconds?: number;
  sameSite?: "Strict" | "Lax";
};

function assertCookieValue(value: string) {
  if (!value.trim()) {
    throw new Error("institution session cookie value is required");
  }
  if (/[\u0000-\u001F\u007F;\s]/.test(value)) {
    throw new Error("institution session cookie value contains invalid characters");
  }
}

export function institutionSessionCookieName(secure: boolean) {
  return secure ? INSTITUTION_SESSION_COOKIE_NAME : INSTITUTION_DEV_SESSION_COOKIE_NAME;
}

export function serializeInstitutionSessionCookie(token: string, options: InstitutionSessionCookieOptions) {
  assertCookieValue(token);
  const maxAge = options.maxAgeSeconds ?? INSTITUTION_SESSION_COOKIE_MAX_AGE_SECONDS;
  if (!Number.isInteger(maxAge) || maxAge <= 0 || maxAge > INSTITUTION_SESSION_COOKIE_MAX_AGE_SECONDS) {
    throw new Error(`institution session cookie maxAge must be between 1 and ${INSTITUTION_SESSION_COOKIE_MAX_AGE_SECONDS} seconds`);
  }

  const attributes = [
    `${institutionSessionCookieName(options.secure)}=${token}`,
    "HttpOnly",
    `Path=${INSTITUTION_SESSION_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    `SameSite=${options.sameSite || "Strict"}`,
  ];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function serializeInstitutionSessionClearCookie(options: Pick<InstitutionSessionCookieOptions, "secure">) {
  const attributes = [
    `${institutionSessionCookieName(options.secure)}=`,
    "HttpOnly",
    `Path=${INSTITUTION_SESSION_COOKIE_PATH}`,
    "Max-Age=0",
    "SameSite=Strict",
  ];
  if (options.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function parseCookieHeader(cookieHeader: string | null | undefined) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }
  cookieHeader.split(";").forEach((part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    const name = rawName?.trim();
    if (!name) {
      return;
    }
    cookies.set(name, rawValue.join("="));
  });
  return cookies;
}

export function readInstitutionSessionTokenFromCookie(cookieHeader: string | null | undefined, secure: boolean) {
  return parseCookieHeader(cookieHeader).get(institutionSessionCookieName(secure)) || null;
}
