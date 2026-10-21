// Atualizações operacionais: comunicados e notícias coletados de fontes públicas.
// Um comunicado diz o que a fonte publicou, quando publicou. A situação das linhas agora vem à parte
// (`situacao`), só de fontes que publicam esse dado em formato de máquina.
import type { LineStatus } from "./status.ts";

export type OpsSource = {
  id: string;
  nome: string;
  /** Página para pessoas (aparece no site). */
  site: string;
  /** Endereço legível por máquina (RSS). Só entram feeds públicos, sem raspagem de HTML. */
  feed: string;
  oficial: boolean;
  /** Linhas da operadora (para não atribuir comunicado de uma empresa a linhas de outra). */
  linhas: string[];
  /** Por que esta fonte pode ser lida (termos, robots.txt) — documentado em data/sources.md. */
  permissao: string;
};

export type OpsKind = "comunicado-oficial" | "noticia";

export type OpsItem = {
  /** Estável entre coletas: derivado do link. */
  id: string;
  titulo: string;
  resumo: string;
  link: string;
  fonte: { id: string; nome: string; site: string };
  tipo: OpsKind;
  /** "oficial": publicado pela operadora. "imprensa": reportado por terceiros, não confirmado. */
  confianca: "oficial" | "imprensa";
  /** Fala de operação (horário, interdição, obras, greve…) e não de assunto institucional. */
  operacional: boolean;
  linhas: string[];
  publicadoEm: string;
  coletadoEm: string;
  expiraEm: string;
};

export type SourceState = {
  id: string;
  nome: string;
  site: string;
  ok: boolean;
  erro?: string;
  /** Quando esta coleta tentou ler a fonte. */
  coletadoEm: string;
  /** Última leitura que deu certo (pode ser de uma coleta anterior); null se nunca deu. */
  ultimaColetaOkEm: string | null;
  /** Os itens desta fonte vieram da última coleta boa, porque a de agora falhou. */
  preservado?: boolean;
  /** Fonte que precisa de chave e está sem ela (não é falha: está desligada). */
  desligada?: boolean;
};

export type OpsSnapshot = {
  itens: OpsItem[];
  fontes: SourceState[];
  /** Situação de cada linha agora, de quem publica em formato de máquina. */
  situacao: { linhas: LineStatus[]; fontes: SourceState[] };
  atualizadoEm: string;
  /** Intervalo mínimo entre coletas, em segundos (o cache do servidor segura o resto). */
  intervaloS: number;
};
