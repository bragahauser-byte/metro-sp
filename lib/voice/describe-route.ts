// Texto falado de uma rota (para speechSynthesis e também para leitores de tela).
import type { RouteOption } from "../route/engine.ts";
import { formatTime } from "../time/sao-paulo.ts";

type Names = { station: (slug: string) => string; line: (id: string) => string };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Lista de frases, uma por passo — cada uma vira um trecho de fala (dá para pausar entre elas). */
export function describeRoute(r: RouteOption, names: Names, detalhe: "resumido" | "completo" = "resumido"): string[] {
  const out: string[] = [];
  const head = [`Rota de cerca de ${plural(r.minutos, "minuto", "minutos")}`];
  head.push(r.baldeacoes === 0 ? "sem baldeação" : `com ${plural(r.baldeacoes, "baldeação", "baldeações")}`);
  if (r.partida && r.chegada) head.push(`saindo às ${formatTime(r.partida)} e chegando por volta das ${formatTime(r.chegada)}`);
  out.push(head.join(", ") + ".");
  if (r.viabilidade === "inviavel") out.push("Atenção: no horário escolhido esta rota não é possível. Veja os avisos.");
  else if (r.viabilidade === "nao-verificado") out.push("Parte desta rota tem horário não verificado em fonte oficial.");

  r.legs.forEach((leg, i) => {
    const first = names.station(leg.estacoes[0]);
    const last = names.station(leg.estacoes.at(-1)!);
    const n = leg.estacoes.length - 1;
    const line = names.line(leg.linha) + (leg.alternativas?.length ? `, ou ${leg.alternativas.map(names.line).join(", ou ")}` : "");
    const verb = i === 0 ? `Embarque em ${first}` : `Em ${first}, faça baldeação`;
    out.push(`${verb} para a ${line}${leg.sentido ? `, sentido ${leg.sentido}` : ""}.`);
    if (detalhe === "completo" && n > 1) {
      out.push(`Passe por ${leg.estacoes.slice(1, -1).map(names.station).join(", ")}.`);
    }
    out.push(`Siga ${plural(n, "estação", "estações")}, cerca de ${plural(leg.minutos, "minuto", "minutos")}, até ${last}.`);
  });
  out.push(`Desembarque em ${names.station(r.legs.at(-1)!.estacoes.at(-1)!)}.`);
  for (const a of r.avisos) if (a.nivel === "bloqueio" || detalhe === "completo") out.push(a.texto);
  return out;
}
