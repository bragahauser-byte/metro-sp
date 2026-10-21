import { OG_SIZE, ogImage } from "@/components/og/og-image";

export const alt = "Mapa interativo da rede de metrô de São Paulo";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({ eyebrow: "Mapa da rede", title: "Esquemático ↔ Real", subtitle: "15 linhas, 193 estações", lines: ["1", "2", "3", "4", "5", "6", "15", "17"] });
}
