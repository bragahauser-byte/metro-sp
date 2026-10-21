// Motor de rotas: Dijkstra sobre nós (estação, linha) com IDs estáveis (slug|linha).
// Tempos são ESTIMATIVAS: distância do traçado ÷ velocidade média por tipo de linha + parada em
// cada estação + tempo fixo de baldeação. Não há grade oficial de partidas aberta para consulta,
// então a espera pelo trem está embutida no tempo de baldeação e não é calculada à parte.
import { type ScheduleData, type Source, type Verdict, boardingVerdict, transferVerdict } from "../schedule/hours.ts";
import { formatClock, serviceTime } from "../time/sao-paulo.ts";

export type NetLine = { id: string; nome: string; tipo: "metro" | "monotrilho" | "trem"; operador: string; sequencias: string[][] };
export type NetStation = {
  slug: string;
  nome: string;
  linhas: string[];
  statusPorLinha: Record<string, string>;
  acessivel: "sim" | "limitado" | "nao" | null;
};
export type NetSegment = { linha: string; de: string; para: string; status: string; distanciaM: number };
export type NetTransfer = { estacao?: string; de: string; para: string; tipo: string };
export type NetworkData = { lines: NetLine[]; stations: NetStation[]; trechos: NetSegment[]; transferencias: NetTransfer[] };

export const SPEED_M_PER_MIN = { metro: 35000 / 60, monotrilho: 30000 / 60, trem: 45000 / 60 } as const;
export const DWELL_MIN = 0.5; // parada em cada estação
export const TRANSFER_MIN = 5; // baldeação dentro da mesma estação (caminhada + espera)
export const PASSAGE_MIN = 7; // passagem entre estações de nomes diferentes (ex.: Paulista–Consolação)

export type Leg = {
  linha: string;
  /** Estações percorridas, da de embarque à de desembarque. */
  estacoes: string[];
  minutos: number;
  /** Terminal no sentido da viagem (ex.: "Jabaquara"). */
  sentido: string | null;
  /** Outras linhas que fazem exatamente o mesmo trecho (ex.: 11 e 12 entre Brás e Tatuapé). */
  alternativas?: string[];
  partida?: Date;
  chegada?: Date;
};

export type Notice = {
  nivel: "info" | "atencao" | "bloqueio";
  texto: string;
  fonte?: Pick<Source, "titulo" | "url">;
};

export type Feasibility = "viavel" | "inviavel" | "nao-verificado" | "sem-horario";

export type RouteOption = {
  /** Assinatura estável: linhas e estações de baldeação. */
  id: string;
  legs: Leg[];
  minutos: number;
  baldeacoes: number;
  /** Trechos usados, como "linha|a|b" (a < b), para destacar no mapa. */
  trechos: string[];
  avisos: Notice[];
  partida?: Date;
  chegada?: Date;
  /** "sem-horario" quando a busca não pediu horário. */
  viabilidade: Feasibility;
  /** Estações de embarque, baldeação ou desembarque sem acessibilidade confirmada no OSM. */
  acessibilidadeNaoConfirmada: string[];
};

export type PlanRequest = {
  from: string;
  to: string;
  /** Sem horário: rota pela menor estimativa, sem checar funcionamento. */
  when?: { mode: "partir" | "chegar"; at: Date } | null;
  /** Prefere embarcar, baldear e desembarcar em estações com acessibilidade confirmada. */
  acessivel?: boolean;
  max?: number;
};

export type PlanResult =
  | { status: "ok"; routes: RouteOption[] }
  | { status: "mesma-estacao" | "desconhecida" | "sem-caminho"; routes: [] };

type Edge = { to: string; min: number; kind: "ride" | "transfer"; linha: string; from: string };

export const segmentKey = (linha: string, a: string, b: string) => (a < b ? `${linha}|${a}|${b}` : `${linha}|${b}|${a}`);
const node = (slug: string, linha: string) => `${slug}|${linha}`;
const parse = (n: string) => {
  const i = n.lastIndexOf("|");
  return { slug: n.slice(0, i), linha: n.slice(i + 1) };
};
const transferKey = (a: string, b: string) => (a < b ? `${a}>${b}` : `${b}>${a}`);

/** Fila de prioridade mínima (heap binário) para o Dijkstra. */
class MinHeap {
  private a: [number, string][] = [];
  get size() {
    return this.a.length;
  }
  push(item: [number, string]) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, string] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function createPlanner(net: NetworkData, schedule?: ScheduleData) {
  const lineById = new Map(net.lines.map((l) => [l.id, l]));
  const stationBySlug = new Map(net.stations.map((s) => [s.slug, s]));
  const operating = (slug: string, linha: string) => {
    const st = stationBySlug.get(slug)?.statusPorLinha[linha];
    return st !== undefined && st !== "em-obras" && st !== "planejada";
  };
  const name = (slug: string) => stationBySlug.get(slug)?.nome ?? slug;
  const lineName = (id: string) => lineById.get(id)?.nome ?? `Linha ${id}`;

  const graph = new Map<string, Edge[]>();
  const add = (from: string, e: Edge) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push(e);
  };
  const rideMin = new Map<string, number>();
  for (const s of net.trechos) {
    if (s.status === "em-obras" || s.status === "planejada") continue;
    const line = lineById.get(s.linha);
    if (!line) continue;
    const min = s.distanciaM / SPEED_M_PER_MIN[line.tipo] + DWELL_MIN;
    rideMin.set(segmentKey(s.linha, s.de, s.para), min);
    add(node(s.de, s.linha), { to: node(s.para, s.linha), min, kind: "ride", linha: s.linha, from: node(s.de, s.linha) });
    add(node(s.para, s.linha), { to: node(s.de, s.linha), min, kind: "ride", linha: s.linha, from: node(s.para, s.linha) });
  }
  for (const t of net.transferencias) {
    if (t.tipo === "mesma-estacao" && t.estacao) {
      if (!operating(t.estacao, t.de) || !operating(t.estacao, t.para)) continue;
      const a = node(t.estacao, t.de);
      const b = node(t.estacao, t.para);
      add(a, { to: b, min: TRANSFER_MIN, kind: "transfer", linha: t.para, from: a });
      add(b, { to: a, min: TRANSFER_MIN, kind: "transfer", linha: t.de, from: b });
    } else if (t.tipo === "passagem") {
      for (const la of stationBySlug.get(t.de)?.linhas ?? [])
        for (const lb of stationBySlug.get(t.para)?.linhas ?? []) {
          if (!operating(t.de, la) || !operating(t.para, lb)) continue;
          const a = node(t.de, la);
          const b = node(t.para, lb);
          add(a, { to: b, min: PASSAGE_MIN, kind: "transfer", linha: lb, from: a });
          add(b, { to: a, min: PASSAGE_MIN, kind: "transfer", linha: la, from: b });
        }
    }
  }

  /** Terminal da linha no sentido de `a` para `b` (vizinhos na mesma sequência). */
  function towards(linha: string, a: string, b: string): string | null {
    const line = lineById.get(linha);
    if (!line) return null;
    for (const seq of line.sequencias) {
      const i = seq.indexOf(a);
      const j = seq.indexOf(b);
      if (i < 0 || j < 0) continue;
      const last = j > i ? seq[seq.length - 1] : seq[0];
      // No ramal do "Y", o sentido de volta segue para o início da linha principal.
      const end = j < i && seq !== line.sequencias[0] ? line.sequencias[0][0] : last;
      return name(end);
    }
    return null;
  }

  type Costs = {
    rideExtra?: (linha: string) => number;
    transferExtra?: (slugFrom: string, slugTo: string) => number;
    boardExtra?: (slug: string) => number;
    banned?: Set<string>;
  };

  function dijkstra(from: string, to: string, c: Costs): string[] | null {
    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const heap = new MinHeap();
    for (const l of stationBySlug.get(from)!.linhas) {
      if (!operating(from, l) || !graph.has(node(from, l))) continue;
      const d0 = c.boardExtra?.(from) ?? 0;
      dist.set(node(from, l), d0);
      heap.push([d0, node(from, l)]);
    }
    const done = new Set<string>();
    while (heap.size) {
      const [d, u] = heap.pop();
      if (done.has(u)) continue;
      done.add(u);
      if (parse(u).slug === to) {
        const path = [u];
        while (prev.has(path[0])) path.unshift(prev.get(path[0])!);
        return path;
      }
      for (const e of graph.get(u) ?? []) {
        let w = e.min;
        if (e.kind === "ride") w += (c.rideExtra?.(e.linha) ?? 0) * e.min;
        else {
          const a = parse(e.from).slug;
          const b = parse(e.to).slug;
          if (c.banned?.has(`${transferKey(e.from, e.to)}`)) continue;
          w += (c.transferExtra?.(a, b) ?? 0) + (c.boardExtra?.(b) ?? 0);
        }
        const nd = d + w;
        if (nd < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, nd);
          prev.set(e.to, u);
          heap.push([nd, e.to]);
        }
      }
    }
    return null;
  }

  /** Caminho de nós → trechos por linha, com tempos reais (sem as penalidades da busca). */
  function toRoute(path: string[]): RouteOption {
    const legs: Leg[] = [];
    const trechos: string[] = [];
    const transferNodes: [string, string][] = [];
    for (let i = 0; i < path.length; i++) {
      const { slug, linha } = parse(path[i]);
      const last = legs[legs.length - 1];
      if (last && last.linha === linha && last.estacoes[last.estacoes.length - 1] !== slug) {
        trechos.push(segmentKey(linha, last.estacoes[last.estacoes.length - 1], slug));
        last.estacoes.push(slug);
      } else if (!last || last.linha !== linha || last.estacoes[last.estacoes.length - 1] !== slug) {
        if (i > 0) transferNodes.push([path[i - 1], path[i]]);
        legs.push({ linha, estacoes: [slug], minutos: 0, sentido: null });
      }
    }
    // Trechos de uma estação só (nó de passagem) não são viagens.
    const rides = legs.filter((l) => l.estacoes.length > 1);
    let total = 0;
    for (const [i, leg] of rides.entries()) {
      let min = 0;
      for (let k = 1; k < leg.estacoes.length; k++) min += rideMin.get(segmentKey(leg.linha, leg.estacoes[k - 1], leg.estacoes[k])) ?? 0;
      leg.minutos = Math.max(1, Math.round(min));
      leg.sentido = towards(leg.linha, leg.estacoes[0], leg.estacoes[1]);
      total += leg.minutos; // soma os minutos já arredondados, para bater com os horários de cada trecho
      if (i > 0) {
        const prevEnd = rides[i - 1].estacoes.at(-1)!;
        total += prevEnd === leg.estacoes[0] ? TRANSFER_MIN : PASSAGE_MIN;
      }
    }
    const id = rides.map((l) => `${l.linha}:${l.estacoes[0]}`).join(">") + `>${rides.at(-1)?.estacoes.at(-1)}`;
    const stops = new Set<string>([rides[0].estacoes[0], rides.at(-1)!.estacoes.at(-1)!]);
    for (const l of rides) {
      stops.add(l.estacoes[0]);
      stops.add(l.estacoes.at(-1)!);
    }
    return {
      id,
      legs: rides,
      minutos: Math.round(total),
      baldeacoes: Math.max(0, rides.length - 1),
      trechos,
      avisos: [],
      viabilidade: "sem-horario",
      acessibilidadeNaoConfirmada: [...stops].filter((s) => stationBySlug.get(s)?.acessivel !== "sim"),
    };
  }

  /** Avisos fixos por linha (operação assistida/transitória), tirados das observações da fonte. */
  function lineNotices(r: RouteOption): Notice[] {
    const out: Notice[] = [];
    for (const id of new Set(r.legs.map((l) => l.linha))) {
      const h = schedule?.linhas[id];
      if (h?.observacao) out.push({ nivel: "info", texto: `${lineName(id)}: ${h.observacao}`, fonte: schedule!.fontes[h.fonte] });
    }
    const leg17 = r.legs.find((l) => l.linha === "17");
    if (leg17 && leg17.estacoes.includes("washington-luis") && leg17.estacoes.length > 2) {
      out.push({ nivel: "info", texto: "Para Washington Luís, troque de trem em Brooklin Paulista (operação transitória do ramal)." });
    }
    return out;
  }

  /** Confere cada embarque e cada baldeação contra os horários; preenche partida/chegada. */
  function checkTimes(r: RouteOption, depart: Date): { blocked: [string, string] | null } {
    if (!schedule) return { blocked: null };
    let t = depart.getTime();
    const notices: Notice[] = [];
    let worst: Feasibility = "viavel";
    let blocked: [string, string] | null = null;
    const note = (v: Verdict, prefix = "") => {
      if (v.status === "aberto") return;
      const nivel = v.status === "fechado" ? "bloqueio" : "atencao";
      const texto = prefix + v.motivo;
      if (notices.some((n) => n.texto === texto)) return;
      notices.push({ nivel, texto, fonte: v.fonte ? { titulo: v.fonte.titulo, url: v.fonte.url } : undefined });
      if (v.status === "fechado") worst = "inviavel";
      else if (worst === "viavel") worst = "nao-verificado";
    };
    r.legs.forEach((leg, i) => {
      if (i > 0) {
        const prev = r.legs[i - 1];
        const a = prev.estacoes.at(-1)!;
        const b = leg.estacoes[0];
        t += (a === b ? TRANSFER_MIN : PASSAGE_MIN) * 60000;
        const v = transferVerdict(schedule, [a, b], prev.linha, leg.linha, serviceTime(new Date(t)), a === b ? name(a) : `${name(a)}–${name(b)}`);
        note(v);
        if (v.status === "fechado" && !blocked) blocked = [node(a, prev.linha), node(b, leg.linha)];
      }
      const at = new Date(t);
      leg.partida = at;
      note(boardingVerdict(schedule, leg.linha, leg.estacoes[0], serviceTime(at), lineName(leg.linha)), `${name(leg.estacoes[0])} às ${formatClock(serviceTime(at).min)}: `);
      t += leg.minutos * 60000;
      leg.chegada = new Date(t);
    });
    r.partida = depart;
    r.chegada = new Date(t);
    r.viabilidade = worst;
    r.avisos = [...notices, ...r.avisos];
    return { blocked };
  }

  function plan(req: PlanRequest): PlanResult {
    const { from, to } = req;
    if (!stationBySlug.has(from) || !stationBySlug.has(to)) return { status: "desconhecida", routes: [] };
    if (from === to) return { status: "mesma-estacao", routes: [] };
    const max = req.max ?? 3;
    const accessPenalty = (slug: string) => (req.acessivel && stationBySlug.get(slug)?.acessivel !== "sim" ? 20 : 0);
    const banned = new Set<string>();

    const found = new Map<string, RouteOption>();
    const tryCosts = (c: Costs) => {
      const p = dijkstra(from, to, { ...c, banned, boardExtra: accessPenalty });
      if (!p) return null;
      const r = toRoute(p);
      if (!r.legs.length) return null;
      if (!found.has(r.id)) found.set(r.id, r);
      return r;
    };

    const best = tryCosts({});
    if (!best) return { status: "sem-caminho", routes: [] };
    // Alternativas: menos baldeações; evitando cada linha da melhor rota.
    tryCosts({ transferExtra: () => 12 });
    for (const l of new Set(best.legs.map((x) => x.linha))) tryCosts({ rideExtra: (linha) => (linha === l ? 3 : 0) });

    let routes = [...found.values()];

    if (req.when) {
      // Partida: na hora pedida. Chegada: volta a duração estimada a partir do horário-limite.
      const departOf = (r: RouteOption) => (req.when!.mode === "partir" ? req.when!.at : new Date(req.when!.at.getTime() - r.minutos * 60000));
      // Se uma baldeação está fechada no horário, tenta de novo sem ela (até 3 vezes).
      for (let k = 0; k < 3; k++) {
        let changed = false;
        for (const r of routes) {
          const { blocked } = checkTimes(r, departOf(r));
          if (blocked) {
            const key = transferKey(blocked[0], blocked[1]);
            if (!banned.has(key)) {
              banned.add(key);
              changed = true;
            }
          }
        }
        if (!changed) break;
        const before = found.size;
        tryCosts({});
        tryCosts({ transferExtra: () => 12 });
        if (found.size === before) break;
        routes = [...found.values()];
        for (const r of routes) {
          r.avisos = [];
          r.viabilidade = "sem-horario";
        }
      }
      for (const r of routes) {
        r.avisos = [];
        checkTimes(r, departOf(r));
      }
    }
    for (const r of routes) r.avisos.push(...lineNotices(r));

    // "Não verificado" não é "impossível": só as inviáveis vão para o fim da lista.
    const rank: Record<Feasibility, number> = { viavel: 0, "sem-horario": 0, "nao-verificado": 0, inviavel: 1 };
    // A referência de "muito mais longa" é a mais rápida que dá para fazer no horário pedido.
    const usable = routes.filter((r) => r.viabilidade !== "inviavel");
    const fastest = Math.min(...(usable.length ? usable : routes).map((r) => r.minutos));
    routes = routes
      // Alternativas muito mais longas não ajudam ninguém.
      .filter((r) => r.minutos <= fastest * 1.6 + 10 || r === best || r.viabilidade === "inviavel")
      .sort(
        (a, b) =>
          rank[a.viabilidade] - rank[b.viabilidade] ||
          (req.acessivel ? a.acessibilidadeNaoConfirmada.length - b.acessibilidadeNaoConfirmada.length : 0) ||
          a.minutos - b.minutos ||
          a.baldeacoes - b.baldeacoes,
      );
    // Rotas que só trocam uma linha por outra paralela no mesmo trecho viram uma só ("ou Linha 11").
    const sig = (r: RouteOption) => r.legs.map((l) => `${l.estacoes[0]}>${l.estacoes.at(-1)}`).join("|");
    const merged = new Map<string, RouteOption>();
    for (const r of routes) {
      const m = merged.get(sig(r));
      if (!m) {
        merged.set(sig(r), r);
        continue;
      }
      r.legs.forEach((l, i) => {
        const alt = (m.legs[i].alternativas ??= []);
        if (l.linha !== m.legs[i].linha && !alt.includes(l.linha)) alt.push(l.linha);
      });
    }
    routes = [...merged.values()].slice(0, max);
    return { status: "ok", routes };
  }

  return { plan, stationBySlug, lineById };
}
