import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("Next.js security headers", () => {
  it("sets production security headers for hosted operation", async () => {
    const entries = await nextConfig.headers?.();
    const root = entries?.find((entry) => entry.source === "/(.*)");
    const headers = new Map(root?.headers.map((header) => [header.key, header.value]));

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Content-Security-Policy-Report-Only")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy-Report-Only")).toContain("object-src 'none'");
  });
});
