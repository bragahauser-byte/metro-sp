// Busca unificada da origem/destino: estações (na hora, sem rede) + lugares e endereços (Photon).
// Se o provedor falhar ou demorar, as estações continuam aparecendo e a falha vira uma mensagem.
import type { Place } from "./photon.ts";
import type { LngLat } from "./walk.ts";

export type StationHit = { slug: string; nome: string; complemento?: string | null; linhas: string[] };

export type SearchResult = {
  estacoes: StationHit[];
  lugares: Place[];
  /** "indisponivel": o provedor respondeu erro; "tempo": passou do limite de espera. */
  erro: null | "indisponivel" | "tempo";
};

export type Geocoder = (q: string, near: LngLat | null, signal: AbortSignal) => Promise<Place[]>;

export const MIN_GEOCODE_CHARS = 3;
/** O servidor pode precisar do Photon (até 7 s) e do Nominatim (até 4 s). */
export const GEOCODE_TIMEOUT_MS = 12000;

export async function searchEverywhere(
  q: string,
  opts: {
    stations: (q: string) => StationHit[];
    geocode: Geocoder | null;
    near?: LngLat | null;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<SearchResult> {
  const estacoes = opts.stations(q);
  if (!opts.geocode || q.trim().length < MIN_GEOCODE_CHARS) return { estacoes, lugares: [], erro: null };
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? GEOCODE_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  try {
    const lugares = await opts.geocode(q, opts.near ?? null, signal);
    // Com lugares na lista, mostra no máximo 4 estações (elas vêm primeiro).
    return { estacoes: lugares.length ? estacoes.slice(0, 4) : estacoes, lugares, erro: null };
  } catch (e) {
    // Cancelada porque a pessoa digitou de novo: o resultado não importa mais.
    if (opts.signal?.aborted) throw e;
    return { estacoes, lugares: [], erro: timeout.aborted ? "tempo" : "indisponivel" };
  }
}
