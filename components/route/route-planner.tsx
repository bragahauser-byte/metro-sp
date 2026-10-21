"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { IconButton, Icons } from "@/components/ui/button";
import { usePrefs } from "@/components/ui/theme-toggle";
import { lineById, stationBySlug } from "@/components/map/network";
import { nearestStations } from "@/components/geo/nearest";
import { GEO_MESSAGES, useGeolocation } from "@/components/geo/use-geolocation";
import { OfficialUpdates } from "@/components/map/panels";
import { RouteSpeech, VoiceRouteButton } from "@/components/voice/voice-controls";
import { beep } from "@/components/voice/speech";
import { formatTime, fromLocal, localParts } from "@/lib/time/sao-paulo";
import { type Notice, type PlanRequest, type PlanResult, type Route, planRoutes } from "./plan";
import { StationCombobox } from "./station-combobox";

type WhenMode = "agora" | "partir" | "chegar";

const pad = (n: number) => String(n).padStart(2, "0");
function localInputs(at: Date) {
  const { y, m, d, min } = localParts(at);
  return { date: `${y}-${pad(m)}-${pad(d)}`, time: `${pad(Math.floor(min / 60))}:${pad(min % 60)}` };
}

const FEASIBILITY = {
  viavel: { label: "Funciona no horário", cls: "text-fg-success" },
  "nao-verificado": { label: "Horário não verificado", cls: "text-fg-warning" },
  inviavel: { label: "Não funciona no horário", cls: "text-fg-danger" },
  "sem-horario": { label: "", cls: "" },
} as const;

/** Campo de estação: a escolhida (com "limpar") ou a busca. */
function StationField({
  label,
  value,
  onChange,
  extra,
}: {
  label: string;
  value: string | null;
  onChange: (slug: string | null) => void;
  extra?: React.ReactNode;
}) {
  const st = value ? stationBySlug.get(value) : null;
  if (!st) {
    return (
      <div className="flex flex-col gap-0.5">
        <StationCombobox label={label} onPick={onChange} />
        {extra}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase text-ink-muted">{label}</span>
      <div className="flex min-h-control items-center justify-between gap-1 border-b border-ink">
        <span className="flex min-w-0 items-center gap-1 text-base font-bold">
          <span className="truncate">{st.nome}</span>
          <span className="flex shrink-0 gap-0.5">
            {st.linhas.map((l) => (
              <LineBadge key={l} line={l} size="sm" />
            ))}
          </span>
        </span>
        <IconButton variant="plain" label={`Limpar ${label.toLowerCase()} (${st.nome})`} onClick={() => onChange(null)}>
          {Icons.close}
        </IconButton>
      </div>
    </div>
  );
}

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

const summaryOf = (r: Route) =>
  `${r.minutos} min, ${r.baldeacoes === 0 ? "sem baldeação" : `${r.baldeacoes} baldeaç${r.baldeacoes > 1 ? "ões" : "ão"}`}`;

export function RouteResult({ route, acessivel }: { route: Route; acessivel?: boolean }) {
  const prefs = usePrefs();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xl font-bold">
        ~{route.minutos} min
        <span className="ml-1 text-base font-normal text-ink-muted">
          · {route.baldeacoes === 0 ? "sem baldeação" : `${route.baldeacoes} baldeaç${route.baldeacoes > 1 ? "ões" : "ão"}`}
          {route.partida && route.chegada && ` · ${formatTime(route.partida)} → ${formatTime(route.chegada)}`}
        </span>
      </p>
      {prefs.voz && <RouteSpeech key={route.id} route={route} detalhe={prefs.detalheVoz} />}
      <ol className="flex flex-col" aria-label="Trechos da viagem">
        {route.legs.map((leg, i) => {
          const line = lineById.get(leg.linha)!;
          const first = stationBySlug.get(leg.estacoes[0])!;
          const last = stationBySlug.get(leg.estacoes[leg.estacoes.length - 1])!;
          return (
            <li key={i} className="relative flex gap-2 pb-2">
              <span aria-hidden className="absolute bottom-0 left-[15px] top-4 w-1" style={{ backgroundColor: line.cor }} />
              <LineBadge line={leg.linha} />
              <div className="min-w-0 flex-1">
                <p className="text-base">
                  {leg.partida && <span className="mr-0.5 font-semibold tabular-nums">{formatTime(leg.partida)}</span>}
                  {i === 0 ? "Embarque em" : "Baldeação em"} <strong>{first.nome}</strong>
                </p>
                <p className="text-sm text-ink-muted">
                  {line.nome}
                  {leg.alternativas?.length ? ` (ou ${leg.alternativas.map((l) => lineById.get(l)?.nome).join(", ")})` : ""}
                  {leg.sentido ? `, sentido ${leg.sentido}` : ""} · {leg.estacoes.length - 1} estaç
                  {leg.estacoes.length - 1 > 1 ? "ões" : "ão"} · ~{leg.minutos} min
                </p>
                <details className="text-sm">
                  <summary className="inline-flex min-h-control cursor-pointer items-center text-ink-muted underline">ver estações</summary>
                  <ol className="flex flex-col">
                    {leg.estacoes.map((s) => (
                      <li key={s}>{stationBySlug.get(s)?.nome}</li>
                    ))}
                  </ol>
                </details>
                {i === route.legs.length - 1 && (
                  <p className="mt-1 text-base">
                    {leg.chegada && <span className="mr-0.5 font-semibold tabular-nums">{formatTime(leg.chegada)}</span>}
                    Desembarque em <strong>{last.nome}</strong>
                  </p>
                )}
              </div>
            </li>
          );
        })}
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
        Tempo estimado pelo traçado (velocidade média por tipo de linha e 30 s por parada; cada baldeação conta 5 min, já com
        a espera). Não usa grade de partidas nem lotação. Horários conferidos só onde há fonte oficial.
      </p>
    </div>
  );
}

/**
 * Planejador completo: origem e destino (texto ou voz), inverter, horário de partida ou chegada,
 * preferência de acessibilidade, alternativas e o detalhe da escolhida. `onRoute` avisa o mapa.
 */
export function RoutePlanner({
  initialFrom = null,
  initialTo = null,
  onRoute,
  showMapLink = true,
}: {
  initialFrom?: string | null;
  initialTo?: string | null;
  onRoute?: (route: Route | null, from: string | null, to: string | null) => void;
  showMapLink?: boolean;
}) {
  const prefs = usePrefs();
  const ids = useId();
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  const [whenMode, setWhenMode] = useState<WhenMode>("agora");
  // "Agora" é o instante da última ação de quem usa (não muda sozinho enquanto a pessoa lê).
  const [now, setNow] = useState(() => new Date());
  const [date, setDate] = useState(() => localInputs(now).date);
  const [time, setTime] = useState(() => localInputs(now).time);
  const [acessivel, setAcessivel] = useState(false);
  const [selected, setSelected] = useState(0);
  const [voiceNote, setVoiceNote] = useState("");

  const request = (f: string | null, t: string | null, mode = whenMode, d = date, h = time, a = acessivel, n = now): PlanRequest | null => {
    if (!f || !t) return null;
    const at = mode === "agora" ? n : fromLocal(d, h);
    const when = Number.isNaN(at.getTime()) ? null : { mode: mode === "chegar" ? ("chegar" as const) : ("partir" as const), at };
    return { from: f, to: t, when, acessivel: a };
  };
  const result: PlanResult | null = useMemo(() => {
    const req = request(from, to);
    return req ? planRoutes(req) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, whenMode, date, time, acessivel, now]);
  const routes = result?.status === "ok" ? result.routes : [];
  const route = routes[Math.min(selected, routes.length - 1)] ?? null;

  const { state: geo, request: requestGeo } = useGeolocation((lngLat) => {
    const first = nearestStations(lngLat, 1)[0];
    if (first) update({ f: first.slug });
  });

  /** Toda mudança passa por aqui: recalcula, avisa o mapa e (se pedido) toca o bipe. */
  function update(p: { f?: string | null; t?: string | null; mode?: WhenMode; d?: string; h?: string; a?: boolean }) {
    const f = p.f !== undefined ? p.f : from;
    const t = p.t !== undefined ? p.t : to;
    const mode = p.mode ?? whenMode;
    const n = new Date();
    setFrom(f);
    setTo(t);
    setNow(n);
    setSelected(0);
    if (p.mode) setWhenMode(p.mode);
    if (p.d !== undefined) setDate(p.d);
    if (p.h !== undefined) setTime(p.h);
    if (p.a !== undefined) setAcessivel(p.a);
    const req = request(f, t, mode, p.d ?? date, p.h ?? time, p.a ?? acessivel, n);
    const res = req ? planRoutes(req) : null;
    const best = res?.status === "ok" ? res.routes[0] : null;
    onRoute?.(best, f, t);
    if (prefs.sons && best?.avisos.some((x) => x.nivel !== "info")) beep();
  }

  function choose(i: number) {
    setSelected(i);
    onRoute?.(routes[i] ?? null, from, to);
  }

  const status =
    !from || !to
      ? ""
      : result?.status === "mesma-estacao"
        ? "Origem e destino são a mesma estação."
        : result?.status === "sem-caminho"
          ? "Não há caminho em operação entre essas estações."
          : routes.length
            ? `${routes.length} ${routes.length > 1 ? "opções" : "opção"} de rota. Mais indicada: ${summaryOf(routes[0])}.`
            : "";

  const seg = "inline-flex h-control flex-1 cursor-pointer items-center justify-center px-1 text-sm font-semibold text-ink-muted has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--focus)";

  return (
    <div className="flex flex-col gap-2">
      <VoiceRouteButton
        onIntent={(intent, heard) => {
          const f = intent.de?.slug ?? from;
          const t = intent.para?.slug ?? to;
          update({ f, t });
          setVoiceNote(
            intent.naoEntendido.length
              ? `Não reconheci “${intent.naoEntendido.join("” nem “")}” como estação. Escolha pelo nome.`
              : !intent.de && !intent.para
                ? `Não encontrei estações em “${heard}”.`
                : "",
          );
        }}
      />
      {voiceNote && <p className="text-sm text-fg-warning">{voiceNote}</p>}

      <div className="flex items-end gap-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <StationField
            label="De"
            value={from}
            onChange={(s) => update({ f: s })}
            extra={
              <button type="button" onClick={requestGeo} className="inline-flex min-h-control items-center self-start text-sm font-semibold underline">
                {geo.status === "locating" ? "Procurando…" : "Usar a estação mais perto de mim"}
              </button>
            }
          />
          {geo.status === "error" && <p className="text-sm text-ink-muted">{GEO_MESSAGES[geo.reason]}</p>}
          <StationField label="Para" value={to} onChange={(s) => update({ t: s })} />
        </div>
        <IconButton variant="plain" label="Inverter origem e destino" onClick={() => update({ f: to, t: from })} className="mb-0.5">
          {Icons.swap}
        </IconButton>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-0.5 text-xs font-semibold uppercase text-ink-muted">Quando</legend>
        <div className="flex overflow-hidden border border-rule-strong" style={{ borderRadius: "var(--radius-control)" }}>
          {(
            [
              ["agora", "Sair agora"],
              ["partir", "Sair às"],
              ["chegar", "Chegar até"],
            ] as const
          ).map(([m, label]) => (
            <label key={m} className={seg}>
              <input type="radio" name={`${ids}-quando`} className="sr-only" checked={whenMode === m} onChange={() => update({ mode: m })} />
              {label}
            </label>
          ))}
        </div>
        {whenMode !== "agora" && (
          <div className="flex gap-1">
            <label className="flex flex-1 flex-col text-xs text-ink-muted">
              Data
              <input
                type="date"
                value={date}
                onChange={(e) => update({ d: e.target.value })}
                className="h-control border-b border-rule bg-transparent text-base text-ink focus:border-ink focus:outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col text-xs text-ink-muted">
              Hora
              <input
                type="time"
                value={time}
                onChange={(e) => update({ h: e.target.value })}
                className="h-control border-b border-rule bg-transparent text-base text-ink focus:border-ink focus:outline-none"
              />
            </label>
          </div>
        )}
        <p className="text-xs text-ink-muted">Horário de São Paulo.</p>
      </fieldset>

      <label className="flex min-h-control cursor-pointer items-start gap-1 text-sm">
        <input type="checkbox" checked={acessivel} onChange={(e) => update({ a: e.target.checked })} className="mt-0.5 size-icon shrink-0 accent-(--ink)" />
        <span>
          <span className="font-semibold">Priorizar estações acessíveis</span>
          <span className="block text-xs text-ink-muted">
            Usa a marcação do OpenStreetMap, que não cobre todas as estações — confirme com a operadora.
          </span>
        </span>
      </label>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {!from || !to ? (
        <p className="text-sm text-ink-muted">Escolha a origem e o destino — pelo nome, pelo microfone ou pela sua localização.</p>
      ) : result?.status === "mesma-estacao" || result?.status === "sem-caminho" ? (
        <p className="text-base" role="alert">
          {status}
        </p>
      ) : null}

      {routes.length > 1 && (
        <fieldset>
          <legend className="mb-0.5 text-xs font-semibold uppercase text-ink-muted">Opções</legend>
          <div className="flex flex-col gap-1">
            {routes.map((r, i) => {
              const f = FEASIBILITY[r.viabilidade];
              return (
                <label
                  key={r.id}
                  className="flex min-h-control cursor-pointer items-center gap-1 border border-rule px-1.5 py-1 has-[:checked]:border-ink has-[:checked]:bg-ink/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--focus)"
                  style={{ borderRadius: "var(--radius-card)" }}
                >
                  <input type="radio" name={`${ids}-opcao`} className="sr-only" checked={route?.id === r.id} onChange={() => choose(i)} />
                  <span className="flex flex-1 flex-col">
                    <span className="text-base font-bold">
                      {r.minutos} min
                      <span className="ml-0.5 font-normal text-ink-muted">
                        {r.partida && r.chegada ? ` · ${formatTime(r.partida)} → ${formatTime(r.chegada)}` : ""} ·{" "}
                        {r.baldeacoes === 0 ? "direta" : `${r.baldeacoes} baldeaç${r.baldeacoes > 1 ? "ões" : "ão"}`}
                      </span>
                    </span>
                    {f.label && <span className={`text-xs font-semibold ${f.cls}`}>{f.label}</span>}
                  </span>
                  <span className="flex shrink-0 gap-0.5" aria-label={`Linhas: ${r.legs.map((l) => lineById.get(l.linha)?.nome).join(", ")}`}>
                    {r.legs.map((l, k) => (
                      <LineBadge key={k} line={l.linha} size="sm" />
                    ))}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {route && <RouteResult route={route} acessivel={acessivel} />}
      {route && <OfficialUpdates onlyLines={route.legs.map((l) => l.linha)} limit={3} />}
      {route && showMapLink && (
        <Link
          href={`/mapa?de=${from}&para=${to}`}
          className="inline-flex h-control items-center self-start bg-ink px-3 text-base font-semibold text-bg hover:opacity-85"
          style={{ borderRadius: "var(--radius-control)" }}
        >
          Ver no mapa
        </Link>
      )}
    </div>
  );
}
