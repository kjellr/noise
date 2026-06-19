import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'export',
  // Set via NEXT_PUBLIC_BASE_PATH env var in CI; empty string for local dev
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
};

export default nextConfig;
