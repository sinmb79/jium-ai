import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const isDesktopExport = process.env.JIUM_DESKTOP_EXPORT === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  ...(isGithubPages || isDesktopExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
        ...(isGithubPages
          ? {
              basePath: "/jium-ai",
              assetPrefix: "/jium-ai/",
            }
          : {}),
      }
    : {}),
};

export default nextConfig;
