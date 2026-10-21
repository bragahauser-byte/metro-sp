// Textos de situação de cada linha, com fonte (ver data/sources.md). Não há dado oficial aberto em
// tempo real: estes avisos descrevem a situação conhecida na data da consulta.
import type { Status } from "@/components/ui/status-chip";
import { lineById } from "./network";

export type LineNote = { titulo: string; texto: string; fonte?: { nome: string; url: string } };

const COMUNICADO_17 = {
  nome: "Metrô, 30/06/2026",
  url: "https://www.metro.sp.gov.br/2026/06/30/governo-de-sp-entrega-estacao-washington-luis-e-amplia-operacao-transitoria-da-linha-17-ouro-do-metro/",
};

const NOTES: Record<string, LineNote> = {
  "6": {
    titulo: "Operação assistida",
    texto:
      "Trecho de João Paulo I a Perdizes em operação assistida, de segunda a sexta (exceto feriados), das 10h às 15h, sem cobrança. As outras nove estações, de Brasilândia a São Joaquim, estão em obras.",
    fonte: {
      nome: "Prefeitura de São Paulo, 02/07/2026",
      url: "https://prefeitura.sp.gov.br/w/linha-6-laranja-inaugura-nova-fase-para-a-brasil%C3%A2ndia-e-aproxima-a-zona-norte-do-centro-de-s%C3%A3o-paulo",
    },
  },
  "17": {
    titulo: "Operação transitória",
    texto:
      "Funciona de segunda a sábado, das 6h às 22h, sem cobrança de passagem. Quem vai para Washington Luís troca de trem em Brooklin Paulista.",
    fonte: {
      nome: "Metrô — Horários (consulta em 20/10/2026) e comunicado de 30/06/2026",
      url: "https://www.metro.sp.gov.br/sua-viagem/horarios/",
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
      fonte: COMUNICADO_17,
    },
    {
      texto: "A estação Washington Luís foi construída sobre o piscinão Água Espraiada, ao lado do pátio de manutenção.",
      fonte: COMUNICADO_17,
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
