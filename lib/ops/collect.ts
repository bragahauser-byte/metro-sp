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
          headers: { "User-Agent": "metro-sp-conceitual/1.2 (+https://metro-sp-beta.vercel.app/sobre)", Accept: "application/rss+xml, application/xml" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseRss(await res.text())
          .slice(0, MAX_PER_SOURCE)
          .map((r) => normalizeItem(r, src, now))
          .filter((x): x is OpsItem => x !== null);
        return { items, fonte: { ...base, ok: true } };
      } catch (e) {
        return { items: [] as OpsItem[], fonte: { ...base, ok: false, erro: e instanceof Error ? e.message : "falha na leitura" } };
      }
    }),
  );
  const all = results.flatMap((r) => r.items);
  const fontes: OpsSnapshot["fontes"] = results.map((r) => r.fonte);
  return { itens: dedupeAndExpire(all, now), fontes, atualizadoEm: now.toISOString(), intervaloS: MIN_INTERVAL_S };
}
