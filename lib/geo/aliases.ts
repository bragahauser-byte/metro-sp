// Nomes populares que o OpenStreetMap não guarda como nome do lugar (sigla ou nome antigo).
// Lista curta e conferida: a busca troca o texto antes de perguntar ao geocodificador.
const ALIASES: Record<string, string> = {
  // Sigla do Museu de Arte de São Paulo Assis Chateaubriand (Av. Paulista, 1578).
  masp: "Museu de Arte de São Paulo",
  // Estádio do Palmeiras, renomeado Nubank Parque em 2026 (nome atual no OpenStreetMap).
  "allianz parque": "Nubank Parque",
  allianz: "Nubank Parque",
};

export const normalizeText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** CEP sem traço vira 00000-000 (o Photon e o Nominatim acham melhor assim). */
export function normalizeCep(q: string): string {
  const m = q.trim().match(/^(\d{5})-?(\d{3})$/);
  return m ? `${m[1]}-${m[2]}` : q;
}

/** Texto que vai para o geocodificador: CEP formatado ou o nome que o mapa conhece. */
export function expandQuery(q: string): string {
  const cep = normalizeCep(q);
  if (cep !== q) return cep;
  return ALIASES[normalizeText(q)] ?? q;
}

/** Parece endereço com número ("Rua Augusta 1500", "Av. Paulista, 1578") ou CEP. */
export const looksLikeAddress = (q: string) => /\d/.test(q);
