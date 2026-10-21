import { OG_SIZE, ogImage } from "@/components/og/og-image";

export const alt = "Metrô (beta) — mapa conceitual da rede de metrô de São Paulo";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "Mapa conceitual", title: "A rede de São Paulo", subtitle: "Esquemático e real, com estação mais perto de você", lines: [] });
}
