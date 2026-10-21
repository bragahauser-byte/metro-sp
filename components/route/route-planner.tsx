"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { IconButton, Icons } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePrefs } from "@/components/ui/theme-toggle";
import { lineById, stationBySlug } from "@/components/map/network";
import { GEO_MESSAGES, useGeolocation } from "@/components/geo/use-geolocation";
import { OfficialUpdates } from "@/components/map/panels";
import { RouteSpeech, VoiceRouteButton } from "@/components/voice/voice-controls";
import { beep } from "@/components/voice/speech";
import { geocode } from "@/components/search/geocoder";
import {
  type Option,
  PlaceField,
  PlaceResults,
  type Spot,
  optionsOf,
  spotName,
  usePlaceSearch,
} from "@/components/search/place-search";
import { formatTime, fromLocal, localParts } from "@/lib/time/sao-paulo";
import { type Endpoint, type PlaceRouteResult, planPlaceRoute } from "@/lib/geo/place-route";
import { type LngLat, type Walk, formatDistance } from "@/lib/geo/walk";
import type { Place } from "@/lib/geo/photon";
import type { WalkLegs } from "@/lib/voice/describe-route";
import type { RouteIntent } from "@/lib/voice/parse-route";
import { type Notice, type PlanRequest, type PlanResult, type Route, planRoute, planRoutes, stationPoints } from "./plan";

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

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const transfers = (n: number) => (n === 0 ? "sem baldeação" : plural(n, "baldeação", "baldeações"));

/** Saída da origem → chegada ao destino, contando os trechos a pé (o motor só vê a rede). */
function doorTimes(r: Route, walkIn?: Walk | null, walkOut?: Walk | null): string {
  if (!r.partida || !r.chegada) return "";
  const from = new Date(r.partida.getTime() - (walkIn?.minutos ?? 0) * 60_000);
  const to = new Date(r.chegada.getTime() + (walkOut?.minutos ?? 0) * 60_000);
  return ` · ${formatTime(from)} → ${formatTime(to)}`;
}

/** O que o mapa precisa para desenhar: caminho na rede, marcadores e trechos a pé. */
export type RouteOutcome = {
  route: Route | null;
  from: Spot | null;
  to: Spot | null;
  board: string | null;
  alight: string | null;
  /** Só caminhada (lugares perto um do outro). */
  walkOnly: boolean;
};

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

/** Trecho a pé: tracejado, sempre rotulado como estimativa. */
function WalkStep({ walk, text }: { walk: Walk; text: React.ReactNode }) {
  return (
    <li className="relative flex gap-2 pb-2">
      <span aria-hidden className="absolute bottom-0 left-[15px] top-4 w-0 border-l-4 border-dotted border-ink-muted" />
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-ink-muted bg-surface text-ink">
        {Icons.walk}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base">{text}</p>
        <p className="text-sm text-ink-muted">
          a pé · cerca de {walk.minutos} min · ~{formatDistance(walk.distanciaM)} (estimativa)
        </p>
      </div>
    </li>
  );
}

export function RouteResult({
  route,
  acessivel,
  walkIn,
  walkOut,
  originName,
  destName,
}: {
  route: Route;
  acessivel?: boolean;
  walkIn?: Walk | null;
  walkOut?: Walk | null;
  originName?: string;
  destName?: string;
}) {
  const prefs = usePrefs();
  const total = route.minutos + (walkIn?.minutos ?? 0) + (walkOut?.minutos ?? 0);
  const walkLegs: WalkLegs = { walkIn, walkOut, destino: destName };
  const firstSt = stationBySlug.get(route.legs[0].estacoes[0])!;
  const lastSt = stationBySlug.get(route.legs.at(-1)!.estacoes.at(-1)!)!;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xl font-bold">
        ~{total} min
        <span className="ml-1 text-base font-normal text-ink-muted">
          · {transfers(route.baldeacoes)}
          {doorTimes(route, walkIn, walkOut)}
        </span>
      </p>
      {prefs.voz && <RouteSpeech key={route.id} route={route} detalhe={prefs.detalheVoz} walk={walkLegs} />}
      <ol className="flex flex-col" aria-label="Trechos da viagem">
        {walkIn && (
          <WalkStep
            walk={walkIn}
            text={
              <>
                {originName ? `De ${originName}, caminhe` : "Caminhe"} até a estação <strong>{firstSt.nome}</strong>
              </>
            }
          />
        )}
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
                  {leg.sentido ? `, sentido ${leg.sentido}` : ""} · {plural(leg.estacoes.length - 1, "estação", "estações")} · ~{leg.minutos}{" "}
                  min
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
        {walkOut && (
          <WalkStep
            walk={walkOut}
            text={
              <>
                Da estação {lastSt.nome}, caminhe até <strong>{destName ?? "o destino"}</strong>
              </>
            }
          />
        )}
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
        Tempo estimado pelo traçado (velocidade média por tipo de linha, 30 s por parada, 5 min por baldeação).
        {walkIn || walkOut ? " Trechos a pé: linha reta × 1,3 a 4,5 km/h — estimativa, não um caminho pelas ruas." : ""} Horários conferidos
        só onde há fonte oficial.
      </p>
    </div>
  );
}

type Computed =
  | { kind: "incompleto" }
  | { kind: "rede"; result: PlanResult }
  | { kind: "porta"; place: PlaceRouteResult<Route>; result: PlanResult | null };

const endpoint = (s: Spot): Endpoint => (s.kind === "station" ? s : { kind: "place", lngLat: s.lngLat, nome: s.nome });

function compute(from: Spot | null, to: Spot | null, when: PlanRequest["when"], acessivel: boolean): Computed {
  if (!from || !to) return { kind: "incompleto" };
  if (from.kind === "station" && to.kind === "station") return { kind: "rede", result: planRoutes({ from: from.slug, to: to.slug, when, acessivel }) };
  const place = planPlaceRoute(endpoint(from), endpoint(to), { stations: stationPoints, plan: (a, b) => planRoute(a, b, { acessivel }) });
  if (place.status !== "ok") return { kind: "porta", place, result: null };
  // Horário na estação: sair às X + caminhada; chegar até Y − caminhada final.
  const adj = when
    ? {
        mode: when.mode,
        at: new Date(when.at.getTime() + (when.mode === "partir" ? (place.walkIn?.minutos ?? 0) : -(place.walkOut?.minutos ?? 0)) * 60_000),
      }
    : null;
  return { kind: "porta", place, result: planRoutes({ from: place.board, to: place.alight, when: adj, acessivel }) };
}

function toOutcome(f: Spot | null, t: Spot | null, c: Computed, r: Route | null): RouteOutcome {
  const p = c.kind === "porta" ? c.place : null;
  return {
    route: r,
    from: f,
    to: t,
    board: p?.status === "ok" ? p.board : null,
    alight: p?.status === "ok" ? p.alight : null,
    walkOnly: p?.status === "a-pe",
  };
}

/** Rota aberta por link (?de=&para=): o mapa já desenha antes de o painel calcular. */
export function initialOutcome(from: Spot, to: Spot): RouteOutcome {
  const c = compute(from, to, null, false);
  const res = c.kind === "incompleto" ? null : c.result;
  return toOutcome(from, to, c, res?.status === "ok" ? res.routes[0] : null);
}

type Field = "from" | "to";

/**
 * Busca e rota: origem e destino podem ser estação, endereço, rua, CEP ou lugar (texto ou voz);
 * inverter, sair agora / sair às / chegar até, prioridade a estações acessíveis, alternativas e o
 * detalhe da escolhida. `onResult` avisa o mapa (caminho, marcadores e trechos a pé).
 */
export function RoutePlanner({
  initialFrom = null,
  initialTo = null,
  bias = null,
  onResult,
  onBack,
  autoFocus = false,
}: {
  initialFrom?: Spot | null;
  initialTo?: Spot | null;
  /** Centro do mapa (só sem GPS): dá preferência a lugares perto do que está na tela. */
  bias?: LngLat | null;
  onResult?: (o: RouteOutcome) => void;
  onBack?: () => void;
  autoFocus?: boolean;
}) {
  const prefs = usePrefs();
  const ids = useId();
  const [from, setFrom] = useState<Spot | null>(initialFrom);
  const [to, setTo] = useState<Spot | null>(initialTo);
  const [text, setText] = useState<Record<Field, string>>({ from: spotName(initialFrom), to: spotName(initialTo) });
  const [editing, setEditing] = useState<Field | null>(autoFocus ? (!initialTo ? "to" : "from") : null);
  const [active, setActive] = useState(0);
  const [whenMode, setWhenMode] = useState<WhenMode>("agora");
  const [now, setNow] = useState(() => new Date());
  const [date, setDate] = useState(() => localInputs(now).date);
  const [time, setTime] = useState(() => localInputs(now).time);
  const [acessivel, setAcessivel] = useState(false);
  const [selected, setSelected] = useState(0);
  const [voiceNote, setVoiceNote] = useState("");
  const [voiceChoices, setVoiceChoices] = useState<{ field: Field; heard: string; options: Place[] } | null>(null);
  const inputs = { from: useRef<HTMLInputElement>(null), to: useRef<HTMLInputElement>(null) };

  const q = editing ? text[editing] : "";
  const editingValue = editing === "from" ? from : editing === "to" ? to : null;
  // Com um valor escolhido, o texto é o nome dele: não busca de novo até a pessoa editar.
  const searching = editing !== null && !editingValue;
  const search = usePlaceSearch(searching ? q : "", bias, searching);
  const withGps = searching && editing === "from" && q.trim() === "";
  const options = searching ? optionsOf(search, withGps) : [];
  const listOpen = searching && (options.length > 0 || q.trim().length >= 2);
  const listId = `${ids}-lista`;

  const whenOf = (mode: WhenMode, d: string, h: string, n: Date): PlanRequest["when"] => {
    const at = mode === "agora" ? n : fromLocal(d, h);
    return Number.isNaN(at.getTime()) ? null : { mode: mode === "chegar" ? "chegar" : "partir", at };
  };
  const computed = useMemo(() => compute(from, to, whenOf(whenMode, date, time, now), acessivel), [from, to, whenMode, date, time, now, acessivel]);
  const result = computed.kind === "incompleto" ? null : computed.result;
  const routes = result?.status === "ok" ? result.routes : [];
  const route = routes[Math.min(selected, routes.length - 1)] ?? null;
  const place = computed.kind === "porta" ? computed.place : null;
  const door = place?.status === "ok" ? place : null;

  const { state: geo, request: requestGeo } = useGeolocation((lngLat) => {
    update({ f: { kind: "place", nome: "Sua localização", detalhe: "", tipo: "gps", lngLat } });
  });

  /** Toda mudança passa por aqui: recalcula, avisa o mapa e (se pedido) toca o bipe. */
  function update(p: { f?: Spot | null; t?: Spot | null; mode?: WhenMode; d?: string; h?: string; a?: boolean }) {
    const f = p.f !== undefined ? p.f : from;
    const t = p.t !== undefined ? p.t : to;
    const n = new Date();
    if (p.f !== undefined) {
      setFrom(f);
      setText((x) => ({ ...x, from: spotName(f) }));
    }
    if (p.t !== undefined) {
      setTo(t);
      setText((x) => ({ ...x, to: spotName(t) }));
    }
    setNow(n);
    setSelected(0);
    if (p.mode) setWhenMode(p.mode);
    if (p.d !== undefined) setDate(p.d);
    if (p.h !== undefined) setTime(p.h);
    if (p.a !== undefined) setAcessivel(p.a);
    const c = compute(f, t, whenOf(p.mode ?? whenMode, p.d ?? date, p.h ?? time, n), p.a ?? acessivel);
    const res = c.kind === "incompleto" ? null : c.result;
    const best = res?.status === "ok" ? res.routes[0] : null;
    onResult?.(toOutcome(f, t, c, best));
    if (prefs.sons && best?.avisos.some((x) => x.nivel !== "info")) beep();
  }

  function choose(i: number) {
    setSelected(i);
    onResult?.(toOutcome(from, to, computed, routes[i] ?? null));
  }

  function pick(field: Field, o: Option) {
    if (o.type === "gps") {
      requestGeo();
      setEditing(null);
      return;
    }
    const spot: Spot =
      o.type === "station"
        ? { kind: "station", slug: o.slug }
        : { kind: "place", nome: o.place.nome, detalhe: o.place.detalhe, tipo: o.place.tipo, lngLat: o.place.lngLat };
    setVoiceChoices(null);
    update(field === "from" ? { f: spot } : { t: spot });
    setActive(0);
    // Próximo campo vazio recebe o foco; com os dois preenchidos, a lista fecha.
    const other: Field = field === "from" ? "to" : "from";
    if (!(other === "to" ? to : from)) {
      setEditing(other);
      inputs[other].current?.focus();
    } else {
      setEditing(null);
      inputs[field].current?.blur();
    }
  }

  function onKey(field: Field) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" && options.length) {
        e.preventDefault();
        setActive((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp" && options.length) {
        e.preventDefault();
        setActive((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === "Enter" && listOpen && options[active]) {
        e.preventDefault();
        pick(field, options[active]);
      } else if (e.key === "Escape" && listOpen) {
        // Fecha só a lista; o Esc seguinte fecha o painel.
        e.preventDefault();
        e.stopPropagation();
        setEditing(null);
      }
    };
  }

  function setField(field: Field, t: string) {
    setActive(0);
    setEditing(field);
    // Editar o texto desfaz a escolha anterior.
    if ((field === "from" ? from : to) !== null) update(field === "from" ? { f: null } : { t: null });
    setText((x) => ({ ...x, [field]: t }));
  }

  async function onVoice(intent: RouteIntent, heard: string) {
    setVoiceChoices(null);
    const next: { f?: Spot | null; t?: Spot | null } = {};
    if (intent.de) next.f = { kind: "station", slug: intent.de.slug };
    if (intent.para) next.t = { kind: "station", slug: intent.para.slug };
    if (next.f !== undefined || next.t !== undefined) update(next);
    const pending: [Field, string][] = [];
    if (!intent.de && intent.deTexto) pending.push(["from", intent.deTexto]);
    if (!intent.para && intent.paraTexto) pending.push(["to", intent.paraTexto]);
    if (!pending.length) {
      setVoiceNote(!intent.de && !intent.para ? `Não entendi origem e destino em “${heard}”.` : "");
      return;
    }
    const notes: string[] = [];
    for (const [field, phrase] of pending) {
      try {
        const found = await geocode(phrase, bias, AbortSignal.timeout(6000));
        if (!found.length) {
          notes.push(`Não encontrei “${phrase}”. Digite o endereço.`);
          setText((x) => ({ ...x, [field]: phrase }));
          continue;
        }
        const first = found[0];
        update(field === "from" ? { f: { kind: "place", ...first } } : { t: { kind: "place", ...first } });
        notes.push(`Entendi “${phrase}” como ${first.nome}${first.detalhe ? `, ${first.detalhe}` : ""}.`);
        if (found.length > 1) setVoiceChoices({ field, heard: phrase, options: found.slice(0, 4) });
      } catch {
        notes.push(`A busca de endereços está indisponível; não consegui procurar “${phrase}”. Estações por voz continuam funcionando.`);
        setText((x) => ({ ...x, [field]: phrase }));
      }
    }
    setVoiceNote(notes.join(" "));
  }

  const status = !from || !to ? "" : routes.length ? `${routes.length} ${routes.length > 1 ? "opções" : "opção"} de rota.` : "";
  const seg =
    "inline-flex h-control flex-1 cursor-pointer items-center justify-center px-1 text-sm font-semibold text-ink-muted has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--focus)";
  const activeId = options[active] ? `${listId}-${active}` : undefined;

  const problem =
    computed.kind === "rede" && result?.status === "mesma-estacao"
      ? "Origem e destino são a mesma estação."
      : computed.kind === "rede" && result?.status === "sem-caminho"
        ? "Não há caminho em operação entre essas estações."
        : place?.status === "mesmo-lugar"
          ? "Origem e destino são o mesmo lugar."
          : place?.status === "fora-da-area"
            ? `${place.lado === "ambos" ? "Origem e destino estão" : place.lado === "origem" ? "A origem está" : "O destino está"} a mais de 5 km de qualquer estação em operação. Não dá para montar uma rota sobre trilhos daqui — use ônibus ou outro meio até a rede.`
            : place?.status === "sem-caminho"
              ? "Não encontramos caminho em operação entre as estações perto desses lugares."
              : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho: voltar, título e microfone. */}
      <div className="relative flex items-center gap-1">
        {onBack && (
          <IconButton variant="plain" onClick={onBack} label="Voltar" className="-ml-1.5">
            {Icons.back}
          </IconButton>
        )}
        <h2 className="flex-1 text-lg font-bold">Buscar rota</h2>
        <VoiceRouteButton compact onIntent={onVoice} />
      </div>
      {voiceNote && (
        <p className="-mt-2 text-sm text-ink-muted" role="status">
          {voiceNote}
        </p>
      )}
      {voiceChoices && (
        <div className="-mt-1 flex flex-col gap-1">
          <p className="text-sm font-semibold">Não é esse? Outras opções para “{voiceChoices.heard}”:</p>
          <ul className="flex flex-col">
            {voiceChoices.options.slice(1).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex min-h-control w-full flex-col justify-center text-left hover:underline"
                  onClick={() => pick(voiceChoices.field, { type: "place", place: p })}
                >
                  <span className="text-base font-semibold">{p.nome}</span>
                  {p.detalhe && <span className="text-xs text-ink-muted">{p.detalhe}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Origem e destino agrupados, ligados por uma linha, com o botão de inverter ao lado. */}
      <div className="flex items-center gap-1 border border-rule bg-surface pl-1" style={{ borderRadius: "var(--radius-card)" }}>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <span aria-hidden className="absolute left-[11px] top-[30px] bottom-[30px] border-l-2 border-dotted border-ink-muted" />
          <PlaceField
            id={`${ids}-de`}
            label="Origem"
            placeholder="De onde? Estação, endereço ou lugar"
            text={text.from}
            onText={(t) => setField("from", t)}
            onClear={() => {
              update({ f: null });
              setEditing("from");
              inputs.from.current?.focus();
            }}
            onFocus={() => {
              setEditing("from");
              setActive(0);
            }}
            onKeyDown={onKey("from")}
            expanded={listOpen && editing === "from"}
            listId={listId}
            activeId={activeId}
            inputRef={inputs.from}
            autoFocus={autoFocus && editing === "from" && !initialFrom}
            marker={<span className="size-1.5 rounded-full border-[3px] border-fg-link bg-surface" />}
          />
          <span aria-hidden className="ml-4 border-t border-rule" />
          <PlaceField
            id={`${ids}-para`}
            label="Destino"
            placeholder="Para onde?"
            text={text.to}
            onText={(t) => setField("to", t)}
            onClear={() => {
              update({ t: null });
              setEditing("to");
              inputs.to.current?.focus();
            }}
            onFocus={() => {
              setEditing("to");
              setActive(0);
            }}
            onKeyDown={onKey("to")}
            expanded={listOpen && editing === "to"}
            listId={listId}
            activeId={activeId}
            inputRef={inputs.to}
            autoFocus={autoFocus && !initialTo}
            marker={<span className="text-fg-danger">{Icons.pin}</span>}
          />
        </div>
        <IconButton variant="plain" label="Inverter origem e destino" onClick={() => update({ f: to, t: from })}>
          {Icons.swap}
        </IconButton>
      </div>
      {geo.status === "locating" && <p className="-mt-2 text-sm text-ink-muted">Procurando sua localização…</p>}
      {geo.status === "error" && <p className="-mt-2 text-sm text-ink-muted">{GEO_MESSAGES[geo.reason]}</p>}

      {listOpen ? (
        <PlaceResults
          listId={listId}
          label={editing === "from" ? "Resultados para a origem" : "Resultados para o destino"}
          state={search}
          options={options}
          active={active}
          onHover={setActive}
          onPick={(o) => pick(editing!, o)}
        />
      ) : (
        <>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-semibold uppercase text-ink-muted">Quando · horário de São Paulo</legend>
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
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-w-0 flex-col text-xs text-ink-muted">
                  Data
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => update({ d: e.target.value })}
                    className="h-control w-full min-w-0 border-b border-rule bg-transparent text-base text-ink focus:border-ink focus:outline-none"
                  />
                </label>
                <label className="flex min-w-0 flex-col text-xs text-ink-muted">
                  Hora
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => update({ h: e.target.value })}
                    className="h-control w-full min-w-0 border-b border-rule bg-transparent text-base text-ink focus:border-ink focus:outline-none"
                  />
                </label>
              </div>
            )}
          </fieldset>

          <Switch checked={acessivel} onChange={(a) => update({ a })} hint="Marcação do OpenStreetMap, que não cobre todas as estações.">
            Priorizar estações acessíveis
          </Switch>

          <p role="status" aria-live="polite" className="sr-only">
            {status}
          </p>

          {!from || !to ? (
            <p className="text-sm text-ink-muted">
              Digite uma estação, um endereço, um CEP ou o nome de um lugar — ou toque no microfone e diga, por exemplo, “de Rua
              Otávio Alves Dundas até Shopping Eldorado”.
            </p>
          ) : problem ? (
            <p className="text-base" role="alert">
              {problem}
            </p>
          ) : place?.status === "a-pe" ? (
            <div className="flex flex-col gap-1" role="status">
              <p className="text-xl font-bold">Vá a pé: ~{place.walk.minutos} min</p>
              <p className="text-base">
                {spotName(from)} e {spotName(to)} ficam a cerca de {formatDistance(place.walk.distanciaM)} um do outro — mais rápido
                que entrar no metrô.
              </p>
              <p className="text-xs text-ink-muted">Estimativa em linha reta × 1,3 a 4,5 km/h, não um caminho pelas ruas.</p>
            </div>
          ) : null}

          {routes.length > 1 && (
            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase text-ink-muted">Opções</legend>
              <div className="flex flex-col gap-1">
                {routes.map((r, i) => {
                  const f = FEASIBILITY[r.viabilidade];
                  const walkMin = (door?.walkIn?.minutos ?? 0) + (door?.walkOut?.minutos ?? 0);
                  return (
                    <label
                      key={r.id}
                      className="flex min-h-control cursor-pointer items-center gap-1 border border-rule px-1.5 py-1 has-[:checked]:border-ink has-[:checked]:bg-ink/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--focus)"
                      style={{ borderRadius: "var(--radius-card)" }}
                    >
                      <input type="radio" name={`${ids}-opcao`} className="sr-only" checked={route?.id === r.id} onChange={() => choose(i)} />
                      <span className="flex flex-1 flex-col">
                        <span className="text-base font-bold">
                          {r.minutos + walkMin} min
                          <span className="ml-0.5 font-normal text-ink-muted">
                            {doorTimes(r, door?.walkIn, door?.walkOut)} ·{" "}
                            {r.baldeacoes === 0 ? "direta" : transfers(r.baldeacoes)}
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

          {route && (
            <RouteResult
              route={route}
              acessivel={acessivel}
              walkIn={door?.walkIn}
              walkOut={door?.walkOut}
              originName={from?.kind === "place" ? from.nome : undefined}
              destName={to?.kind === "place" ? to.nome : undefined}
            />
          )}
          {route && <OfficialUpdates onlyLines={route.legs.map((l) => l.linha)} limit={3} />}
        </>
      )}
    </div>
  );
}

