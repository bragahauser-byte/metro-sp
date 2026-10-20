// Mini-mapa estático (SVG gerado no build) do entorno de uma estação: traçado real das linhas,
// estações vizinhas e entradas. Sem tiles — leve e legível em qualquer tela.
import { type LngLat, entrances, lineById, segments, stationBySlug, stations } from "@/components/map/network";

const R = 6378137;
const merc = ([lon, lat]: LngLat) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];

export function StationMiniMap({ slug, radius = 1100 }: { slug: string; radius?: number }) {
  const st = stationBySlug.get(slug)!;
  const [cx, cy] = merc(st.geo);
  // Mercator estica com a latitude; corrige o raio para metros reais.
  const k = 1 / Math.cos((st.geo[1] * Math.PI) / 180);
  const r = radius * k;
  const size = 400;
  const P = (p: LngLat) => {
    const [x, y] = merc(p);
    return [((x - cx) / r) * (size / 2) + size / 2, (-(y - cy) / r) * (size / 2) + size / 2] as const;
  };
  const inside = ([x, y]: readonly [number, number]) => x > -40 && x < size + 40 && y > -40 && y < size + 40;

  const segs = segments.filter((s) => s.geo.some((p) => inside(P(p))));
  const near = stations.filter((s) => inside(P(s.geo)));
  const ents = entrances.filter((e) => inside(P(e.lngLat)));

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="aspect-square w-full border border-rule bg-bg"
        role="img"
        aria-label={`Mapa do entorno da estação ${st.nome}, com as linhas e estações num raio de ${Math.round(radius / 100) / 10} km.`}
      >
        {segs.map((s, i) => {
          const d = s.geo.map((p, j) => `${j ? "L" : "M"}${P(p).map((n) => n.toFixed(1)).join(" ")}`).join("");
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="var(--bg)" strokeWidth="11" strokeLinejoin="round" />
              <path
                d={d}
                fill="none"
                stroke={lineById.get(s.linha)!.cor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s.status === "em-obras" ? 0.35 : 1}
              />
            </g>
          );
        })}
        {ents.map((e, i) => {
          const [x, y] = P(e.lngLat);
          return <rect key={i} x={x - 4} y={y - 4} width="8" height="8" fill="var(--ink)" />;
        })}
        {near.map((s) => {
          const [x, y] = P(s.geo);
          const self = s.slug === slug;
          return (
            <g key={s.slug}>
              <circle cx={x} cy={y} r={self ? 9 : 5} fill="var(--ink)" />
              {self && <circle cx={x} cy={y} r="15" fill="none" stroke="var(--ink)" strokeWidth="2.5" />}
              <text
                x={x + (self ? 20 : 9)}
                y={y + 4}
                fontSize={self ? 17 : 12}
                fontWeight="700"
                fill="var(--ink)"
                stroke="var(--bg)"
                strokeWidth="3"
                paintOrder="stroke"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {s.nome}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-caption text-ink-muted">
        Raio de {(radius / 1000).toLocaleString("pt-BR")} km. Quadrados pretos: entradas mapeadas no OpenStreetMap. Traçado ©
        OpenStreetMap contributors.
      </figcaption>
    </figure>
  );
}
