import type { NextConfig } from "next";

/**
 * Keep this config Edge/build-safe: no Node `path` / `__dirname`
 * (those caused Vercel Edge middleware ReferenceError: __dirname is not defined).
 *
 * outputFileTracingRoot was only needed locally when a parent package-lock.json
 * confused tracing — not required on Vercel.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
