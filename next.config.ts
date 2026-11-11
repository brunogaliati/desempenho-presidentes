import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots.js";

const nextConfig: NextConfig = {
  // Robôs de prévia que só leem o <head>: a lista do Next e os que ela não tem.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|TelegramBot|Cardyb|Mastodon`, "i"),
  // Permite conferir o build sem sobrescrever os artefatos do servidor local.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async redirects() {
    return [
      { source: "/prototipo/api/:path*", destination: "/api/painel/:path*", permanent: true },
      { source: "/prototipo/:arquivo+", destination: "/painel/:arquivo+", permanent: true },
    ];
  },
  experimental: {
    // O Neon tem memória limitada; pré-renderizar uma página por vez evita
    // executar as mesmas agregações históricas em dezenas de conexões.
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
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
