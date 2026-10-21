"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { IconButton, Icons } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePrefs } from "@/components/ui/theme-toggle";
import { lineById, stationBySlug } from "@/components/map/network";
import { GEO_MESSAGES, useGeolocation } from "@/components/geo/use-geolocation";
import type { Permission } from "@/components/geo/location";
import { LocationHowTo, UseLocationButton } from "@/components/geo/location-help";
import { OfficialUpdates } from "@/components/map/panels";
import { VoiceRouteButton } from "@/components/voice/voice-controls";
import { type FocusStep, RouteSteps, doorTimes, transfers } from "./route-steps";
import { nearestToNetwork } from "@/lib/geo/nearest";
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
import { fromLocal, localParts } from "@/lib/time/sao-paulo";
import { type Endpoint, type PlaceRouteResult, planPlaceRoute } from "@/lib/geo/place-route";
import { type LngLat, formatDistance } from "@/lib/geo/walk";
import type { Place } from "@/lib/geo/photon";
import type { RouteIntent } from "@/lib/voice/parse-route";
import { type PlanRequest, type PlanResult, type Route, planRoute, planRoutes, stationPoints } from "./plan";

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

/** O que o mapa precisa para desenhar: caminho na rede, marcadores e trechos a pé. */
export type RouteOutcome = {
  route: Route | null;
  from: Spot | null;
  to: Spot | null;
  board: string | null;
  alight: string | null;
  /** Só caminhada (lugares perto um do outro). */
  walkOnly: boolean;
  /** Resumo da rota escolhida, para a folha recolhida do celular. */
  summary: RouteSummary | null;
};

export type RouteSummary = { minutos: number; horario: string; baldeacoes: number; linhas: string[]; aPe: boolean };

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
  const ok = p?.status === "ok" ? p : null;
  const summary: RouteSummary | null =
    p?.status === "a-pe"
      ? { minutos: p.walk.minutos, horario: "", baldeacoes: 0, linhas: [], aPe: true }
      : r
        ? {
            minutos: r.minutos + (ok?.walkIn?.minutos ?? 0) + (ok?.walkOut?.minutos ?? 0),
            horario: doorTimes(r, ok?.walkIn, ok?.walkOut),
            baldeacoes: r.baldeacoes,
            linhas: r.legs.map((l) => l.linha),
            aPe: false,
          }
        : null;
  return {
    route: r,
    from: f,
    to: t,
    board: p?.status === "ok" ? p.board : null,
    alight: p?.status === "ok" ? p.alight : null,
    walkOnly: p?.status === "a-pe",
    summary,
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
 *
 * Como no Google Maps e no Apple Maps: com origem e destino, primeiro aparecem as opções de rota;
 * tocar numa delas a escolhe (`onChosen`: no celular a folha desce e o mapa mostra a rota) e o
 * painel passa ao passo a passo, com "Outras rotas" para voltar à lista.
 */
export function RoutePlanner({
  initialFrom = null,
  initialTo = null,
  bias = null,
  onResult,
  onBack,
  autoFocus = false,
  here = null,
  permission = "unknown",
  gpsSpot,
  onFocusStep,
  onChosen,
}: {
  initialFrom?: Spot | null;
  initialTo?: Spot | null;
  /** Centro do mapa (só sem GPS): dá preferência a lugares perto do que está na tela. */
  bias?: LngLat | null;
  /** Sua posição (só no aparelho): origem padrão e ordem dos resultados. */
  here?: LngLat | null;
  permission?: Permission;
  /** Monta a ponta "Sua localização" (com a estação mais próxima no detalhe). */
  gpsSpot?: (ll: LngLat) => Spot;
  /** Toque num passo: o mapa vai até ele. */
  onFocusStep?: (f: FocusStep) => void;
  onResult?: (o: RouteOutcome) => void;
  /** Tocou numa opção de rota (ou em "Ver no mapa" quando é a pé). */
  onChosen?: (o: RouteOutcome) => void;
  onBack?: () => void;
  autoFocus?: boolean;
}) {
  const prefs = usePrefs();
  const ids = useId();
  const mkGps = (ll: LngLat): Spot => gpsSpot?.(ll) ?? { kind: "place", nome: "Sua localização", detalhe: "", tipo: "gps", lngLat: ll };
  // Origem padrão: sua localização, se o navegador já liberou.
  const startFrom = initialFrom ?? (here ? mkGps(here) : null);
  const [from, setFrom] = useState<Spot | null>(startFrom);
  const [to, setTo] = useState<Spot | null>(initialTo);
  const [text, setText] = useState<Record<Field, string>>({ from: spotName(startFrom), to: spotName(initialTo) });
  const [gpsHelp, setGpsHelp] = useState(false);
  const [editing, setEditing] = useState<Field | null>(autoFocus ? (!initialTo ? "to" : "from") : null);
  const [active, setActive] = useState(0);
  const [whenMode, setWhenMode] = useState<WhenMode>("agora");
  const [now, setNow] = useState(() => new Date());
  const [date, setDate] = useState(() => localInputs(now).date);
  const [time, setTime] = useState(() => localInputs(now).time);
  const [acessivel, setAcessivel] = useState(false);
  const [selected, setSelected] = useState(0);
  const [stage, setStage] = useState<"opcoes" | "detalhe">("opcoes");
  const [voiceNote, setVoiceNote] = useState("");
  const [voiceChoices, setVoiceChoices] = useState<{ field: Field; heard: string; options: Place[] } | null>(null);
  const inputs = { from: useRef<HTMLInputElement>(null), to: useRef<HTMLInputElement>(null) };

  const q = editing ? text[editing] : "";
  const editingValue = editing === "from" ? from : editing === "to" ? to : null;
  // Com um valor escolhido, o texto é o nome dele: não busca de novo até a pessoa editar.
  const searching = editing !== null && !editingValue;
  const search = usePlaceSearch(searching ? q : "", bias, searching, here);
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
    update({ f: mkGps(lngLat) });
  });
  const blocked = permission === "denied" || (geo.status === "error" && geo.reason === "denied");
  const takeMyLocation = () => {
    if (blocked) {
      setGpsHelp(true);
      return;
    }
    if (here) update({ f: mkGps(here) });
    else requestGeo();
  };

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
    setStage("opcoes");
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
    const o = toOutcome(from, to, computed, routes[i] ?? null);
    setSelected(i);
    setStage("detalhe");
    onResult?.(o);
    onChosen?.(o);
  }

  function pick(field: Field, o: Option) {
    if (o.type === "gps") {
      takeMyLocation();
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

  // Mais de 3 km da rede: avisa e mostra a estação mais próxima mesmo assim.
  const far = (["from", "to"] as const).flatMap((field) => {
    const s = field === "from" ? from : to;
    if (s?.kind !== "place") return [];
    const n = nearestToNetwork(s.lngLat, stationPoints);
    return n?.longe ? [{ field, ...n }] : [];
  });

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
            ? `${place.lado === "ambos" ? "Origem e destino estão" : place.lado === "origem" ? "A origem está" : "O destino está"} a mais de 5 km de qualquer estação em operação — longe demais para ir a pé. Use ônibus ou outro meio até a rede.`
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
        <h2 className="flex-1 text-lg font-bold">{routes.length && !listOpen ? (stage === "detalhe" ? "Sua rota" : "Rotas") : "Buscar rota"}</h2>
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
      {geo.status === "error" && !from && <p className="-mt-2 text-sm text-ink-muted">{GEO_MESSAGES[geo.reason]}</p>}
      {!from && !listOpen ? (
        <UseLocationButton permission={permission} geo={geo} onUse={takeMyLocation} help={gpsHelp} onHelp={setGpsHelp} />
      ) : (
        gpsHelp && blocked && <LocationHowTo />
      )}
      {far.map((f) => (
        <div key={f.field} className="-mt-1 flex flex-col gap-0.5 border-l-4 border-fg-warning pl-1 text-sm" role="note">
          <p>
            {f.field === "from" ? "A origem fica" : "O destino fica"} a ~{formatDistance(f.walk.retaM)} em linha reta da estação mais próxima,{" "}
            <strong>{stationBySlug.get(f.slug)?.nome}</strong> — longe da rede. A pé seria mais de {f.walk.minutos} min; considere ônibus ou
            outro meio nesse trecho.
          </p>
          <button
            type="button"
            className="min-h-control self-start font-semibold text-fg-link"
            onClick={() => update(f.field === "from" ? { f: { kind: "station", slug: f.slug } } : { t: { kind: "station", slug: f.slug } })}
          >
            Usar a estação {stationBySlug.get(f.slug)?.nome} como {f.field === "from" ? "origem" : "destino"}
          </button>
        </div>
      ))}

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
              {onChosen && (
                <button
                  type="button"
                  className="min-h-control self-start font-semibold text-fg-link"
                  onClick={() => onChosen(toOutcome(from, to, computed, null))}
                >
                  Ver no mapa
                </button>
              )}
            </div>
          ) : null}

          {route && stage === "detalhe" && (
            <>
              {routes.length > 1 && (
                <button
                  type="button"
                  onClick={() => setStage("opcoes")}
                  className="-mt-1 flex min-h-control items-center gap-0.5 self-start text-sm font-semibold text-fg-link"
                >
                  <span aria-hidden>{Icons.back}</span>
                  Outras rotas ({routes.length})
                </button>
              )}
              <RouteSteps
                route={route}
                acessivel={acessivel}
                walkIn={door?.walkIn}
                walkOut={door?.walkOut}
                from={from}
                to={to}
                onFocusStep={onFocusStep}
              />
            </>
          )}
          {routes.length > 0 && stage === "opcoes" && (
            <section aria-labelledby={`${ids}-opcoes`} className="flex flex-col gap-1">
              <h3 id={`${ids}-opcoes`} className="text-sm text-ink-muted">
                {routes.length > 1 ? `${routes.length} opções` : "1 opção"} · toque para ver no mapa
              </h3>
              <ul className="flex flex-col gap-1">
                {routes.map((r, i) => {
                  const f = FEASIBILITY[r.viabilidade];
                  const walkMin = (door?.walkIn?.minutos ?? 0) + (door?.walkOut?.minutos ?? 0);
                  const times = doorTimes(r, door?.walkIn, door?.walkOut);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        data-route-option
                        onClick={() => choose(i)}
                        className="flex min-h-control-lg w-full items-center gap-1.5 border border-rule bg-surface p-1.5 text-left transition-colors hover:bg-ink/5 active:bg-ink/10"
                        style={{ borderRadius: "var(--radius-card)" }}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className="flex flex-wrap items-center gap-0.5"
                            aria-label={`Linhas: ${r.legs.map((l) => lineById.get(l.linha)?.nome).join(", ")}`}
                          >
                            {r.legs.map((l, k) => (
                              <span key={k} className="flex items-center gap-0.5">
                                {k > 0 && (
                                  <span aria-hidden className="text-xs text-ink-muted">
                                    ›
                                  </span>
                                )}
                                <LineBadge line={l.linha} size="sm" />
                              </span>
                            ))}
                          </span>
                          <span className="text-sm text-ink-muted">
                            {times ? `${times} · ` : ""}
                            {r.baldeacoes === 0 ? "direta" : transfers(r.baldeacoes)}
                            {walkMin > 0 ? ` · ${walkMin} min a pé` : ""}
                          </span>
                          {i === 0 && <span className="text-xs font-semibold text-fg-success">Mais rápida</span>}
                          {f.label && r.viabilidade !== "viavel" && <span className={`text-xs font-semibold ${f.cls}`}>{f.label}</span>}
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className="text-xl font-bold">{r.minutos + walkMin}</span>
                          <span className="text-xs text-ink-muted">min</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {stage === "opcoes" && (
            <details className="group">
              <summary className="flex min-h-control cursor-pointer list-none items-center justify-between text-sm font-semibold text-fg-link">
                Horário e acessibilidade
                <span aria-hidden className="transition-transform group-open:rotate-180">
                  ⌄
                </span>
              </summary>
              <div className="flex flex-col gap-3 pt-1">
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
              </div>
            </details>
          )}
          {route && stage === "detalhe" && <OfficialUpdates onlyLines={route.legs.map((l) => l.linha)} limit={3} />}
        </>
      )}
    </div>
  );
}

