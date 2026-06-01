import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const isDesktopExport = process.env.JIUM_DESKTOP_EXPORT === "true";
const isStaticHostingExport = process.env.JIUM_STATIC_HOSTING_EXPORT === "true";
const isStaticExport = isGithubPages || isDesktopExport || isStaticHostingExport;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  ...(!isStaticExport
    ? {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: SECURITY_HEADERS,
            },
          ];
        },
      }
    : {}),
  ...(isStaticExport
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
