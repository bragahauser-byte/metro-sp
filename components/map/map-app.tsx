"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { IconButton, Icons } from "@/components/ui/button";
import { BetaTag } from "@/components/ui/site-chrome";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { StaticBadge } from "@/components/ui/static-badge";
import { nearestStations } from "@/components/geo/nearest";
import { useGeolocation } from "@/components/geo/use-geolocation";
import { type Route } from "@/components/route/plan";
import { type RouteOutcome, RoutePlanner, initialOutcome } from "@/components/route/route-planner";
import { type Spot, decodeSpot, encodeSpot } from "@/components/search/place-search";
import { FindView } from "@/components/search/find-view";
import { addRecent } from "@/components/search/recents";
import { useOps } from "@/components/ops/use-ops";
import { NowView, alertLines } from "@/components/ops/status-view";
import { AboutPanel } from "./about-panel";
import { BottomSheet, type Snap } from "./bottom-sheet";
import { notices } from "./line-notes";
import { type LngLat, RAIL_LINES, lineById, lines, stationBySlug } from "./network";
import type { WalkEnd } from "./network-renderer";
import { AlertsView, LineView, LinesGrid, NearView, StationView } from "./panels";
import { Splash } from "./splash";
import { type MapMode, SubwayMap, type SubwayMapHandle } from "./subway-map";

type Panel = "home" | "lines" | "line" | "station" | "near" | "alerts" | "now" | "find" | "search" | "sobre";

const DESKTOP = "(min-width: 768px)";
function subscribeDesktop(cb: () => void) {
  const mq = matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** Um só lugar para o conteúdo do painel: cartão no desktop, folha no celular. */
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => matchMedia(DESKTOP).matches, () => false);
}

// ---------------------------------------------------------------- peças

/** Modo do mapa. Real (traçado geográfico) vem primeiro e é o padrão. */
function ModeTabs({ mode, onChange }: { mode: MapMode; onChange: (m: MapMode) => void }) {
  const tabs: { id: MapMode; label: string; sub: string }[] = [
    { id: "real", label: "Real", sub: "traçado geográfico" },
    { id: "esquematico", label: "Esquemático", sub: "diagrama 45°/90°" },
  ];
  return (
    <div className="grid grid-cols-2 border-t border-rule" role="group" aria-label="Tipo de mapa">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={mode === t.id}
          onClick={() => onChange(t.id)}
          className="-mt-px min-h-control border-t-2 border-transparent pt-1 text-left aria-pressed:border-ink"
        >
          <span className={`block text-xs font-bold ${mode === t.id ? "text-ink" : "text-ink-muted"}`}>{t.label}</span>
          <span className="block text-xs text-ink-muted">{t.sub}</span>
        </button>
      ))}
    </div>
  );
}

/** Abre a busca (estação, endereço ou lugar). É um botão, como era o "Buscar estação". */
function SearchButton({ onClick, buttonRef, short = false }: { onClick: () => void; buttonRef?: React.Ref<HTMLButtonElement>; short?: boolean }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={short ? "Para onde? Buscar estação ou endereço" : undefined}
      className={`flex h-control min-w-0 shrink-0 items-center gap-1 bg-bg px-1.5 text-left text-base text-ink-muted hover:text-ink ${short ? "flex-1" : "w-full"}`}
      style={{ borderRadius: 999 }}
    >
      {Icons.search}
      <span className="truncate">{short ? "Para onde?" : "Buscar estação ou endereço"}</span>
    </button>
  );
}

function Brand({ onAbout }: { onAbout: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="inline-flex items-center gap-1" aria-label="Metrô, versão beta">
        <span aria-hidden className="text-lg font-bold">
          Metrô
        </span>
        <BetaTag />
      </p>
      <ThemeToggle onAbout={onAbout} />
    </div>
  );
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function AlertButton({ onClick, count, round = false }: { onClick: () => void; count: number; round?: boolean }) {
  return (
    <IconButton label={`Avisos (${count})`} onClick={onClick} style={round ? { borderRadius: 999 } : undefined}>
      <span aria-hidden className="inline-flex size-3 items-center justify-center rounded-full bg-line-4 text-base font-bold text-[#111]">
        !
      </span>
    </IconButton>
  );
}

/** Aviso de projeto não oficial + atribuição dos dados do mapa, sempre visíveis (exigência da ODbL). */
function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`flex-wrap items-center gap-x-2 bg-surface/90 px-2 py-0.5 text-xs text-ink-muted backdrop-blur ${className}`}>
      <span>
        Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo. Informações oficiais em{" "}
        <a className="underline" href="https://www.metro.sp.gov.br">
          metro.sp.gov.br
        </a>
        .
      </span>
      <span>
        <a className="underline" href="https://www.openstreetmap.org/copyright">
          © OpenStreetMap contributors
        </a>{" "}
        ·{" "}
        <a className="underline" href="https://openfreemap.org">
          OpenFreeMap
        </a>{" "}
        ·{" "}
        <a className="underline" href="https://www.openmaptiles.org">
          © OpenMapTiles
        </a>
      </span>
    </p>
  );
}

/** Botão de linhas do celular: a grade de pontos coloridos do Live Subway Map. */
function LinesButton({ onClick }: { onClick: () => void }) {
  // Classes escritas por extenso: o Tailwind só gera a cor de linha que aparece no código.
  const dots = ["bg-line-1", "bg-line-2", "bg-line-3", "bg-line-4", "bg-line-5", "bg-line-15", "bg-line-17", "bg-line-6", "bg-line-11"];
  return (
    <IconButton label="Linhas e tipo de mapa" onClick={onClick} className="rounded-full" style={{ borderRadius: 999 }}>
      <span aria-hidden className="grid grid-cols-3 gap-[3px]">
        {dots.map((d) => (
          <span key={d} className={`block size-[5px] rounded-full ${d}`} />
        ))}
      </span>
    </IconButton>
  );
}

// Relógio de minuto em minuto, sem quebrar a hidratação (no servidor não há hora).
const subscribeMinute = (cb: () => void) => {
  const id = setInterval(cb, 15_000);
  return () => clearInterval(id);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);
const clockFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** "Agora": hora de São Paulo e um resumo da situação das linhas. Abre o painel Agora. */
function NowPill({ onClick, alerts }: { onClick: () => void; alerts: number }) {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, () => 0);
  const clock = minute ? clockFmt.format(new Date(minute * 60_000)) : "";
  const sub = alerts > 0 ? `${alerts} ${alerts === 1 ? "linha com alteração" : "linhas com alteração"}` : clock ? `${clock} · ver situação` : "ver situação";
  return (
    <button
      type="button"
      onClick={onClick}
      className="pointer-events-auto flex h-control-lg min-w-[160px] flex-col items-center justify-center whitespace-nowrap bg-surface px-3 text-center"
      style={{ borderRadius: 999, boxShadow: "var(--shadow-card)", border: "1px solid var(--card-border)" }}
    >
      <span className="text-sm font-bold">Agora</span>
      <span className={`text-xs ${alerts > 0 ? "font-semibold text-fg-warning" : "text-ink-muted"}`}>{sub}</span>
    </button>
  );
}

// ---------------------------------------------------------------- app

function parseView(v: string | null): { center: LngLat; zoom: number } | null {
  if (!v) return null;
  const [lng, lat, zoom] = v.split(",").map(Number);
  if (![lng, lat, zoom].every(Number.isFinite)) return null;
  if (lng < -47.6 || lng > -45.6 || lat < -24.3 || lat > -22.8) return null;
  return { center: [lng, lat], zoom };
}

const TITLES: Record<Panel, string> = {
  home: "Linhas",
  lines: "Linhas",
  now: "Agora",
  find: "Buscar",
  line: "Linha",
  station: "Estação",
  near: "Perto de você",
  alerts: "Avisos",
  search: "Buscar rota",
  sobre: "Sobre",
};

export function MapApp() {
  const params = useSearchParams();
  const isDesktop = useIsDesktop();
  const [initial] = useState(() => {
    const line = params.get("linha");
    const station = params.get("estacao");
    const painel = params.get("painel");
    const from = decodeSpot(params.get("de"));
    const to = decodeSpot(params.get("para"));
    const selectedLine = line && lineById.has(line) ? line : null;
    const selectedStation = station && stationBySlug.has(station) ? station : null;
    const panel: Panel =
      from || to || painel === "busca" || painel === "rota"
        ? "search"
        : painel === "sobre"
          ? "sobre"
          : painel === "perto"
            ? "near"
            : painel === "avisos"
              ? "alerts"
              : painel === "agora"
                ? "now"
                : painel === "linhas"
                  ? "lines"
              : selectedStation
                ? "station"
                : selectedLine
                  ? "line"
                  : "home";
    const snap: Snap = panel === "search" ? "expandido" : panel !== "home" ? "meio" : "recolhido";
    return { selectedLine, selectedStation, panel, snap, from, to, view: parseView(params.get("v")) };
  });
  const initialView = initial.view;
  const [outcome, setOutcome] = useState<RouteOutcome | null>(() => (initial.from && initial.to ? initialOutcome(initial.from, initial.to) : null));
  // O modo Real é sempre o padrão; o esquemático só vem se o link pedir.
  const [mode, setMode] = useState<MapMode>(params.get("modo") === "esquematico" ? "esquematico" : "real");
  const [selectedLine, setSelectedLine] = useState<string | null>(initial.selectedLine);
  const [selectedStation, setSelectedStation] = useState<string | null>(initial.selectedStation);
  const [showRail, setShowRail] = useState(() => {
    const s = initial.selectedStation ? stationBySlug.get(initial.selectedStation) : null;
    return RAIL_LINES.has(initial.selectedLine ?? "") || Boolean(s && s.linhas.every((x) => RAIL_LINES.has(x)));
  });
  const [panel, setPanel] = useState<Panel>(initial.panel);
  const [snap, setSnap] = useState<Snap>(initial.snap);
  const [announcement, setAnnouncement] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [view, setView] = useState<{ center: LngLat; zoom: number } | null>(initialView);
  const [ready, setReady] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const mapRef = useRef<SubwayMapHandle>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const byUser = useRef(false);
  const restoreFocus = useRef(false);
  const pushed = useRef(false);
  const ignorePop = useRef(false);

  // Quando a localização chega: mira a estação mais próxima e enquadra você e ela.
  const { state: geo, request: requestGeo } = useGeolocation((lngLat) => {
    const first = nearestStations(lngLat, 1)[0];
    if (!first) return;
    setTarget(first.slug);
    const st = stationBySlug.get(first.slug)!;
    if (st.linhas.every((l) => RAIL_LINES.has(l))) setShowRail(true);
    setMode("real");
    mapRef.current?.focusPoints([lngLat, st.geo]);
  });

  const nearby = useMemo(() => (geo.status === "ok" ? nearestStations(geo.lngLat, 3) : []), [geo]);
  const user = geo.status === "ok" ? { lngLat: geo.lngLat, accuracy: geo.accuracy } : null;
  const ops = useOps();
  const changedLines = alertLines(ops);
  const alertCount = notices().length + changedLines;
  // Viés da busca de lugares: centro do mapa, só sem GPS (para não mandar sua posição a ninguém).
  const bias: LngLat | null = geo.status === "idle" && mode === "real" && view ? view.center : null;
  // "Buscar por perto": o centro da vista do mapa (no modo real), nunca a posição do GPS.
  const findNear: LngLat | null = mode === "real" ? (view?.center ?? [-46.6333, -23.5505]) : null;

  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setSplashGone(true), 450);
    return () => clearTimeout(id);
  }, [ready]);

  // Endereço compartilhável: modo, linha, estação, rota e a vista do mapa (?v=lng,lat,zoom).
  // Com o GPS ativo a vista NÃO vai para o endereço — ela revelaria onde você está.
  useEffect(() => {
    const u = new URLSearchParams();
    if (mode === "esquematico") u.set("modo", "esquematico");
    if (selectedLine) u.set("linha", selectedLine);
    if (selectedStation) u.set("estacao", selectedStation);
    if (panel === "search") {
      const de = encodeSpot(outcome?.from ?? null);
      const para = encodeSpot(outcome?.to ?? null);
      if (de) u.set("de", de);
      if (para) u.set("para", para);
      if (!de && !para) u.set("painel", "busca");
    }
    if (panel === "sobre") u.set("painel", "sobre");
    if (panel === "now") u.set("painel", "agora");
    if (view && geo.status === "idle") u.set("v", `${view.center[0].toFixed(4)},${view.center[1].toFixed(4)},${view.zoom.toFixed(1)}`);
    const qs = u.toString();
    window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);
  }, [mode, selectedLine, selectedStation, view, geo.status, panel, outcome]);

  // Botão voltar do aparelho: painel aberto (ou folha levantada) é uma entrada no histórico.
  const isOpen = panel !== "home" || (!isDesktop && snap !== "recolhido");
  useEffect(() => {
    if (isOpen && !pushed.current) {
      window.history.pushState({ mapaPainel: true }, "", window.location.href);
      pushed.current = true;
    } else if (!isOpen && pushed.current) {
      pushed.current = false;
      ignorePop.current = true;
      window.history.back();
    }
  }, [isOpen]);

  const closeAll = useCallback(() => {
    setPanel("home");
    setSelectedLine(null);
    setSelectedStation(null);
    setSnap("recolhido");
    restoreFocus.current = true;
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      if (pushed.current) {
        pushed.current = false;
        closeAll();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [closeAll]);

  // Foco: ao abrir por toque/teclado vai para o título do painel; ao fechar volta para quem abriu.
  useEffect(() => {
    if (restoreFocus.current) {
      restoreFocus.current = false;
      const el = opener.current?.isConnected ? opener.current : searchBtn.current;
      opener.current = null;
      el?.focus({ preventScroll: true });
      return;
    }
    // Busca e rota cuidam do próprio foco (o campo de texto).
    if (!byUser.current || panel === "search" || panel === "find") {
      byUser.current = false;
      return;
    }
    byUser.current = false;
    const h = contentRef.current?.querySelector<HTMLElement>("h2");
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }, [panel, snap]);

  // Rota vinda do endereço: enquadra o caminho quando o mapa estiver pronto.
  useEffect(() => {
    if (!ready) return;
    if (outcome && !initialView) focusOutcome(outcome);
    else if (initial.selectedStation && !initialView) mapRef.current?.focusStation(initial.selectedStation);
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const routeState = useMemo(() => {
    const r: Route | null = panel === "search" ? (outcome?.route ?? null) : null;
    return r ? { trechos: new Set(r.trechos), estacoes: new Set(r.legs.flatMap((l) => l.estacoes)) } : null;
  }, [panel, outcome]);

  const walk = useMemo(() => {
    if (panel !== "search" || !outcome) return null;
    const end = (s: Spot | null, station: string | null): WalkEnd | null => {
      if (s?.kind !== "place") return null;
      const anchor = station ?? nearestStations(s.lngLat, 1)[0]?.slug;
      return anchor ? { lngLat: s.lngLat, station: anchor, dashed: Boolean(station) } : null;
    };
    const w = { from: end(outcome.from, outcome.board), to: end(outcome.to, outcome.alight) };
    return w.from || w.to ? w : null;
  }, [panel, outcome]);

  function open(p: Panel, s?: Snap) {
    if (panel === "home" && !opener.current) opener.current = document.activeElement as HTMLElement | null;
    byUser.current = true;
    setPanel(p);
    setSnap(s ?? (p === "search" || p === "find" ? "expandido" : "meio"));
  }

  const pickStation = (slug: string | null) => {
    setSelectedStation(slug);
    if (!slug) {
      if (panel === "station") {
        if (selectedLine) setPanel("line");
        else closeAll();
      }
      return;
    }
    const st = stationBySlug.get(slug);
    if (st && st.linhas.every((l) => RAIL_LINES.has(l))) setShowRail(true);
    open("station");
    setAnnouncement(`Estação ${st?.nome} selecionada no mapa.`);
    mapRef.current?.focusStation(slug);
  };

  const pickLine = (id: string) => {
    if (RAIL_LINES.has(id)) setShowRail(true);
    setSelectedLine(id);
    setSelectedStation(null);
    open("line");
    setAnnouncement(`${lineById.get(id)?.nome} destacada no mapa; as outras linhas ficam em cinza.`);
  };

  const openSearch = () => {
    setSelectedLine(null);
    setSelectedStation(null);
    open("find");
  };

  /** Escolha na busca: vira o destino da rota (a origem fica para a pessoa dizer, ou "minha localização"). */
  const pickFind = (s: Spot) => {
    addRecent(s);
    const o: RouteOutcome = { route: null, from: null, to: s, board: null, alight: null, walkOnly: false };
    setOutcome(o);
    open("search", "expandido");
    if (s.kind === "station") mapRef.current?.focusStation(s.slug);
    else {
      // O lugar e a estação mais próxima juntos: dá para ver por onde se chega.
      const st = nearestStations(s.lngLat, 1)[0];
      if (mode === "real" && st) mapRef.current?.focusPoints([s.lngLat, stationBySlug.get(st.slug)!.geo]);
      else focusOutcome(o);
    }
  };

  const locate = () => {
    open("near");
    requestGeo();
  };

  function focusOutcome(o: RouteOutcome) {
    const pts: LngLat[] = [];
    const real = mode === "real";
    const stationPt = (slug: string) => {
      const s = stationBySlug.get(slug)!;
      return real ? s.geo : s.schem;
    };
    if (o.route) {
      o.route.legs.flatMap((l) => l.estacoes).forEach((s) => pts.push(stationPt(s)));
      if (o.route.legs.some((l) => RAIL_LINES.has(l.linha))) setShowRail(true);
    }
    for (const s of [o.from, o.to]) {
      if (s?.kind === "station") pts.push(stationPt(s.slug));
      else if (s?.kind === "place" && real) pts.push(s.lngLat);
      else if (s?.kind === "place") {
        const n = nearestStations(s.lngLat, 1)[0];
        if (n) pts.push(stationPt(n.slug));
      }
    }
    if (pts.length) mapRef.current?.focusPoints(pts);
  }

  /** Esc (e o voltar do painel): volta um nível; no início, recolhe a folha. */
  const back = useCallback(() => {
    if (panel === "station" && selectedLine) {
      setSelectedStation(null);
      setPanel("line");
    } else if (panel !== "home") {
      closeAll();
    } else if (snap !== "recolhido") {
      setSnap("recolhido");
      restoreFocus.current = true;
    }
  }, [panel, selectedLine, snap, closeAll]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [back]);

  const walkTo = selectedStation ? (nearby.find((n) => n.slug === selectedStation) ?? null) : null;

  const linesGrid = <LinesGrid showRail={showRail} onToggleRail={setShowRail} onPickLine={pickLine} />;

  const content = (
    <div key={panel} className="anim-panel">
      {panel === "home" && linesGrid}
      {panel === "lines" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Linhas</h2>
            <IconButton variant="plain" label="Fechar linhas" onClick={closeAll}>
              {Icons.close}
            </IconButton>
          </div>
          <ModeTabs mode={mode} onChange={setMode} />
          {linesGrid}
        </div>
      )}
      {panel === "now" && <NowView onBack={closeAll} />}
      {panel === "find" && <FindView near={findNear} onPick={pickFind} onClose={closeAll} />}
      {panel === "line" && selectedLine && (
        <LineView id={selectedLine} selectedStation={selectedStation} onBack={closeAll} onPickStation={(s) => pickStation(s)} />
      )}
      {panel === "station" && selectedStation && (
        <StationView slug={selectedStation} walk={walkTo} onBack={back} onPickLine={pickLine} onPickStation={(s) => pickStation(s)} />
      )}
      {panel === "near" && (
        <NearView
          geo={geo}
          nearby={nearby}
          target={target}
          onRetry={requestGeo}
          onBack={closeAll}
          onPick={(s) => {
            setTarget(s);
            pickStation(s);
          }}
        />
      )}
      {panel === "search" && (
        <RoutePlanner
          initialFrom={outcome?.from ?? initial.from}
          initialTo={outcome?.to ?? initial.to}
          bias={bias}
          autoFocus={!outcome?.from || !outcome?.to}
          onBack={closeAll}
          onResult={(o) => {
            setOutcome(o);
            if (o.route || o.walkOnly) {
              focusOutcome(o);
              setAnnouncement(o.route ? `Rota destacada no mapa: cerca de ${o.route.minutos} minutos na rede.` : "Destino perto: dá para ir a pé.");
            } else if (o.to?.kind === "station" && !o.from) {
              mapRef.current?.focusStation(o.to.slug);
            } else if (o.to?.kind === "place" && !o.from) {
              focusOutcome(o);
            }
          }}
        />
      )}
      {panel === "alerts" && <AlertsView onBack={closeAll} onPickLine={pickLine} onNow={() => open("now")} />}
      {panel === "sobre" && <AboutPanel onBack={closeAll} />}
    </div>
  );

  // Celular: com o painel fechado não há folha — só os botões sobre o mapa, como no Live Subway Map.
  const sheetOpen = panel !== "home";
  const peek =
    snap === "recolhido" ? (
      <div className="flex items-center justify-between">
        <p className="text-base font-bold">{TITLES[panel]}</p>
        <IconButton variant="plain" label="Fechar painel" onClick={closeAll}>
          {Icons.close}
        </IconButton>
      </div>
    ) : null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <h1 className="sr-only">Mapa da rede de metrô e trens de São Paulo</h1>

      {isDesktop ? (
        /* Desktop: cartão flutuante no canto, como no Live Subway Map. */
        <aside className="absolute left-2 top-2 z-10 flex max-h-[calc(100%-80px)] w-44 flex-col" aria-label="Painel do mapa">
          <Card className="flex min-h-0 flex-col gap-2 p-3">
            <Brand onAbout={() => open("sobre")} />
            {panel === "home" && (
              <>
                <ModeTabs mode={mode} onChange={setMode} />
                <SearchButton onClick={openSearch} buttonRef={searchBtn} />
              </>
            )}
            <div ref={contentRef} className="-mx-3 min-h-0 overflow-y-auto px-3 pb-0.5">
              {content}
            </div>
            <StaticBadge />
          </Card>
        </aside>
      ) : (
        /* Celular: símbolo (abre os ajustes) e nome no alto, à esquerda. */
        <div className="pointer-events-none absolute inset-x-1 top-1 z-10 flex flex-col items-start gap-1">
          <div className="flex items-center gap-1">
            <ThemeToggle
              onAbout={() => open("sobre")}
              trigger={({ label, open: openSettings }) => (
                <button
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-haspopup="dialog"
                  onClick={openSettings}
                  className="pointer-events-auto flex size-control items-center justify-center rounded-full bg-ink text-lg font-bold text-bg active:scale-95"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <span aria-hidden>M</span>
                </button>
              )}
            />
            <p className="flex items-center gap-1 map-halo" aria-label="Metrô, versão beta">
              <span aria-hidden className="text-base font-bold">
                Metrô
              </span>
              <BetaTag />
            </p>
          </div>
          <StaticBadge className="pointer-events-auto" />
        </div>
      )}

      {/* Base da tela. Celular: botões sobre o mapa (ou a folha) e o aviso. Desktop: botões à direita. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-stretch gap-1 md:inset-x-auto md:right-2 md:bottom-6">
        {isDesktop ? (
          <div className="pointer-events-auto flex flex-col items-end gap-1">
            <AlertButton count={alertCount} onClick={() => open("alerts")} />
            <IconButton label="Estação mais perto de mim" onClick={locate}>
              <LocateIcon />
            </IconButton>
            <IconButton label="Aproximar" onClick={() => mapRef.current?.zoomBy(1)}>
              <span aria-hidden className="text-lg font-bold">
                +
              </span>
            </IconButton>
            <IconButton label="Afastar" onClick={() => mapRef.current?.zoomBy(-1)}>
              <span aria-hidden className="text-lg font-bold">
                −
              </span>
            </IconButton>
          </div>
        ) : sheetOpen ? (
          <BottomSheet title={TITLES[panel]} snap={snap} onSnap={setSnap} peek={peek} onEscape={back} tall={panel === "find"}>
            <div ref={contentRef}>{content}</div>
          </BottomSheet>
        ) : (
          <>
            {/* Coluna da direita: busca (no lugar do ♿ da referência) e localização. */}
            <div className="pointer-events-auto flex flex-col items-end gap-1 self-end px-1">
              <IconButton ref={searchBtn} label="Buscar estação, endereço ou lugar" onClick={openSearch} style={{ borderRadius: 999 }}>
                {Icons.search}
              </IconButton>
              <IconButton label="Estação mais perto de mim" onClick={locate} style={{ borderRadius: 999 }}>
                <LocateIcon />
              </IconButton>
            </div>
            {/* Linha de baixo: linhas · Agora · avisos. */}
            <div className="relative flex items-center justify-between px-1">
              <span className="pointer-events-auto">
                <LinesButton onClick={() => open("lines")} />
              </span>
              <span className="absolute left-1/2 -translate-x-1/2">
                <NowPill alerts={changedLines} onClick={() => open("now")} />
              </span>
              <span className="pointer-events-auto">
                <AlertButton count={alertCount} onClick={() => open("alerts")} round />
              </span>
            </div>
          </>
        )}
        <Disclaimer className="pointer-events-auto flex md:hidden" />
      </div>
      {isDesktop && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <NowPill alerts={changedLines} onClick={() => open("now")} />
        </div>
      )}
      <Disclaimer className="absolute inset-x-0 bottom-0 z-10 hidden md:flex" />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {/* Alternativa em texto do mapa: o mapa nunca é o único caminho. */}
      <div id="mapa-alternativa" className="sr-only">
        Mapa da rede com {lines.length} linhas de metrô, monotrilho e trem. O mesmo conteúdo está em texto no painel: linhas, estações
        e rotas. Modo atual: {mode === "real" ? "traçado geográfico" : "esquemático"}.
        {selectedLine ? ` Linha destacada: ${lineById.get(selectedLine)?.nome}.` : ""}
        {selectedStation ? ` Estação selecionada: ${stationBySlug.get(selectedStation)?.nome}.` : ""}
      </div>
      {/* O mapa vem depois dos painéis no DOM: o Tab passa primeiro pela busca e pelos controles. */}
      <SubwayMap
        ref={mapRef}
        mode={mode}
        showRail={showRail}
        selectedLine={selectedLine}
        selectedStation={selectedStation}
        user={user}
        target={target}
        route={routeState}
        walk={walk}
        onReady={onReady}
        onStationClick={pickStation}
        initialView={initialView}
        onViewChange={setView}
      />
      {!splashGone && <Splash leaving={ready} />}
    </main>
  );
}
