// Fontes de atualizações operacionais. Só entra o que a fonte publica para ser lido: feed RSS ou o
// mesmo endpoint público que o site oficial usa. Nada de raspar HTML, nada de contornar bloqueio ou
// login. Para incluir outra fonte, registre aqui E em data/sources.md o motivo de ela poder ser lida
// (termos de uso, robots.txt) e a data em que isso foi conferido.
import type { OpsSource } from "./types.ts";
import { ARTESP_SOURCE, ARTESP_STATUS_URL, CPTM_SOURCE, CPTM_STATUS_URL } from "./status.ts";

/** Comunicados e notícias (RSS). */
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

export type StatusSource = {
  id: string;
  nome: string;
  site: string;
  url: string;
  linhas: string[];
  /** Variável de ambiente com a chave; sem ela a fonte fica desligada (e o site diz isso). */
  chave?: string;
  /** Intervalo mínimo entre leituras reais, por instância do servidor (limite da fonte). */
  minIntervaloS?: number;
  permissao: string;
};

/** Situação das linhas agora, em formato de máquina. */
export const STATUS_SOURCES: StatusSource[] = [
  {
    ...CPTM_SOURCE,
    url: CPTM_STATUS_URL,
    linhas: ["10", "11", "12", "13"],
    permissao:
      "Endpoint JSON público, sem login, que o próprio site da CPTM usa no quadro “Situação das linhas”. Lido no máximo a cada 15 min, com identificação. Conferido em 21/10/2026.",
  },
  {
    ...ARTESP_SOURCE,
    url: ARTESP_STATUS_URL,
    linhas: ["4", "5", "6", "7", "8", "9"],
    chave: "ARTESP_API_KEY",
    // Limite da ARTESP: 12 req/h por chave. Aqui: no máximo 4 por hora.
    minIntervaloS: 15 * 60,
    permissao:
      "API documentada do CCM; exige chave pessoal (Minha Conta → Minhas APIs), limite de 12 requisições/hora e licença CC BY-NC 4.0 com crédito “Fonte: ARTESP — Centro de Controle Multimodal”. Desde 03/09/2026 não cobre linhas do Metrô e da CPTM. Conferido em 21/10/2026.",
  },
];

export type Channel = { nome: string; url: string; linhas: string[]; nota?: string };

/**
 * Onde conferir com uma pessoa olhando (links, não leitura automática). O TemTrem reúne tudo, mas os
 * termos dele proíbem robôs e reaproveitamento sem autorização — por isso só o link.
 */
export const CHANNELS: Channel[] = [
  { nome: "TemTrem", url: "https://temtrem.com/", linhas: [], nota: "todas as linhas num lugar só" },
  { nome: "ARTESP — status das linhas", url: "https://ccm.artesp.sp.gov.br/metroferroviario/status-linhas/", linhas: ["4", "5", "6", "7", "8", "9"], nota: "linhas concedidas" },
  { nome: "Metrô — site oficial", url: "https://www.metro.sp.gov.br", linhas: ["1", "2", "3", "15", "17"] },
  { nome: "Metrô no X (@metrosp_oficial)", url: "https://x.com/metrosp_oficial", linhas: ["1", "2", "3", "15", "17"] },
  { nome: "CPTM — site oficial", url: "https://www.cptm.sp.gov.br/cptm", linhas: ["10", "11", "12", "13"] },
  { nome: "CPTM no X (@cptm_oficial)", url: "https://twitter.com/cptm_oficial", linhas: ["10", "11", "12", "13"] },
  { nome: "ViaQuatro — Linha 4-Amarela", url: "https://trilhos.motiva.com.br/linha-4-amarela/", linhas: ["4"] },
  { nome: "ViaMobilidade — Linha 5-Lilás", url: "https://trilhos.motiva.com.br/linha-5-lilas/", linhas: ["5"] },
  { nome: "ViaMobilidade — Linhas 8 e 9", url: "https://trilhos.motiva.com.br/viamobilidade8e9/", linhas: ["8", "9"] },
];

/** Linhas que nenhuma fonte de máquina cobre: o site mostra o link do canal oficial. */
export const LINES_WITHOUT_FEED = ["1", "2", "3", "15", "17"];
