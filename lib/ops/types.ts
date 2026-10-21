// Atualizações operacionais: comunicados e notícias coletados de fontes públicas.
// Nada aqui é "status em tempo real": um comunicado diz o que a fonte publicou, quando publicou.

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

export type OpsSnapshot = {
  itens: OpsItem[];
  fontes: {
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
  }[];
  atualizadoEm: string;
  /** Intervalo mínimo entre coletas, em segundos (o cache do servidor segura o resto). */
  intervaloS: number;
};
