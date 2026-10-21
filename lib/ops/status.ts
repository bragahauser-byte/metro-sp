// Situação das linhas agora (operação normal, velocidade reduzida, paralisada…), lida de quem
// publica esse dado em formato de máquina. Funções puras: recebem a resposta da fonte e devolvem
// dados — testáveis sem rede. Quem não publica em máquina fica como "sem leitura automática", com
// link para o canal oficial: nunca supomos que uma linha está normal.

export type Situacao = "normal" | "atencao" | "paralisada" | "encerrada" | "desconhecida";

export type LineStatus = {
  linha: string;
  situacao: Situacao;
  /** Texto exatamente como a fonte publicou ("Operação Normal", "Velocidade Reduzida"…). */
  texto: string;
  /** Explicação da fonte, quando houver. */
  detalhe: string;
  fonte: { id: string; nome: string; site: string };
  /** Quando a fonte diz que gerou o dado (ISO, com fuso). */
  atualizadoEm: string | null;
  /** Veio de uma leitura anterior porque a de agora falhou. */
  preservado?: boolean;
};

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Classifica o texto publicado. Na dúvida, "desconhecida" — nunca "normal". */
export function classify(texto: string): Situacao {
  const t = plain(texto);
  if (!t) return "desconhecida";
  if (/encerrad|fora do horario|sem operacao comercial/.test(t)) return "encerrada";
  if (/paralisad|paralisac|interrompid|interrupc|suspens/.test(t)) return "paralisada";
  if (/reduzid|parcial|diferenciad|programad|atencao|alterac|lentidao|intervalo|falha|ocorrencia|restric/.test(t)) return "atencao";
  if (/^operacao normal$|^normal$|opera normalmente/.test(t)) return "normal";
  return "desconhecida";
}

/** "2026-10-21T09:56:58" sem fuso é hora de São Paulo (UTC−3, sem horário de verão desde 2019). */
export function spLocalToIso(s: string | null | undefined): string | null {
  if (!s) return null;
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}-03:00`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const CPTM_SOURCE = { id: "cptm", nome: "CPTM", site: "https://www.cptm.sp.gov.br/cptm" };
export const CPTM_STATUS_URL = "https://api.cptm.sp.gov.br/AppCPTM/v1/Linhas/ObterStatus";

/** Resposta da CPTM: [{ linhaId, dataGeracao, descricao, tipo: "C", status }]. */
export function parseCptm(json: unknown): LineStatus[] {
  if (!Array.isArray(json)) return [];
  const out: LineStatus[] = [];
  for (const row of json as Record<string, unknown>[]) {
    if (!row || (row.tipo !== undefined && row.tipo !== "C")) continue;
    const linha = String(Number(row.linhaId));
    if (linha === "NaN") continue;
    const texto = typeof row.status === "string" ? row.status.trim() : "";
    out.push({
      linha,
      situacao: classify(texto),
      texto,
      detalhe: typeof row.descricao === "string" ? row.descricao.trim() : "",
      fonte: CPTM_SOURCE,
      atualizadoEm: spLocalToIso(typeof row.dataGeracao === "string" ? row.dataGeracao : null),
    });
  }
  return out;
}

export const ARTESP_SOURCE = { id: "artesp", nome: "ARTESP — Centro de Controle Multimodal", site: "https://ccm.artesp.sp.gov.br/metroferroviario/status-linhas/" };
export const ARTESP_STATUS_URL = "https://ccm.artesp.sp.gov.br/metroferroviario/api/status/";

type ArtespLine = {
  nome?: string;
  codigo?: string | number;
  status?: { situacao?: string; classificacao?: string; operacao_normal?: boolean; atualizado_em?: string; mensagem?: string; descricao?: string };
};

/** Número da linha a partir de `codigo` (4, "L4", "4") ou do nome ("Linha 4-Amarela"). */
function lineNumber(l: ArtespLine): string | null {
  const fromCode = String(l.codigo ?? "").match(/\d{1,2}/)?.[0];
  const fromName = (l.nome ?? "").match(/linha\s*(\d{1,2})/i)?.[1];
  const n = fromCode ?? fromName;
  return n ? String(Number(n)) : null;
}

/** Resposta da API da ARTESP (com chave): { empresas: [{ linhas: [{ codigo, nome, status }] }] }. */
export function parseArtesp(json: unknown): LineStatus[] {
  const empresas = (json as { empresas?: { linhas?: ArtespLine[] }[] } | null)?.empresas;
  if (!Array.isArray(empresas)) return [];
  const out: LineStatus[] = [];
  for (const e of empresas) {
    for (const l of e.linhas ?? []) {
      const linha = lineNumber(l);
      if (!linha) continue;
      const texto = (l.status?.situacao ?? "").trim();
      let situacao = classify(texto);
      // A classificação da própria fonte manda quando o texto não basta.
      if (situacao === "desconhecida" && l.status?.operacao_normal === true) situacao = "normal";
      out.push({
        linha,
        situacao,
        texto,
        detalhe: (l.status?.mensagem ?? l.status?.descricao ?? "").trim(),
        fonte: ARTESP_SOURCE,
        atualizadoEm: spLocalToIso(l.status?.atualizado_em ?? null),
      });
    }
  }
  return out;
}

/** Mais grave primeiro; dentro do mesmo nível, pela ordem das linhas. */
const SEVERITY: Record<Situacao, number> = { paralisada: 0, atencao: 1, desconhecida: 2, encerrada: 3, normal: 4 };
export function sortStatuses(list: LineStatus[]): LineStatus[] {
  return [...list].sort((a, b) => SEVERITY[a.situacao] - SEVERITY[b.situacao] || Number(a.linha) - Number(b.linha));
}

/** Linhas que pedem atenção agora (aparecem no contador do botão de avisos). */
export const isAlert = (s: LineStatus) => s.situacao === "paralisada" || s.situacao === "atencao";
