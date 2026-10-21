// Estações candidatas perto de um ponto: as mais próximas dentro de um raio que cresce só se
// não houver nenhuma (2 km → 3,5 km → 5 km). Além disso, o lugar é tratado como longe demais.
import { type LngLat, type Walk, estimateWalk } from "./walk.ts";

export type StationPoint = { slug: string; geo: LngLat; status?: string };
export type Candidate = { slug: string; walk: Walk };

export const SEARCH_RADII_M: readonly number[] = [2000, 3500, 5000];

const usable = (s: StationPoint) => !s.status || s.status === "operando" || s.status === "operacao-assistida";

export function stationCandidates(
  point: LngLat,
  stations: StationPoint[],
  { n = 3, radii = SEARCH_RADII_M }: { n?: number; radii?: readonly number[] } = {},
): { candidates: Candidate[]; raioM: number | null } {
  const all = stations
    .filter(usable)
    .map((s) => ({ slug: s.slug, walk: estimateWalk(point, s.geo) }))
    .sort((a, b) => a.walk.retaM - b.walk.retaM);
  for (const r of radii) {
    const inside = all.filter((c) => c.walk.retaM <= r);
    if (inside.length) return { candidates: inside.slice(0, n), raioM: r };
  }
  return { candidates: [], raioM: null };
}

/** Acima disto, a origem ou o destino é "longe da rede": avisamos, mas mostramos a estação mais próxima. */
export const FAR_FROM_NETWORK_M = 3000;

/** Estação em operação mais próxima, e se ela fica longe demais (mais de 3 km em linha reta). */
export function nearestToNetwork(point: LngLat, stations: StationPoint[]): { slug: string; walk: Walk; longe: boolean } | null {
  let best: Candidate | null = null;
  for (const s of stations) {
    if (!usable(s)) continue;
    const walk = estimateWalk(point, s.geo);
    if (!best || walk.retaM < best.walk.retaM) best = { slug: s.slug, walk };
  }
  return best ? { ...best, longe: best.walk.retaM > FAR_FROM_NETWORK_M } : null;
}
