// Horários de funcionamento: modelo e regras de viabilidade.
// Os dados (data/horarios.json) só trazem o que foi lido em fonte oficial; o que falta vira
// "não verificado" — nunca "aberto" nem "fechado" por suposição. Cada operadora tem suas regras:
// nada do Metrô é estendido para Motiva, LinhaUni, TIC Trens, CPTM ou Trivia.
import { type DayType, type ServiceTime, DAY_LABEL, formatClock, parseClock } from "../time/sao-paulo.ts";

type Windows = [string, string][];

export type Source = { titulo: string; url: string; consultadoEm: string; oficial: boolean };

export type LineHours = {
  fonte: string;
  /** Janelas por tipo de dia. [] = fechado (confirmado); null ou ausente = não verificado. */
  horarios: Partial<Record<DayType, Windows | null>>;
  /** Fechamento de cada estação (lido na fonte), quando difere da janela geral. */
  fechamentoPorEstacao?: Record<string, string>;
  /** "mesma-linha": depois de 0h só se embarca para viagens na mesma linha. */
  aposMeiaNoite?: "mesma-linha";
  /** Depois desta data a fonte deixa de valer (ex.: operação assistida por 180 dias). */
  validoAte?: string;
  observacao?: string;
};

export type Special = { id: string; dia: DayType; linhas: string[]; validoAte: string; fonte: string; descricao: string };

export type Integration = {
  estacao: string;
  linhas: string[];
  horarios: Partial<Record<DayType | "todos", Windows>>;
  fonte: string;
  observacao?: string;
};

export type ScheduleData = {
  fuso: string;
  consultadoEm: string;
  fontes: Record<string, Source>;
  linhas: Record<string, LineHours>;
  especiais: Special[];
  integracoes: Integration[];
};

export type Verdict = {
  status: "aberto" | "fechado" | "nao-verificado";
  motivo: string;
  fonte?: Source;
};

/** Linhas operadas pela Companhia do Metropolitano (regras de transferência da página de horários). */
export const METRO_LINES = new Set(["1", "2", "3", "15"]);
const MIDNIGHT = 24 * 60;

const inside = (min: number, w: Windows) => w.some(([a, b]) => min >= parseClock(a) && min <= parseClock(b));
const describe = (w: Windows) => w.map(([a, b]) => `${formatClock(parseClock(a))}–${formatClock(parseClock(b))}`).join(" e ");

/** Operação especial que cobre este instante (ex.: madrugada de sábado para domingo). */
function specialFor(data: ScheduleData, linha: string, at: ServiceTime): Special | null {
  for (const s of data.especiais) {
    if (!s.linhas.includes(linha) || at.date > s.validoAte) continue;
    // Madrugada de sábado: depois do fechamento no sábado, ou antes da abertura no domingo.
    if (s.dia === at.tipo && at.min >= MIDNIGHT) return s;
    if (s.dia === "sabado" && at.tipo === "domingo" && at.min < parseClock("04:40")) return s;
  }
  return null;
}

/** A linha recebe passageiros nesta estação neste instante? */
export function boardingVerdict(data: ScheduleData, linha: string, estacao: string, at: ServiceTime, lineName = `Linha ${linha}`): Verdict {
  const h = data.linhas[linha];
  if (!h) return { status: "nao-verificado", motivo: `Horário da ${lineName} não verificado em fonte oficial.` };
  const fonte = data.fontes[h.fonte];
  if (h.validoAte && at.date > h.validoAte) {
    return { status: "nao-verificado", motivo: `O horário publicado da ${lineName} valia até ${h.validoAte.split("-").reverse().join("/")}.`, fonte };
  }
  const special = specialFor(data, linha, at);
  if (special) return { status: "nao-verificado", motivo: special.descricao, fonte: data.fontes[special.fonte] };

  const windows = h.horarios[at.tipo];
  if (windows == null) return { status: "nao-verificado", motivo: `A fonte não informa o horário da ${lineName} em ${DAY_LABEL[at.tipo]}.`, fonte };
  if (windows.length === 0) return { status: "fechado", motivo: `A ${lineName} não funciona em ${DAY_LABEL[at.tipo]}.`, fonte };

  // Fechamento próprio da estação (ex.: Sé fecha 0h29) estende a última janela.
  const close = h.fechamentoPorEstacao?.[estacao];
  const effective: Windows = close ? windows.map(([a, b], i) => (i === windows.length - 1 ? [a, close] : [a, b])) : windows;
  if (inside(at.min, effective)) return { status: "aberto", motivo: `${lineName}: ${describe(effective)}.`, fonte };
  return { status: "fechado", motivo: `Fora do horário da ${lineName} (${DAY_LABEL[at.tipo]}: ${describe(effective)}).`, fonte };
}

/** Transferência gratuita entre duas linhas numa estação (ou passagem) neste instante. */
export function transferVerdict(data: ScheduleData, estacoes: string[], de: string, para: string, at: ServiceTime, stationName = estacoes[0]): Verdict {
  const metroDe = METRO_LINES.has(de);
  const metroPara = METRO_LINES.has(para);
  const fonte = data.fontes["metro-horarios"];
  if (metroDe || metroPara) {
    const special = specialFor(data, metroDe ? de : para, at);
    if (special) return { status: "nao-verificado", motivo: special.descricao, fonte: data.fontes[special.fonte] };
  }

  if (metroDe && metroPara) {
    if (at.min >= MIDNIGHT) {
      return { status: "fechado", motivo: `Depois de 0h00 o embarque só vale para viagens na mesma linha; a baldeação em ${stationName} não é possível.`, fonte };
    }
    return { status: "aberto", motivo: `Baldeação em ${stationName} até 0h00.`, fonte };
  }
  if (metroDe || metroPara) {
    const other = metroDe ? para : de;
    const rule = data.integracoes.find((i) => estacoes.includes(i.estacao) && i.linhas.includes(other));
    if (!rule) return { status: "nao-verificado", motivo: `Horário da transferência para a Linha ${other} em ${stationName} não verificado.` };
    const windows = rule.horarios[at.tipo] ?? rule.horarios.todos;
    if (!windows) return { status: "nao-verificado", motivo: `A fonte não informa a transferência em ${stationName} em ${DAY_LABEL[at.tipo]}.` };
    const src = data.fontes[rule.fonte];
    if (inside(at.min, windows)) return { status: "aberto", motivo: `Transferência em ${stationName}: ${describe(windows)}.`, fonte: src };
    return {
      status: "fechado",
      motivo: `A transferência gratuita para a Linha ${other} em ${stationName} só funciona ${describe(windows)} (${DAY_LABEL[at.tipo]}).`,
      fonte: src,
    };
  }
  return { status: "nao-verificado", motivo: `Horário da transferência entre as linhas ${de} e ${para} não verificado.` };
}

/** Resumo legível do horário de uma linha (para a página da linha e avisos). */
export function lineHoursSummary(data: ScheduleData, linha: string): { texto: string; fonte?: Source; observacao?: string } | null {
  const h = data.linhas[linha];
  if (!h) return null;
  const parts: string[] = [];
  const order: DayType[] = ["util", "sabado", "domingo", "feriado"];
  for (const d of order) {
    const w = h.horarios[d];
    parts.push(`${DAY_LABEL[d]}: ${w == null ? "não informado" : w.length === 0 ? "fechada" : describe(w)}`);
  }
  return { texto: parts.join(" · "), fonte: data.fontes[h.fonte], observacao: h.observacao };
}
