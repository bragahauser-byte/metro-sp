// Planejador de rota: Dijkstra sobre (estação, linha), com penalidade de baldeação.
// Os tempos são ESTIMATIVAS (não há horário oficial aberto): distância do traçado real dividida por
// uma velocidade média por tipo de linha, mais o tempo parado em cada estação.
import { lineById, segments, stationBySlug, transfers } from "@/components/map/network";

const SPEED_M_PER_MIN = { metro: 35000 / 60, monotrilho: 30000 / 60, trem: 45000 / 60 } as const;
const DWELL_MIN = 0.5; // parada em cada estação
const TRANSFER_MIN = 5; // baldeação dentro da mesma estação (caminhada + espera)
const PASSAGE_MIN = 7; // passagem entre estações de nomes diferentes (ex.: Paulista–Consolação)

type Edge = { to: string; min: number; kind: "ride" | "transfer"; linha?: string };
const node = (slug: string, linha: string) => `${slug}|${linha}`;
const parse = (n: string) => {
  const [slug, linha] = n.split("|");
  return { slug, linha };
};

const graph = new Map<string, Edge[]>();
const add = (from: string, e: Edge) => {
  if (!graph.has(from)) graph.set(from, []);
  graph.get(from)!.push(e);
};

for (const s of segments) {
  if (s.status === "em-obras") continue;
  const line = lineById.get(s.linha)!;
  const min = s.distanciaM / SPEED_M_PER_MIN[line.tipo] + DWELL_MIN;
  add(node(s.de, s.linha), { to: node(s.para, s.linha), min, kind: "ride", linha: s.linha });
  add(node(s.para, s.linha), { to: node(s.de, s.linha), min, kind: "ride", linha: s.linha });
}
const operating = (slug: string, linha: string) => stationBySlug.get(slug)?.statusPorLinha[linha] !== "em-obras";
for (const t of transfers) {
  if (t.tipo === "mesma-estacao" && t.estacao) {
    if (!operating(t.estacao, t.de) || !operating(t.estacao, t.para)) continue;
    add(node(t.estacao, t.de), { to: node(t.estacao, t.para), min: TRANSFER_MIN, kind: "transfer" });
    add(node(t.estacao, t.para), { to: node(t.estacao, t.de), min: TRANSFER_MIN, kind: "transfer" });
  } else if (t.tipo === "passagem") {
    for (const la of stationBySlug.get(t.de)?.linhas ?? [])
      for (const lb of stationBySlug.get(t.para)?.linhas ?? []) {
        add(node(t.de, la), { to: node(t.para, lb), min: PASSAGE_MIN, kind: "transfer" });
        add(node(t.para, lb), { to: node(t.de, la), min: PASSAGE_MIN, kind: "transfer" });
      }
  }
}

export type Leg = {
  linha: string;
  /** Estações percorridas, da de embarque à de desembarque. */
  estacoes: string[];
  minutos: number;
  /** Terminal no sentido da viagem (ex.: "sentido Jabaquara"). */
  sentido: string | null;
};

export type Route = {
  legs: Leg[];
  minutos: number;
  baldeacoes: number;
  /** Trechos usados, como "linha|a|b" (a < b), para destacar no mapa. */
  trechos: string[];
  avisos: string[];
};

export const segmentKey = (linha: string, a: string, b: string) => (a < b ? `${linha}|${a}|${b}` : `${linha}|${b}|${a}`);

/** Terminal da linha no sentido de `a` para `b` (vizinhos na mesma sequência). */
function towards(linha: string, a: string, b: string): string | null {
  const line = lineById.get(linha);
  if (!line) return null;
  for (const seq of line.sequencias) {
    const i = seq.indexOf(a), j = seq.indexOf(b);
    if (i < 0 || j < 0) continue;
    const last = j > i ? seq[seq.length - 1] : seq[0];
    // No ramal do "Y", o sentido de volta segue para o início da linha principal.
    const name = j < i && seq !== line.sequencias[0] ? line.sequencias[0][0] : last;
    return stationBySlug.get(name)?.nome ?? null;
  }
  return null;
}

export function planRoute(from: string, to: string): Route | null {
  if (from === to || !stationBySlug.has(from) || !stationBySlug.has(to)) return null;
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const queue: [number, string][] = [];
  for (const l of stationBySlug.get(from)!.linhas) {
    if (!operating(from, l)) continue;
    dist.set(node(from, l), 0);
    queue.push([0, node(from, l)]);
  }
  const done = new Set<string>();
  let end: string | null = null;
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [d, u] = queue.shift()!;
    if (done.has(u)) continue;
    done.add(u);
    if (parse(u).slug === to) {
      end = u;
      break;
    }
    for (const e of graph.get(u) ?? []) {
      const nd = d + e.min;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
        queue.push([nd, e.to]);
      }
    }
  }
  if (!end) return null;

  const path = [end];
  while (prev.has(path[0])) path.unshift(prev.get(path[0])!);

  // Agrupa em trechos por linha (uma baldeação muda a linha).
  const legs: Leg[] = [];
  const trechos: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const { slug, linha } = parse(path[i]);
    const last = legs[legs.length - 1];
    if (last && last.linha === linha && last.estacoes[last.estacoes.length - 1] !== slug) {
      trechos.push(segmentKey(linha, last.estacoes[last.estacoes.length - 1], slug));
      last.estacoes.push(slug);
    } else if (!last || last.linha !== linha) {
      legs.push({ linha, estacoes: [slug], minutos: 0, sentido: null });
    }
  }
  const rides = legs.filter((l) => l.estacoes.length > 1);
  for (const leg of rides) {
    let min = 0;
    for (let i = 1; i < leg.estacoes.length; i++) {
      const s = segments.find((x) => x.linha === leg.linha && segmentKey(x.linha, x.de, x.para) === segmentKey(leg.linha, leg.estacoes[i - 1], leg.estacoes[i]));
      if (s) min += s.distanciaM / SPEED_M_PER_MIN[lineById.get(leg.linha)!.tipo] + DWELL_MIN;
    }
    leg.minutos = Math.max(1, Math.round(min));
    leg.sentido = towards(leg.linha, leg.estacoes[0], leg.estacoes[1]);
  }

  const avisos: string[] = [];
  if (rides.some((l) => l.linha === "17")) {
    avisos.push("Linha 17-Ouro em operação transitória: dias úteis, das 9h às 16h, sem cobrança.");
    const leg17 = rides.find((l) => l.linha === "17")!;
    const viaBranch = leg17.estacoes.includes("washington-luis") && leg17.estacoes.length > 2;
    if (viaBranch) avisos.push("Para Washington Luís, troque de trem em Brooklin Paulista (operação transitória).");
  }
  if (rides.some((l) => l.linha === "6")) avisos.push("Linha 6-Laranja em operação assistida (João Paulo I – Perdizes).");

  return {
    legs: rides,
    minutos: Math.round(dist.get(end)!),
    baldeacoes: Math.max(0, rides.length - 1),
    trechos,
    avisos,
  };
}
