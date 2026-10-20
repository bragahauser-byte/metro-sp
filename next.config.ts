import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
