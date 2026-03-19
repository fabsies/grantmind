import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverComponentsExternalPackages: ['viem', '@google/generative-ai'],
  },
};

export default nextConfig;