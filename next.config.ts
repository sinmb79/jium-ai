import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
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
