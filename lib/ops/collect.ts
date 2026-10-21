// Coleta: lê cada fonte com tempo-limite, normaliza, junta e tira repetidos. Uma fonte que falha não
// derruba as outras — o erro aparece no resultado. Idempotente: rodar duas vezes dá o mesmo conjunto.
import { dedupeAndExpire, normalizeItem, parseRss } from "./normalize.ts";
import type { OpsItem, OpsSnapshot, OpsSource } from "./types.ts";

export const MIN_INTERVAL_S = 30 * 60;
const TIMEOUT_MS = 8000;
const MAX_PER_SOURCE = 20;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function collect(sources: OpsSource[], now: Date, fetcher: Fetcher = fetch): Promise<OpsSnapshot> {
  // Resultados na ordem das fontes (não na ordem de chegada), para a coleta ser determinística.
  const results = await Promise.all(
    sources.map(async (src) => {
      const base = { id: src.id, nome: src.nome, site: src.site, coletadoEm: now.toISOString() };
      try {
        const res = await fetcher(src.feed, {
          headers: { "User-Agent": "metro-sp-conceitual/1.3 (+https://metro-sp-beta.vercel.app/sobre)", Accept: "application/rss+xml, application/xml" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseRss(await res.text())
          .slice(0, MAX_PER_SOURCE)
          .map((r) => normalizeItem(r, src, now))
          .filter((x): x is OpsItem => x !== null);
        return { items, fonte: { ...base, ok: true, ultimaColetaOkEm: now.toISOString() } };
      } catch (e) {
        return { items: [] as OpsItem[], fonte: { ...base, ok: false, erro: e instanceof Error ? e.message : "falha na leitura", ultimaColetaOkEm: null } };
      }
    }),
  );
  const all = results.flatMap((r) => r.items);
  const fontes: OpsSnapshot["fontes"] = results.map((r) => r.fonte);
  return { itens: dedupeAndExpire(all, now), fontes, atualizadoEm: now.toISOString(), intervaloS: MIN_INTERVAL_S };
}

/**
 * Junta a coleta nova com a última boa: se uma fonte falhou agora, os itens dela da coleta anterior
 * continuam (marcados como preservados, com a data da última leitura boa) até expirarem.
 */
export function keepLastGood(current: OpsSnapshot, previous: OpsSnapshot | null, now: Date): OpsSnapshot {
  if (!previous) return current;
  const kept: OpsItem[] = [];
  const fontes = current.fontes.map((f) => {
    if (f.ok) return f;
    const before = previous.fontes.find((p) => p.id === f.id);
    const items = previous.itens.filter((i) => i.fonte.id === f.id);
    kept.push(...items);
    return { ...f, ultimaColetaOkEm: before?.ultimaColetaOkEm ?? null, preservado: items.length > 0 };
  });
  return { ...current, itens: dedupeAndExpire([...current.itens, ...kept], now), fontes };
}
