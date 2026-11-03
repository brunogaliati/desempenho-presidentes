import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite conferir o build sem sobrescrever os artefatos do servidor local.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
    ],
  },
};

export default nextConfig;
