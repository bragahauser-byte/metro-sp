import { OG_SIZE, ogImage } from "@/components/og/og-image";
import { stationBySlug, stations } from "@/components/map/network";

export const alt = "Estação do metrô de São Paulo";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return stations.map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const st = stationBySlug.get(slug)!;
  return ogImage({ eyebrow: "Estação", title: st.nome, subtitle: st.complemento ?? undefined, lines: st.linhas });
}
