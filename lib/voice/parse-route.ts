// Entende frases como "Quero ir da estação São Lucas até a estação Tatuapé" (vindas do
// reconhecimento de voz ou digitadas) e acha as estações pelo nome, sem depender de acentos.

export type StationName = { slug: string; nome: string; complemento?: string | null };

export type StationMatch = { slug: string; nome: string; score: number };

export type RouteIntent = {
  de: StationMatch | null;
  para: StationMatch | null;
  /** Trecho falado que não virou estação (para procurar como lugar ou pedir confirmação). */
  naoEntendido: string[];
  /** Texto de cada ponta como foi entendido, já sem "da/até" (para buscar como endereço). */
  deTexto: string | null;
  paraTexto: string | null;
};

// Começos típicos de endereço ou lugar: aí só vale estação com nome praticamente igual.
const PLACE_WORDS = /^(rua|r|avenida|av|alameda|al|praca|pca|travessa|tv|estrada|rodovia|rod|largo|viaduto|ladeira|shopping|parque|cep|condominio|edificio|escola|faculdade|universidade|aeroporto|rodoviaria|igreja|mercado|supermercado|padaria|restaurante|bar|hotel|teatro|museu|estadio|clube)\b/;

/** Parece endereço, CEP ou nome de lugar (e não nome de estação)? */
export function looksLikePlace(phrase: string) {
  const q = normalize(phrase);
  return PLACE_WORDS.test(q) || /\d/.test(q);
}

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

const FILLER = /^(a |o |na |no |em |estacao |estacoes |metro |terminal )+/;

/** Melhor estação para um trecho de texto; null se nada passa de um limiar seguro. */
export function matchStation(phrase: string, stations: StationName[], minScore = 0.72): StationMatch | null {
  const q = normalize(phrase).replace(FILLER, "").replace(/ (por favor|agora)$/, "").trim();
  if (q.length < 2) return null;
  let best: StationMatch | null = null;
  for (const s of stations) {
    const names = [s.nome, s.complemento ? `${s.nome} ${s.complemento}` : null, s.complemento].filter(Boolean) as string[];
    for (const raw of names) {
      const n = normalize(raw);
      let score: number;
      if (n === q) score = 1;
      else if (n.startsWith(q + " ") || q.startsWith(n + " ")) score = 0.92;
      else if (n.split(" ").includes(q) && q.length >= 4) score = 0.85;
      else score = 1 - levenshtein(q, n) / Math.max(q.length, n.length);
      if (!best || score > best.score) best = { slug: s.slug, nome: s.nome, score };
    }
  }
  return best && best.score >= minScore ? best : null;
}

// "da/de/do <origem> até/para/pra <destino>"; também "para <destino> saindo de <origem>".
const FROM_TO = /(?:^| )(?:da|de|do|desde)\s+(.+?)\s+(?:ate|para|pra|pro|ao|a)\s+(.+)$/;
const TO_FROM = /(?:^| )(?:ate|para|pra|pro|na|no|em)\s+(.+?)\s+(?:saindo|partindo)\s+(?:da|de|do)\s+(.+)$/;
const ONLY_TO = /(?:^| )(?:ate|para|pra|pro|chegar (?:na|no|em|a|ao)|chego (?:na|no|em|a|ao)|ir (?:na|no|em|a|ao))\s+(.+)$/;

export function parseRouteIntent(text: string, stations: StationName[]): RouteIntent {
  const t = normalize(text)
    .replace(/^(eu )?(quero|queria|preciso|gostaria de|como (eu )?(faco para|chego)|me leva|me leve|vou)( ir)?\s*/, "")
    .trim();
  let deTxt: string | null = null;
  let paraTxt: string | null = null;
  let m = t.match(TO_FROM);
  if (m) [, paraTxt, deTxt] = m;
  else if ((m = t.match(FROM_TO))) [, deTxt, paraTxt] = m;
  else if ((m = t.match(ONLY_TO))) paraTxt = m[1];
  else paraTxt = t;

  const station = (txt: string | null) => (txt ? matchStation(txt, stations, looksLikePlace(txt) ? 0.92 : 0.72) : null);
  const de = station(deTxt);
  const para = station(paraTxt);
  const naoEntendido = [deTxt && !de ? deTxt : null, paraTxt && !para ? paraTxt : null].filter(Boolean) as string[];
  return { de, para, naoEntendido, deTexto: deTxt, paraTexto: paraTxt };
}
