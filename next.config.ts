import type { NextConfig } from "next";

// DEPLOY_TARGET=pages: build estático para o GitHub Pages (https://bragahauser-byte.github.io/metro-sp/).
// Sem servidor: sem /api (o script scripts/build-pages.mjs tira a pasta do build) e sem redirecionamento
// no servidor — as páginas antigas redirecionam no navegador (components/map-redirect.tsx).
const pages = process.env.DEPLOY_TARGET === "pages";
const basePath = pages ? "/metro-sp" : "";

const nextConfig: NextConfig = {
  // Cache Components (usado pelos avisos em /api) não existe em build estático.
  cacheComponents: !pages,
  partialPrefetching: !pages,
  ...(pages ? { output: "export" as const, basePath, trailingSlash: true, images: { unoptimized: true } } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_DEPLOY_TARGET: pages ? "pages" : "vercel",
  },
  // Endereços antigos → o mapa com o painel certo (a query, como ?de=&para=, é mantida).
  ...(pages
    ? {}
    : {
        async redirects() {
          return [
            { source: "/mapa", destination: "/", permanent: true },
            { source: "/linhas", destination: "/?painel=linhas", permanent: true },
            { source: "/linhas/:id", destination: "/?linha=:id", permanent: true },
            { source: "/estacoes/:slug", destination: "/?estacao=:slug", permanent: true },
            { source: "/rota", destination: "/?painel=busca", permanent: true },
            { source: "/como-chegar", destination: "/?painel=busca", permanent: true },
            { source: "/perto-de-mim", destination: "/?painel=perto", permanent: true },
            { source: "/sobre", destination: "/?painel=sobre", permanent: true },
          ];
        },
      }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      // Dados do mapa em GeoJSON são importados como JSON comum.
      "*.geojson": {
        type: "json",
      },
    },
  },
};

export default nextConfig;
