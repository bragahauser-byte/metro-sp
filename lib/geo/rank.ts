// Ordem dos lugares na busca: primeiro os que batem com o texto, depois os mais perto do ponto de
// referência (sua localização, só no navegador, ou o centro do mapa). Junta Photon e Nominatim sem
// repetir o mesmo lugar.
import type { Place } from "./photon.ts";
import { normalizeText } from "./aliases.ts";
import { type LngLat, haversine } from "./walk.ts";

/**
 * 4 = nome igual ao texto; 3 = nome começa com o texto; 2 = todas as palavras aparecem no nome ou
 * no endereço; 1 = alguma; 0 = nenhuma.
 */
export function matchScore(p: Place, q: string): number {
  const nq = normalizeText(q);
  const name = normalizeText(p.nome);
  if (nq && name === nq) return 4;
  if (nq.length >= 3 && name.startsWith(nq)) return 3;
  const words = normalizeText(q)
    .split(/[\s,.-]+/)
    .filter((w) => w.length >= 2 && !/^(rua|r|av|avenida|de|da|do|dos|das|e)$/.test(w));
  if (!words.length) return 0;
  const hay = normalizeText(`${p.nome} ${p.detalhe}`);
  const hits = words.filter((w) => hay.includes(w)).length;
  return hits === words.length ? 2 : hits > 0 ? 1 : 0;
}

export function rankPlaces(places: Place[], q: string, ref: LngLat | null): Place[] {
  const scored = places.map((p, i) => ({ p, i, s: matchScore(p, q), d: ref ? haversine(ref, p.lngLat) : 0 }));
  scored.sort((a, b) => b.s - a.s || (ref ? a.d - b.d : 0) || a.i - b.i);
  return scored.map((x) => x.p);
}

/** Mesmo lugar dos dois provedores: nome igual e a menos de 150 m. */
export function mergePlaces(a: Place[], b: Place[]): Place[] {
  const out = [...a];
  for (const p of b) {
    const dup = out.some((o) => normalizeText(o.nome) === normalizeText(p.nome) && haversine(o.lngLat, p.lngLat) < 150);
    if (!dup) out.push(p);
  }
  return out;
}

/** O Photon achou algo que bate de verdade com o texto? Se não, vale perguntar ao Nominatim. */
export const isWeak = (places: Place[], q: string) => !places.some((p) => matchScore(p, q) >= 2);
