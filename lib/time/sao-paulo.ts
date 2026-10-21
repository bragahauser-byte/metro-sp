// Hora local de São Paulo (America/Sao_Paulo), dia de operação e tipo de dia.
// Tudo passa pelo Intl, então funciona igual no navegador e no servidor (que roda em UTC).

export const TIME_ZONE = "America/Sao_Paulo";

export type DayType = "util" | "sabado" | "domingo" | "feriado";

/** Um instante visto como "dia de operação": depois da meia-noite ainda conta como o dia anterior. */
export type ServiceTime = {
  /** Data do dia de operação, AAAA-MM-DD. */
  date: string;
  tipo: DayType;
  /** Minutos desde 0h do dia de operação; 0h10 da madrugada seguinte = 1450. */
  min: number;
};

/** Até 3h a madrugada pertence ao dia de operação anterior (as estações fecham por volta de 0h35). */
const SERVICE_DAY_CUTOFF_MIN = 3 * 60;

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function localParts(at: Date) {
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), min: Number(p.hour) * 60 + Number(p.minute) };
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Soma dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/**
 * Feriados que valem na cidade de São Paulo. Nacionais (Lei 662/1949, Lei 6.802/1980 e
 * Lei 14.759/2023 — Consciência Negra), estadual (9 de julho, Lei estadual 9.497/1997) e municipais
 * (25 de janeiro e Corpus Christi, Lei municipal 14.485/2007). Carnaval é ponto facultativo e não entra.
 */
export function holidays(year: number): Map<string, string> {
  const e = easter(year);
  return new Map([
    [iso(year, 1, 1), "Confraternização Universal"],
    [iso(year, 1, 25), "Aniversário de São Paulo"],
    [addDays(e, -2), "Sexta-feira Santa"],
    [iso(year, 4, 21), "Tiradentes"],
    [iso(year, 5, 1), "Dia do Trabalho"],
    [addDays(e, 60), "Corpus Christi"],
    [iso(year, 7, 9), "Revolução Constitucionalista"],
    [iso(year, 9, 7), "Independência"],
    [iso(year, 10, 12), "Nossa Senhora Aparecida"],
    [iso(year, 11, 2), "Finados"],
    [iso(year, 11, 15), "Proclamação da República"],
    [iso(year, 11, 20), "Dia da Consciência Negra"],
    [iso(year, 12, 25), "Natal"],
  ]);
}

export function holidayName(date: string): string | null {
  return holidays(Number(date.slice(0, 4))).get(date) ?? null;
}

export function dayType(date: string): DayType {
  if (holidayName(date)) return "feriado";
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? "domingo" : wd === 6 ? "sabado" : "util";
}

export function serviceTime(at: Date): ServiceTime {
  const { y, m, d, min } = localParts(at);
  let date = iso(y, m, d);
  let minutes = min;
  if (min < SERVICE_DAY_CUTOFF_MIN) {
    date = addDays(date, -1);
    minutes += 24 * 60;
  }
  return { date, tipo: dayType(date), min: minutes };
}

/** "04:40" → 280; "24:06" → 1446. */
export function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 1446 → "0h06"; 280 → "4h40". */
export function formatClock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}h${pad(m % 60)}`;
}

/** Hora local de um Date no formato "14:05". */
export function formatTime(at: Date): string {
  const { min } = localParts(at);
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/**
 * Data + hora digitadas (horário de São Paulo) → Date. Desde 2019 São Paulo não tem horário de
 * verão, então o deslocamento é fixo em −03:00.
 */
export function fromLocal(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`);
}

export const DAY_LABEL: Record<DayType, string> = {
  util: "dia útil",
  sabado: "sábado",
  domingo: "domingo",
  feriado: "feriado",
};
