// Textos de situação de cada linha, com fonte (ver data/sources.md). Não há dado oficial aberto em
// tempo real: estes avisos descrevem a situação conhecida na data da consulta.
import type { Status } from "@/components/ui/status-chip";
import { lineById } from "./network";

export type LineNote = { titulo: string; texto: string; fonte?: { nome: string; url: string } };

const NOTES: Record<string, LineNote> = {
  "6": {
    titulo: "Operação assistida",
    texto:
      "Trecho de João Paulo I a Perdizes funcionando em operação assistida. As outras nove estações, de Brasilândia a São Joaquim, estão em obras.",
    fonte: { nome: "Linha Uni / Agência SP, jul–ago/2026", url: "https://www.linhauni.com.br" },
  },
  "17": {
    titulo: "Operação transitória",
    texto:
      "Funciona em dias úteis, das 9h às 16h, sem cobrança de passagem. Quem vai para Washington Luís troca de trem em Brooklin Paulista.",
    fonte: {
      nome: "Metrô, 30/06/2026",
      url: "https://www.metro.sp.gov.br/2026/06/30/governo-de-sp-entrega-estacao-washington-luis-e-amplia-operacao-transitoria-da-linha-17-ouro-do-metro/",
    },
  },
};

const DEFAULT: Record<Status, LineNote> = {
  operando: { titulo: "Operação normal", texto: "Sem alterações conhecidas na data da consulta." },
  "operacao-assistida": { titulo: "Operação assistida", texto: "Funcionamento em fase de testes com passageiros." },
  "em-obras": { titulo: "Em obras", texto: "Ainda não recebe passageiros." },
  planejada: { titulo: "Planejada", texto: "Projeto sem obras em andamento." },
};

export function lineNote(id: string): LineNote {
  return NOTES[id] ?? DEFAULT[lineById.get(id)?.status ?? "operando"];
}

/** Linhas com alguma situação fora do normal — conteúdo do botão de avisos. */
export function notices() {
  return [...lineById.values()].filter((l) => l.status !== "operando" || NOTES[l.id]).map((l) => ({ id: l.id, ...lineNote(l.id) }));
}

export type Curiosity = { texto: string; fonte: { nome: string; url: string } };

/** Curiosidades com fonte, mostradas na página da linha. */
export const CURIOSITIES: Record<string, Curiosity[]> = {
  "17": [
    {
      texto:
        "É a primeira linha de metrô de São Paulo a chegar a um aeroporto e a funcionar em “formato Y”, com dois destinos finais do mesmo lado: Aeroporto de Congonhas e Washington Luís.",
      fonte: NOTES["17"].fonte!,
    },
    {
      texto: "A estação Washington Luís foi construída sobre o piscinão Água Espraiada, ao lado do pátio de manutenção.",
      fonte: NOTES["17"].fonte!,
    },
  ],
  "6": [
    {
      texto: "Itaberaba-Hospital Vila Penteado deve ser a estação mais profunda do metrô paulistano, a cerca de 66 metros.",
      fonte: {
        nome: "Diário do Grande ABC, 28/04/2026",
        url: "https://www.dgabc.com.br/Noticia/4316614/linha-6-laranja-do-metro-como-estao-as-obras-de-cada-estacao-a-6-meses-da-entrega-da-1-etapa",
      },
    },
  ],
};
