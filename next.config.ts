import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";

const isGithubPages = process.env.GITHUB_PAGES === "true";

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
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath: "/jium-ai",
        assetPrefix: "/jium-ai/",
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

export default nextConfig;
