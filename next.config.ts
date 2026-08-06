import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

// ESM-safe project root (do not use bare __dirname — breaks Edge/ESM contexts).
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Prevent Next from picking C:\Users\Dema\package-lock.json as workspace root.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
