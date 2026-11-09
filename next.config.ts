import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // permite um segundo servidor de teste (NEXT_DIST_DIR=.next-teste npm run dev -- -p 3100) sem brigar com o .next do primeiro
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // abrir o caderno pelo IP da rede local (celular ou outro computador) no modo dev; sem isto o Next bloqueia os scripts e os botões não funcionam
  allowedDevOrigins: ["192.168.100.18"],
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // a planilha de importação pode chegar perto de 1 MB; o limite padrão das ações de servidor também é 1 MB e
  // devolveria um erro genérico antes da nossa mensagem em português
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // Segurança básica em todas as páginas: não deixa embutir em outro site, não deixa buscadores indexarem
  // (os endereços dos cadernos são secretos) e não vaza o endereço completo ao clicar em links externos.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
