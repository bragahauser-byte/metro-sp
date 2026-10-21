// Rota de porta a porta: lugar → estação → rede → estação → lugar. Testa as combinações das
// estações candidatas de cada ponta e fica com a de menor tempo total (a pé + rede + a pé).
import { type Candidate, type StationPoint, stationCandidates } from "./nearest.ts";
import { type LngLat, type Walk, estimateWalk } from "./walk.ts";

export type Endpoint = { kind: "station"; slug: string } | { kind: "place"; lngLat: LngLat; nome: string };

export type PlaceRoute<R> = {
  status: "ok";
  board: string;
  alight: string;
  /** Caminhada até a estação de embarque (null se a origem já é uma estação). */
  walkIn: Walk | null;
  walkOut: Walk | null;
  route: R;
  minutos: number;
};

export type PlaceRouteResult<R> =
  | PlaceRoute<R>
  | { status: "a-pe"; walk: Walk }
  | { status: "mesmo-lugar" }
  | { status: "fora-da-area"; lado: "origem" | "destino" | "ambos" }
  | { status: "sem-caminho" };

/** Até onde ir a pé é sugerido em vez do trem, quando for mais rápido. */
export const MAX_WALK_ONLY_M = 3000;
/** Para comparar com ir a pé: entrar na estação e esperar o primeiro trem (o motor não conta essa espera). */
export const BOARDING_MIN = 5;

function access(e: Endpoint, stations: StationPoint[]): Candidate[] {
  if (e.kind === "station") return [{ slug: e.slug, walk: { retaM: 0, distanciaM: 0, minutos: 0 } }];
  return stationCandidates(e.lngLat, stations).candidates;
}

function pointOf(e: Endpoint, stations: StationPoint[]): LngLat | null {
  if (e.kind === "place") return e.lngLat;
  return stations.find((s) => s.slug === e.slug)?.geo ?? null;
}

export function planPlaceRoute<R extends { minutos: number }>(
  origin: Endpoint,
  dest: Endpoint,
  deps: { stations: StationPoint[]; plan: (from: string, to: string) => R | null },
): PlaceRouteResult<R> {
  if (origin.kind === "station" && dest.kind === "station" && origin.slug === dest.slug) return { status: "mesmo-lugar" };
  const a = pointOf(origin, deps.stations);
  const b = pointOf(dest, deps.stations);
  if (a && b && estimateWalk(a, b).retaM < 50) return { status: "mesmo-lugar" };

  const ins = access(origin, deps.stations);
  const outs = access(dest, deps.stations);
  if (!ins.length || !outs.length) {
    return { status: "fora-da-area", lado: !ins.length && !outs.length ? "ambos" : !ins.length ? "origem" : "destino" };
  }

  let best: PlaceRoute<R> | null = null;
  for (const i of ins) {
    for (const o of outs) {
      if (i.slug === o.slug) continue;
      const route = deps.plan(i.slug, o.slug);
      if (!route) continue;
      const minutos = i.walk.minutos + route.minutos + o.walk.minutos;
      if (!best || minutos < best.minutos) {
        best = {
          status: "ok",
          board: i.slug,
          alight: o.slug,
          walkIn: origin.kind === "place" ? i.walk : null,
          walkOut: dest.kind === "place" ? o.walk : null,
          route,
          minutos,
        };
      }
    }
  }

  // Perto o bastante: ir a pé direto pode ser mais rápido que ir até a estação e esperar o trem.
  // (Só quando uma das pontas é um lugar; entre duas estações quem pediu quer o trem.)
  const direct = a && b && (origin.kind === "place" || dest.kind === "place") ? estimateWalk(a, b) : null;
  if (direct && direct.distanciaM <= MAX_WALK_ONLY_M && (!best || direct.minutos <= best.minutos + BOARDING_MIN)) {
    return { status: "a-pe", walk: direct };
  }
  return best ?? { status: "sem-caminho" };
}
