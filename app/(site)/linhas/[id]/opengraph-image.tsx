import { OG_SIZE, ogImage } from "@/components/og/og-image";
import { lineById, lines, stationsOfLine } from "@/components/map/network";

export const alt = "Linha do metrô de São Paulo";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return lines.map((l) => ({ id: l.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const line = lineById.get(id)!;
  return ogImage({
    eyebrow: `Operação ${line.operador}`,
    title: line.nome,
    subtitle: `${stationsOfLine(id).length} estações`,
    lines: [id],
  });
}
