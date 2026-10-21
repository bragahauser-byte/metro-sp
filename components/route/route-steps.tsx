"use client";

import type { ReactNode } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { Icons } from "@/components/ui/button";
import { usePrefs } from "@/components/ui/theme-toggle";
import { lineById, stationBySlug } from "@/components/map/network";
import { useOps } from "@/components/ops/use-ops";
import { RouteSpeech } from "@/components/voice/voice-controls";
import type { Spot } from "@/components/search/place-search";
import { type LngLat, type Walk, formatDistance } from "@/lib/geo/walk";
import { ARTESP_ATTRIBUTION, situationFor } from "@/lib/ops/status";
import { formatTime } from "@/lib/time/sao-paulo";
import type { WalkLegs } from "@/lib/voice/describe-route";
import { type Notice, type Route } from "./plan";
import { type Step, routeSteps } from "./steps";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export const transfers = (n: number) => (n === 0 ? "sem baldeação" : plural(n, "baldeação", "baldeações"));

/** Saída da origem → chegada ao destino, contando os trechos a pé (o motor só vê a rede). */
export function doorTimes(r: Route, walkIn?: Walk | null, walkOut?: Walk | null): string {
  if (!r.partida || !r.chegada) return "";
  const from = new Date(r.partida.getTime() - (walkIn?.minutos ?? 0) * 60_000);
  const to = new Date(r.chegada.getTime() + (walkOut?.minutos ?? 0) * 60_000);
  return `${formatTime(from)} → ${formatTime(to)}`;
}

export type FocusStep = { stations: string[]; points: LngLat[] };

function NoticeItem({ n }: { n: Notice }) {
  const tone =
    n.nivel === "bloqueio" ? "border-fg-danger text-fg-danger" : n.nivel === "atencao" ? "border-fg-warning" : "border-rule-strong";
  return (
    <li className={`border-l-4 pl-1 text-sm ${tone}`}>
      <span className="font-semibold">{n.nivel === "bloqueio" ? "Impossível: " : n.nivel === "atencao" ? "Não verificado: " : ""}</span>
      <span className="text-ink">{n.texto}</span>
      {n.fonte && (
        <>
          {" "}
          <a href={n.fonte.url} className="text-xs text-ink-muted underline">
            Fonte
          </a>
        </>
      )}
    </li>
  );
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Situação agora da linha de um trecho: alerta, normal com fonte, ou "sem leitura automática". */
function LineSituation({ linha }: { linha: string }) {
  const ops = useOps();
  if (ops.status === "loading") return null;
  const sit = situationFor(linha, ops.status === "ok" ? (ops.data.situacao?.linhas ?? []) : []);
  if (sit.kind === "sem-leitura") {
    return (
      <p className="text-xs text-ink-muted">
        Situação agora: sem leitura automática{ops.status === "static" ? " nesta versão" : ""} — confira no canal da operadora.
      </p>
    );
  }
  const s = sit.status;
  const source = `${s.fonte.id === "artesp" ? ARTESP_ATTRIBUTION : s.fonte.nome}${s.atualizadoEm ? `, ${timeFmt.format(new Date(s.atualizadoEm))}` : ""}`;
  if (sit.kind === "alerta") {
    return (
      <p className="border-l-4 border-fg-warning pl-1 text-sm" role="note">
        <span className="font-semibold text-fg-warning">Alteração agora: {s.texto}</span>
        {s.detalhe && s.detalhe !== s.texto ? ` — ${s.detalhe}` : ""} <span className="text-xs text-ink-muted">({source})</span>
      </p>
    );
  }
  return (
    <p className="text-xs text-ink-muted">
      Situação agora: <span className="font-semibold text-fg-success">{s.texto}</span> · {source}
    </p>
  );
}

/** Um passo: o texto principal é um botão que leva o mapa até ele. */
function StepItem({ step, last, onFocus, children }: { step: Step; last: boolean; onFocus?: (f: FocusStep) => void; children?: ReactNode }) {
  const line = step.linha ? lineById.get(step.linha) : null;
  return (
    <li className="relative flex gap-1.5 pb-2">
      {!last &&
        (step.kind === "walk" ? (
          <span aria-hidden className="absolute bottom-0 left-[15px] top-4 w-0 border-l-4 border-dotted border-ink-muted" />
        ) : step.kind === "ride" || step.kind === "transfer" ? (
          <span aria-hidden className="absolute bottom-0 left-[14px] top-4 w-1" style={{ backgroundColor: line?.cor }} />
        ) : null)}
      <span className="flex size-4 shrink-0 items-center justify-center">
        {step.linha ? (
          <LineBadge line={step.linha} />
        ) : step.kind === "walk" ? (
          <span className="flex size-4 items-center justify-center rounded-full border-2 border-ink-muted bg-surface text-ink">{Icons.walk}</span>
        ) : (
          <span className="flex size-4 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink">{Icons.pin}</span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onFocus?.(step.focus)}
          className="-mx-0.5 flex min-h-control flex-col items-start rounded px-0.5 text-left hover:bg-ink/5"
          aria-label={`${step.titulo}. ${step.detalhe}. Mostrar no mapa.`}
        >
          <span className="text-base font-semibold">{step.titulo}</span>
          <span className="text-sm text-ink-muted">{step.detalhe}</span>
        </button>
        {children}
      </div>
    </li>
  );
}

export function RouteSteps({
  route,
  walkIn,
  walkOut,
  from,
  to,
  acessivel,
  onFocusStep,
}: {
  route: Route;
  walkIn?: Walk | null;
  walkOut?: Walk | null;
  from: Spot | null;
  to: Spot | null;
  acessivel?: boolean;
  onFocusStep?: (f: FocusStep) => void;
}) {
  const prefs = usePrefs();
  const total = route.minutos + (walkIn?.minutos ?? 0) + (walkOut?.minutos ?? 0);
  const steps = routeSteps(route, { walkIn, walkOut, from, to });
  const destName = to?.kind === "place" ? to.nome : undefined;
  const walkLegs: WalkLegs = { walkIn, walkOut, destino: destName };
  const times = doorTimes(route, walkIn, walkOut);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-2xl font-bold">~{total} min</p>
        <p className="text-sm text-ink-muted">
          {times && `${times} · `}
          {transfers(route.baldeacoes)}
          {walkIn || walkOut ? ` · ${(walkIn?.minutos ?? 0) + (walkOut?.minutos ?? 0)} min a pé` : ""}
        </p>
      </div>
      {prefs.voz && <RouteSpeech key={route.id} route={route} detalhe={prefs.detalheVoz} walk={walkLegs} />}
      <ol className="flex flex-col" aria-label="Passo a passo da viagem">
        {steps.map((s, i) => (
          <StepItem key={i} step={s} last={i === steps.length - 1} onFocus={onFocusStep}>
            {s.kind === "ride" && s.linha && <LineSituation linha={s.linha} />}
            {s.kind === "transfer" && s.linha && <LineSituation linha={s.linha} />}
            {s.estacoes && s.estacoes.length > 2 && (
              <details className="text-sm">
                <summary className="inline-flex min-h-control cursor-pointer items-center text-ink-muted underline">
                  ver as {s.estacoes.length} estações
                </summary>
                <ol className="flex flex-col">
                  {s.estacoes.map((slug) => (
                    <li key={slug}>{stationBySlug.get(slug)?.nome}</li>
                  ))}
                </ol>
              </details>
            )}
          </StepItem>
        ))}
      </ol>
      {route.avisos.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Avisos da rota">
          {route.avisos.map((a) => (
            <NoticeItem key={a.texto} n={a} />
          ))}
        </ul>
      )}
      {acessivel && (
        <p className="text-sm">
          {route.acessibilidadeNaoConfirmada.length === 0
            ? "♿ Embarque, baldeações e desembarque em estações marcadas como acessíveis no OpenStreetMap."
            : `♿ Sem acessibilidade confirmada no OpenStreetMap: ${route.acessibilidadeNaoConfirmada
                .map((s) => stationBySlug.get(s)?.nome)
                .join(", ")}. Confirme com a operadora.`}
        </p>
      )}
      <p className="text-xs text-ink-muted">
        Toque num passo para vê-lo no mapa. Tempo estimado pelo traçado (velocidade média por tipo de linha, 30 s por parada, 5 min por
        baldeação).
        {walkIn || walkOut ? " Trechos a pé: linha reta × 1,3 a 4,5 km/h — estimativa, não um caminho pelas ruas." : ""} Horários
        conferidos só onde há fonte oficial.
      </p>
    </div>
  );
}

export { formatDistance };
