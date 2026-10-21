// Leitura de RSS, normalização, classificação, deduplicação e validade dos comunicados.
// Funções puras: recebem texto e datas, devolvem dados — testáveis sem rede.
import type { OpsItem, OpsSource } from "./types.ts";

export type RawItem = { title: string; link: string; pubDate: string; description: string; categories: string[] };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    // HTML escapado dentro do feed (&lt;img…&gt;) só vira tag depois de decodificar: remove de novo.
    .replace(/<[^>]*>?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

/** RSS 2.0 → itens crus. Sem dependências: o formato é simples e controlado pela fonte. */
export function parseRss(xml: string): RawItem[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
  return items.map((it) => ({
    title: decode(tag(it, "title")),
    link: decode(tag(it, "link")),
    pubDate: decode(tag(it, "pubDate")),
    description: decode(tag(it, "description")),
    categories: (it.match(/<category[^>]*>[\s\S]*?<\/category>/g) ?? []).map((c) => decode(c)),
  }));
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Palavras que indicam assunto de operação. Comunicado institucional (licitação, evento, campanha) fica de fora.
const OPERATIONAL =
  /\b(operacao|opera|funcionamento|horario|interdi\w*|fechad\w*|fechamento|paralisa\w*|greve|obras?|manutenc\w*|intervalo|velocidade reduzida|falha|ocorrencia|alterac\w*|esquema especial|24 horas|gratuit\w*|feriado|reabert\w*|desvio|onibus paese|paese)\b/;

const LINE_NAMES: Record<string, string> = {
  azul: "1", verde: "2", vermelha: "3", amarela: "4", lilas: "5", laranja: "6", rubi: "7", diamante: "8",
  esmeralda: "9", turquesa: "10", coral: "11", safira: "12", jade: "13", prata: "15", ouro: "17",
};

/** Linhas citadas no texto ("Linha 4-Amarela", "linhas 1, 2 e 3", "Linha Verde"). */
export function mentionedLines(text: string): string[] {
  const t = plain(text);
  const found = new Set<string>();
  for (const m of t.matchAll(/\blinhas?\s+((?:\d{1,2}(?:\s*-\s*[a-z]+)?(?:\s*,\s*|\s+e\s+)?)+)/g)) {
    for (const n of m[1].match(/\d{1,2}/g) ?? []) found.add(String(Number(n)));
  }
  for (const m of t.matchAll(/\blinha\s+(azul|verde|vermelha|amarela|lilas|laranja|rubi|diamante|esmeralda|turquesa|coral|safira|jade|prata|ouro)\b/g)) {
    found.add(LINE_NAMES[m[1]]);
  }
  return [...found].filter((l) => Object.values(LINE_NAMES).includes(l)).sort((a, b) => Number(a) - Number(b));
}

/** Identificador estável (FNV-1a de 32 bits sobre o link). */
export function stableId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Por quanto tempo um comunicado continua aparecendo. Operacional: 10 dias; outros: 3. */
export const TTL_DAYS = { operacional: 10, outros: 3 } as const;

export function normalizeItem(raw: RawItem, src: OpsSource, now: Date): OpsItem | null {
  const published = new Date(raw.pubDate);
  if (!raw.title || !raw.link || Number.isNaN(published.getTime())) return null;
  if (!/^https:\/\//.test(raw.link)) return null;
  const text = `${raw.title} ${raw.description}`;
  const operacional = OPERATIONAL.test(plain(text));
  // Só linhas da própria operadora: um comunicado do Metrô sobre a Linha 4 é citação, não aviso dela.
  const linhas = mentionedLines(text).filter((l) => src.linhas.includes(l));
  const ttl = operacional ? TTL_DAYS.operacional : TTL_DAYS.outros;
  const resumo = raw.description.length > 220 ? raw.description.slice(0, 217).replace(/\s+\S*$/, "") + "…" : raw.description;
  return {
    id: stableId(raw.link),
    titulo: raw.title,
    resumo,
    link: raw.link,
    fonte: { id: src.id, nome: src.nome, site: src.site },
    tipo: src.oficial ? "comunicado-oficial" : "noticia",
    confianca: src.oficial ? "oficial" : "imprensa",
    operacional,
    linhas,
    publicadoEm: published.toISOString(),
    coletadoEm: now.toISOString(),
    expiraEm: new Date(published.getTime() + ttl * 86400000).toISOString(),
  };
}

const titleKey = (t: string) =>
  plain(t)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Remove repetidos (mesmo link ou mesmo título) e vencidos. Quando o mesmo assunto aparece numa
 * fonte oficial e na imprensa, fica a versão oficial. Ordena do mais recente para o mais antigo.
 */
export function dedupeAndExpire(items: OpsItem[], now: Date): OpsItem[] {
  const byKey = new Map<string, OpsItem>();
  for (const it of items) {
    if (new Date(it.expiraEm) <= now) continue;
    if (new Date(it.publicadoEm).getTime() > now.getTime() + 3600000) continue; // data no futuro: suspeita
    for (const k of [`l:${it.link}`, `t:${titleKey(it.titulo)}`]) {
      const prev = byKey.get(k);
      if (!prev || (prev.confianca !== "oficial" && it.confianca === "oficial")) byKey.set(k, it);
    }
  }
  const unique = new Map<string, OpsItem>();
  for (const it of byKey.values()) {
    const dup = [...unique.values()].find((u) => u.link === it.link || titleKey(u.titulo) === titleKey(it.titulo));
    if (!dup) unique.set(it.id, it);
    else if (dup.confianca !== "oficial" && it.confianca === "oficial") {
      unique.delete(dup.id);
      unique.set(it.id, it);
    }
  }
  return [...unique.values()].sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
}
