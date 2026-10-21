import type { MetadataRoute } from "next";
import { lines, stations } from "@/components/map/network";

const BASE = "https://metro-sp-beta.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/mapa", "/linhas", "/rota", "/perto-de-mim", "/sobre", "/estilo"];
  return [
    ...pages.map((p) => ({ url: `${BASE}${p}` })),
    ...lines.map((l) => ({ url: `${BASE}/linhas/${l.id}` })),
    ...stations.map((s) => ({ url: `${BASE}/estacoes/${s.slug}` })),
  ];
}
