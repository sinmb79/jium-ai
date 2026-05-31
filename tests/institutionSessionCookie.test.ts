import { describe, expect, it } from "vitest";
import {
  INSTITUTION_DEV_SESSION_COOKIE_NAME,
  INSTITUTION_SESSION_COOKIE_NAME,
  parseCookieHeader,
  readInstitutionSessionTokenFromCookie,
  serializeInstitutionSessionClearCookie,
  serializeInstitutionSessionCookie,
} from "@/lib/institutionSessionCookie";

describe("institution session cookie policy", () => {
  it("serializes production institution sessions as Secure HttpOnly host cookies", () => {
    const header = serializeInstitutionSessionCookie("header.payload.signature", { secure: true });

    expect(header).toContain(`${INSTITUTION_SESSION_COOKIE_NAME}=header.payload.signature`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("Path=/");
    expect(header).toContain("SameSite=Strict");
    expect(header).toContain("Max-Age=600");
    expect(header).not.toContain("Domain=");
  });

  it("uses a non-host dev cookie only when secure cookies are disabled", () => {
    const header = serializeInstitutionSessionCookie("header.payload.signature", { secure: false, sameSite: "Lax", maxAgeSeconds: 60 });

    expect(header).toContain(`${INSTITUTION_DEV_SESSION_COOKIE_NAME}=header.payload.signature`);
    expect(header).toContain("HttpOnly");
    expect(header).not.toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=60");
  });

  it("rejects unsafe cookie values and excessive lifetimes", () => {
    expect(() => serializeInstitutionSessionCookie("bad;value", { secure: true })).toThrow("invalid characters");
    expect(() => serializeInstitutionSessionCookie("ok", { secure: true, maxAgeSeconds: 601 })).toThrow("maxAge");
  });

  it("reads and clears the session cookie", () => {
    const token = "header.payload.signature";
    const cookieHeader = `theme=light; ${INSTITUTION_SESSION_COOKIE_NAME}=${token}`;
    const parsed = parseCookieHeader(cookieHeader);
    const clear = serializeInstitutionSessionClearCookie({ secure: true });

    expect(parsed.get(INSTITUTION_SESSION_COOKIE_NAME)).toBe(token);
    expect(readInstitutionSessionTokenFromCookie(cookieHeader, true)).toBe(token);
    expect(clear).toContain(`${INSTITUTION_SESSION_COOKIE_NAME}=`);
    expect(clear).toContain("Max-Age=0");
    expect(clear).toContain("Secure");
  });
});
