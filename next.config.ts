import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: frontendRoot,
  // Bundle the Linux `bin/yt-dlp` downloaded in `prebuild` into the `/api/download` serverless trace (Vercel).
  outputFileTracingIncludes: {
    "**/api/download/**": ["./bin/yt-dlp"],
  },
};

export default nextConfig;
