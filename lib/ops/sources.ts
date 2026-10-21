// Fontes de atualizações operacionais. Só entra feed público (RSS) de quem publica: nada de raspar
// HTML, nada de contornar bloqueio. Para incluir outra fonte, registre aqui E em data/sources.md o
// motivo de ela poder ser lida (termos de uso, robots.txt) e a data em que isso foi conferido.
import type { OpsSource } from "./types.ts";

export const OPS_SOURCES: OpsSource[] = [
  {
    id: "metro-sp",
    nome: "Metrô (Companhia do Metropolitano)",
    site: "https://www.metro.sp.gov.br",
    feed: "https://www.metro.sp.gov.br/feed/",
    oficial: true,
    linhas: ["1", "2", "3", "15", "17"],
    permissao: "Feed RSS público do site oficial; robots.txt permite / (só bloqueia busca). Conferido em 20/10/2026.",
  },
];

/**
 * Candidatas que NÃO estão ligadas e por quê (ver data/sources.md):
 * - CPTM (linhas 10–13): o painel "Situação das linhas" carrega por script, sem feed ou API documentada.
 * - Motiva (4, 5, 8, 9), LinhaUni (6), TIC Trens (7), Trivia (11–13): sem feed público localizado.
 * - Portais de notícia: só com feed RSS oficial do portal e sempre como "notícia", nunca como status.
 */
