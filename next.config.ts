import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow Electron app to access dev resources (HMR, webpack-hmr)
  allowedDevOrigins: ["127.0.0.1"],
  // Next's file tracing needs to pick up the generated Prisma client and
  // the better-sqlite3 native binding so they end up in .next/standalone.
  outputFileTracingIncludes: {
    "/**": [
      "./src/generated/prisma/**/*",
      "./node_modules/better-sqlite3/**/*",
      "./node_modules/@prisma/adapter-better-sqlite3/**/*",
    ],
  },
  // Disable remote image optimization — offline app has no Sharp/CDN,
  // and we serve uploaded images via /api/uploads/...
  images: {
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
