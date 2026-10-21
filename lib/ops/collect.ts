// Coleta: lê cada fonte com tempo-limite, normaliza, junta e tira repetidos. Uma fonte que falha não
// derruba as outras — o erro aparece no resultado. Idempotente: rodar duas vezes dá o mesmo conjunto.
import { dedupeAndExpire, normalizeItem, parseRss } from "./normalize.ts";
import type { StatusSource } from "./sources.ts";
import { type LineStatus, parseArtesp, parseCptm, sortStatuses } from "./status.ts";
import type { OpsItem, OpsSnapshot, OpsSource, SourceState } from "./types.ts";

/** De 15 em 15 minutos: comunicados novos e situação das linhas. */
export const MIN_INTERVAL_S = 15 * 60;
/** Situação de linha mais velha que isto não é mostrada como "agora", mesmo preservada. */
export const STATUS_MAX_AGE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const MAX_PER_SOURCE = 20;
const UA = "metro-sp-conceitual/1.5 (+https://metro-sp-beta.vercel.app; github.com/bragahauser-byte/metro-sp)";

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type Env = Record<string, string | undefined>;

const PARSERS: Record<string, (json: unknown) => LineStatus[]> = { cptm: parseCptm, artesp: parseArtesp };

type StatusRead = { linhas: LineStatus[]; fonte: SourceState };
/** Última leitura real de cada fonte com intervalo mínimo (ex.: ARTESP), para não passar do limite. */
const lastRead = new Map<string, { at: number; result: StatusRead }>();
export const resetStatusThrottle = () => lastRead.clear();

async function readStatus(src: StatusSource, now: Date, fetcher: Fetcher, env: Env): Promise<StatusRead> {
  const base = { id: src.id, nome: src.nome, site: src.site, coletadoEm: now.toISOString() };
  const key = src.chave ? env[src.chave] : undefined;
  if (src.chave && !key) {
    return { linhas: [] as LineStatus[], fonte: { ...base, ok: false, desligada: true, erro: `sem ${src.chave}`, ultimaColetaOkEm: null } };
  }
  if (src.minIntervaloS) {
    const prev = lastRead.get(src.id);
    if (prev && now.getTime() - prev.at < src.minIntervaloS * 1000) return prev.result;
    const result = await readStatusNow(src, base, now, fetcher, key);
    lastRead.set(src.id, { at: now.getTime(), result });
    return result;
  }
  return readStatusNow(src, base, now, fetcher, key);
}

const ERRORS: Record<number, string> = { 401: "chave recusada (401)", 403: "IP fora da lista liberada (403)", 429: "limite de requisições (429)" };

async function readStatusNow(
  src: StatusSource,
  base: Pick<SourceState, "id" | "nome" | "site" | "coletadoEm">,
  now: Date,
  fetcher: Fetcher,
  key: string | undefined,
): Promise<StatusRead> {
  try {
    const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/json" };
    if (key) headers.Authorization = `Api-Key ${key}`;
    const res = await fetcher(src.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(ERRORS[res.status] ?? `HTTP ${res.status}`);
    const linhas = (PARSERS[src.id]?.(await res.json()) ?? []).filter((l) => src.linhas.includes(l.linha));
    if (!linhas.length) throw new Error("resposta sem linhas");
    return { linhas, fonte: { ...base, ok: true, ultimaColetaOkEm: now.toISOString() } };
  } catch (e) {
    const erro = e instanceof Error ? (e.name === "TimeoutError" ? "tempo esgotado" : e.message) : "falha na leitura";
    return { linhas: [] as LineStatus[], fonte: { ...base, ok: false, erro, ultimaColetaOkEm: null } };
  }
}

export async function collect(
  sources: OpsSource[],
  now: Date,
  fetcher: Fetcher = fetch,
  statusSources: StatusSource[] = [],
  env: Env = {},
): Promise<OpsSnapshot> {
  // Resultados na ordem das fontes (não na ordem de chegada), para a coleta ser determinística.
  const [results, statuses] = await Promise.all([
    Promise.all(
      sources.map(async (src) => {
        const base = { id: src.id, nome: src.nome, site: src.site, coletadoEm: now.toISOString() };
        try {
          const res = await fetcher(src.feed, {
            headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const items = parseRss(await res.text())
            .slice(0, MAX_PER_SOURCE)
            .map((r) => normalizeItem(r, src, now))
            .filter((x): x is OpsItem => x !== null);
          return { items, fonte: { ...base, ok: true, ultimaColetaOkEm: now.toISOString() } as SourceState };
        } catch (e) {
          return { items: [] as OpsItem[], fonte: { ...base, ok: false, erro: e instanceof Error ? e.message : "falha na leitura", ultimaColetaOkEm: null } as SourceState };
        }
      }),
    ),
    Promise.all(statusSources.map((s) => readStatus(s, now, fetcher, env))),
  ]);
  return {
    itens: dedupeAndExpire(
      results.flatMap((r) => r.items),
      now,
    ),
    fontes: results.map((r) => r.fonte),
    situacao: { linhas: sortStatuses(statuses.flatMap((s) => s.linhas)), fontes: statuses.map((s) => s.fonte) },
    atualizadoEm: now.toISOString(),
    intervaloS: MIN_INTERVAL_S,
  };
}

/** Alguma fonte (de comunicado ou de situação) respondeu? Se nenhuma, a coleta não vale como "boa". */
export const anyOk = (s: OpsSnapshot) => s.fontes.some((f) => f.ok) || s.situacao.fontes.some((f) => f.ok);

/**
 * Junta a coleta nova com a última boa: se uma fonte falhou agora, os itens dela da coleta anterior
 * continuam (marcados como preservados, com a data da última leitura boa) até expirarem. A situação
 * de uma linha só é preservada por até STATUS_MAX_AGE_MS — depois disso some, em vez de envelhecer.
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

  const keptStatus: LineStatus[] = [];
  const prevSit = previous.situacao ?? { linhas: [], fontes: [] };
  const statusFontes = current.situacao.fontes.map((f) => {
    if (f.ok || f.desligada) return f;
    const before = prevSit.fontes.find((p) => p.id === f.id);
    const fresh = before?.ultimaColetaOkEm && now.getTime() - new Date(before.ultimaColetaOkEm).getTime() <= STATUS_MAX_AGE_MS;
    const linhas = fresh ? prevSit.linhas.filter((l) => l.fonte.id === f.id).map((l) => ({ ...l, preservado: true })) : [];
    keptStatus.push(...linhas);
    return { ...f, ultimaColetaOkEm: before?.ultimaColetaOkEm ?? null, preservado: linhas.length > 0 };
  });

  return {
    ...current,
    itens: dedupeAndExpire([...current.itens, ...kept], now),
    fontes,
    situacao: { linhas: sortStatuses([...current.situacao.linhas, ...keptStatus]), fontes: statusFontes },
  };
}
