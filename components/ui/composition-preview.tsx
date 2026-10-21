import { Button, IconButton } from "./button";
import { Card } from "./card";
import { LineBadge } from "./line-badge";
import { METRO_LINE_IDS, getLine } from "./lines";

/** Ilustração de linhas sobre o basemap — não é traçado real. */
function MapSketch() {
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
      <g fill="none" strokeWidth="10" strokeLinejoin="round">
        <path d="M200 0 V300" stroke={c("1")} />
        <path d="M0 150 H120 Q150 150 165 165 L240 240 Q255 255 280 255 H400" stroke={c("3")} />
        <path d="M400 70 H260 Q230 70 215 85 L0 300" stroke={c("2")} />
        <path d="M60 0 V60 Q60 90 90 110 L400 230" stroke={c("4")} />
      </g>
      <g fill="var(--ink)">
        <circle cx="200" cy="200" r="7" />
        <circle cx="200" cy="100" r="7" />
        <circle cx="120" cy="150" r="7" />
      </g>
    </svg>
  );
}

/** Composição de referência: mapa em tela cheia com cartão e botão flutuantes. */
export function CompositionPreview() {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/5] overflow-hidden border border-rule sm:aspect-[16/9]">
        <MapSketch />
        <Card className="absolute left-2 top-2 w-[calc(100%-32px)] max-w-36 p-2">
          <p className="text-lg font-bold">Mapa da rede</p>
          <div className="mt-1 flex gap-2 border-b border-rule text-xs font-semibold" role="presentation">
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
      <p className="text-xs text-ink-muted">Ilustração — não representa o traçado real.</p>
      <div className="flex flex-wrap gap-1">
        <Button>Ver no mapa</Button>
        <Button variant="secondary">Lista de estações</Button>
      </div>
    </div>
  );
}
