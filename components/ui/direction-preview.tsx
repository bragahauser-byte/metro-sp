import { Button, IconButton } from "./button";
import { Card } from "./card";
import { LineBadge } from "./line-badge";
import { METRO_LINE_IDS, getLine } from "./lines";
import { StationCard } from "./station-card";
import { StatusChip } from "./status-chip";

type Direction = "a" | "b";

/** Ilustração de linhas sobre o basemap — não é traçado real. */
function MapSketch({ direction }: { direction: Direction }) {
  const soft = direction === "a";
  const join = soft ? "round" : "miter";
  const w = soft ? 10 : 6;
  const c = (id: string) => getLine(id).cor;
  return (
    <svg
      viewBox="0 0 400 300"
      className="absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect width="400" height="300" fill="var(--bg)" />
      <g stroke="var(--map-street)" strokeWidth="6">
        {[40, 110, 180, 250].map((y) => (
          <line key={`h${y}`} x1="0" x2="400" y1={y} y2={y} />
        ))}
        {[60, 150, 240, 330].map((x) => (
          <line key={`v${x}`} x1={x} x2={x} y1="0" y2="300" />
        ))}
      </g>
      <rect x="250" y="190" width="70" height="50" fill="var(--map-park)" />
      <g fill="none" strokeWidth={w} strokeLinejoin={join} strokeLinecap="butt">
        <path d={soft ? "M200 0 V300" : "M200 0 V300"} stroke={c("1")} />
        <path
          d={soft ? "M0 150 H120 Q150 150 165 165 L240 240 Q255 255 280 255 H400" : "M0 150 H135 L225 240 H400"}
          stroke={c("3")}
        />
        <path
          d={soft ? "M400 70 H260 Q230 70 215 85 L0 300" : "M400 70 H245 L15 300"}
          stroke={c("2")}
        />
        <path d={soft ? "M60 0 V60 Q60 90 90 110 L400 230" : "M60 0 V80 L400 250"} stroke={c("4")} />
      </g>
      <g fill="var(--ink)">
        {soft ? (
          <>
            <circle cx="200" cy="200" r="7" />
            <circle cx="200" cy="100" r="7" />
            <circle cx="120" cy="150" r="7" />
          </>
        ) : (
          <>
            <rect x="190" y="196" width="20" height="8" />
            <rect x="190" y="96" width="20" height="8" />
            <rect x="116" y="140" width="8" height="20" />
          </>
        )}
      </g>
    </svg>
  );
}

const COPY: Record<Direction, { name: string; tagline: string }> = {
  a: {
    name: "A · Mapa vivo",
    tagline: "Mapa em tela cheia, cartões flutuantes com sombra, curvas suaves e badges circulares.",
  },
  b: {
    name: "B · Cauduro",
    tagline: "Módulos quadrados, fio divisor no lugar da sombra, cantos vivos a 45° e badges quadrados.",
  },
};

export function DirectionPreview({ direction }: { direction: Direction }) {
  const { name, tagline } = COPY[direction];
  return (
    <section data-direction={direction} aria-labelledby={`dir-${direction}`} className="flex flex-col gap-2">
      <div>
        <h3 id={`dir-${direction}`} className="text-title-s font-bold tracking-tight">
          {name}
        </h3>
        <p className="max-w-[48ch] text-body text-ink-muted">{tagline}</p>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden border border-rule sm:aspect-square">
        <MapSketch direction={direction} />
        <Card className="absolute left-2 top-2 w-[calc(100%-32px)] max-w-36 p-2">
          <p className="text-lead font-bold tracking-tight">Mapa da rede</p>
          <div className="mt-1 flex gap-2 border-b border-rule text-caption font-semibold" role="presentation">
            <span className="-mb-px border-b-2 border-ink pb-0.5">Esquemático</span>
            <span className="pb-0.5 text-ink-muted">Real</span>
          </div>
          <ul className="mt-2 grid grid-cols-4 gap-1">
            {METRO_LINE_IDS.map((id) => (
              <li key={id}>
                <LineBadge line={id} />
              </li>
            ))}
          </ul>
        </Card>
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <IconButton label="Estação mais perto de mim">
            <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" />
            </svg>
          </IconButton>
        </div>
      </div>

      <StationCard name="Paraíso" lines={["1", "2"]} status="operando" />
      <div className="flex flex-wrap gap-1">
        <StatusChip status="operando" />
        <StatusChip status="operacao-assistida" />
        <StatusChip status="em-obras" />
        <StatusChip status="planejada" />
      </div>
      <div className="flex flex-wrap gap-1">
        <Button>Ver no mapa</Button>
        <Button variant="secondary">Lista de estações</Button>
      </div>
    </section>
  );
}
