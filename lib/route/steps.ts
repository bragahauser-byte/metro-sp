// Passo a passo de uma rota de porta a porta, em frases que dá para seguir:
// "Caminhe 450 m (6 min) até a Estação Paraíso" → "Pegue a Linha 2-Verde sentido Vila Prudente"
// → "Baldeie para a Linha 1-Azul sentido Jabaquara" → "Desça em Saúde" → "Caminhe 300 m até o destino".
// Puro: os nomes de estação e de linha entram de fora (testável sem os dados).
import type { RouteOption } from "./engine.ts";
import { formatTime } from "../time/sao-paulo.ts";
import { type LngLat, type Walk, formatDistance } from "../geo/walk.ts";

export type StepKind = "walk" | "ride" | "transfer" | "alight";

export type Step = {
  kind: StepKind;
  /** Linha do trecho (ride/transfer): cor e número do ícone. */
  linha?: string;
  titulo: string;
  detalhe: string;
  minutos: number;
  /** Estações do trecho (para "ver estações"). */
  estacoes?: string[];
  /** O que o mapa enquadra ao tocar no passo. */
  focus: { stations: string[]; points: LngLat[] };
};

export type Names = { station: (slug: string) => string; line: (id: string) => string };
export type End = { nome: string; lngLat: LngLat | null; isStation: boolean };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const at = (d?: Date) => (d ? ` às ${formatTime(d)}` : "");

export function buildSteps(
  r: RouteOption,
  names: Names,
  opts: { walkIn?: Walk | null; walkOut?: Walk | null; from?: End | null; to?: End | null } = {},
): Step[] {
  const out: Step[] = [];
  const first = r.legs[0].estacoes[0];
  const lastLeg = r.legs[r.legs.length - 1];
  const last = lastLeg.estacoes[lastLeg.estacoes.length - 1];

  if (opts.walkIn) {
    const w = opts.walkIn;
    out.push({
      kind: "walk",
      titulo: `Caminhe ${formatDistance(w.distanciaM)} (${w.minutos} min) até a Estação ${names.station(first)}`,
      detalhe: `${opts.from?.nome ? `Saindo de ${opts.from.nome} · ` : ""}estimativa a pé`,
      minutos: w.minutos,
      focus: { stations: [first], points: opts.from?.lngLat ? [opts.from.lngLat] : [] },
    });
  }

  r.legs.forEach((leg, i) => {
    const line = names.line(leg.linha);
    const sentido = leg.sentido ? ` sentido ${leg.sentido}` : "";
    const stops = leg.estacoes.length - 1;
    const alt = leg.alternativas?.length ? ` (ou ${leg.alternativas.map(names.line).join(", ")})` : "";
    const board = names.station(leg.estacoes[0]);
    const prevLast = i > 0 ? r.legs[i - 1].estacoes[r.legs[i - 1].estacoes.length - 1] : null;
    const where =
      i === 0
        ? `Embarque em ${board}`
        : prevLast && prevLast !== leg.estacoes[0]
          ? `Em ${board} (passagem a partir de ${names.station(prevLast)})`
          : `Em ${board}`;
    out.push({
      kind: i === 0 ? "ride" : "transfer",
      linha: leg.linha,
      titulo: `${i === 0 ? "Pegue a" : "Baldeie para a"} ${line}${sentido}${alt}`,
      detalhe: `${where}${at(leg.partida)} · ${plural(stops, "estação", "estações")} · ~${leg.minutos} min`,
      minutos: leg.minutos,
      estacoes: leg.estacoes,
      focus: { stations: leg.estacoes, points: [] },
    });
  });

  out.push({
    kind: "alight",
    titulo: `Desça em ${names.station(last)}`,
    detalhe: `${names.line(lastLeg.linha)}${at(lastLeg.chegada)}${opts.to?.isStation ? " · destino" : ""}`,
    minutos: 0,
    focus: { stations: [last], points: [] },
  });

  if (opts.walkOut) {
    const w = opts.walkOut;
    out.push({
      kind: "walk",
      titulo: `Caminhe ${formatDistance(w.distanciaM)} (${w.minutos} min) até ${opts.to?.nome ?? "o destino"}`,
      detalhe: `Saindo da Estação ${names.station(last)} · estimativa a pé`,
      minutos: w.minutos,
      focus: { stations: [last], points: opts.to?.lngLat ? [opts.to.lngLat] : [] },
    });
  }
  return out;
}
