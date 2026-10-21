"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { BetaTag } from "@/components/ui/site-chrome";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { nearestStations } from "@/components/geo/nearest";
import { useGeolocation } from "@/components/geo/use-geolocation";
import { notices } from "./line-notes";
import { type LngLat, RAIL_LINES, lineById, lines, stationBySlug } from "./network";
import { AlertsView, LineView, LinesGrid, NearView, StationSearch, StationView } from "./panels";
import { type MapMode, SubwayMap, type SubwayMapHandle } from "./subway-map";
import { type Route, planRoute } from "@/components/route/plan";
import { RoutePlanner } from "@/components/route/route-planner";
import { BackButton } from "./panels";

type Panel = "home" | "line" | "station" | "near" | "alerts" | "route";

// ---------------------------------------------------------------- peças

function ModeTabs({ mode, onChange }: { mode: MapMode; onChange: (m: MapMode) => void }) {
  const tabs: { id: MapMode; label: string; sub: string }[] = [
    { id: "esquematico", label: "Esquemático", sub: "diagrama 45°/90°" },
    { id: "real", label: "Real", sub: "traçado geográfico" },
  ];
  return (
    <div className="grid grid-cols-2 border-t border-rule" role="group" aria-label="Tipo de mapa">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={mode === t.id}
          onClick={() => onChange(t.id)}
          className="-mt-px border-t-2 border-transparent pt-1 text-left aria-pressed:border-ink"
        >
          <span className={`block text-caption font-bold ${mode === t.id ? "text-ink" : "text-ink-muted"}`}>{t.label}</span>
          <span className="block text-[0.6875rem] text-ink-muted">{t.sub}</span>
        </button>
      ))}
    </div>
  );
}

/** Pílula central do celular (no lugar do "Now" do Live Subway Map): esquemático ou real. */
function ModePill({ mode, onChange }: { mode: MapMode; onChange: (m: MapMode) => void }) {
  return (
    <div
      role="group"
      aria-label="Tipo de mapa"
      className="flex h-6 items-center bg-surface p-0.5 text-caption font-bold"
      style={{ borderRadius: 999, boxShadow: "var(--shadow-card)" }}
    >
      {(["esquematico", "real"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className="h-5 px-2 text-ink-muted aria-pressed:bg-ink aria-pressed:text-bg"
          style={{ borderRadius: 999 }}
        >
          {m === "esquematico" ? "Esquemático" : "Real"}
        </button>
      ))}
    </div>
  );
}

/** Marca do site: círculo com "M" (não é o símbolo oficial) + nome em texto. */
function Mark() {
  return (
    <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-full bg-ink text-lead font-bold text-bg">
      M
    </span>
  );
}

function Brand() {
  return (
    <div className="flex items-center justify-between">
      <Link href="/" className="inline-flex items-center gap-1" aria-label="Metrô, versão beta — início">
        <Mark />
        <span className="text-lead font-bold tracking-tight">Metrô</span>
        <BetaTag />
      </Link>
      <ThemeToggle />
    </div>
  );
}

function LinesIcon() {
  // Grade de pontos coloridos, como o botão de linhas do Live Subway Map.
  const ids = ["1", "2", "3", "4", "5", "6", "15", "17", "11"];
  return (
    <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
      {ids.map((id, i) => (
        <circle key={id} cx={5 + (i % 3) * 7} cy={5 + Math.floor(i / 3) * 7} r="2.6" fill={lineById.get(id)?.cor} />
      ))}
    </svg>
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

function AlertButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <IconButton label={`Avisos (${count})`} onClick={onClick}>
      <span aria-hidden className="inline-flex size-3 items-center justify-center rounded-full bg-line-4 text-body font-bold text-[#111]">
        !
      </span>
    </IconButton>
  );
}

/** Aviso de projeto não oficial + atribuição dos dados do mapa, sempre visíveis. */
function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`flex-wrap items-center gap-x-2 bg-surface/90 px-2 py-0.5 text-[0.6875rem] leading-tight text-ink-muted backdrop-blur ${className}`}>
      <span>
        Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo. Informações oficiais em{" "}
        <a className="underline" href="https://www.metro.sp.gov.br">
          metro.sp.gov.br
        </a>
        .
      </span>
      <span>
        <a className="underline" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> ·{" "}
        <a className="underline" href="https://openfreemap.org">OpenFreeMap</a> ·{" "}
        <a className="underline" href="https://www.openmaptiles.org">© OpenMapTiles</a>
      </span>
    </p>
  );
}

/** Folha que sobe no celular: alça, título e fechar. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <section id="folha-do-mapa" aria-label={title} className="pointer-events-auto md:hidden">
      <Card className="anim-sheet mx-1 flex max-h-[62vh] min-h-0 flex-col" style={{ borderRadius: "16px 16px 12px 12px" }}>
        <span aria-hidden className="mx-auto mt-1 h-0.5 w-5 rounded-full bg-rule" />
        <div className="flex items-center justify-between px-2 pt-0.5">
          <p className="text-caption font-semibold uppercase tracking-widest text-ink-muted">{title}</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="inline-flex size-5 items-center justify-center text-ink">
            <svg viewBox="0 0 24 24" className="size-2" aria-hidden>
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-2 pb-2">{children}</div>
      </Card>
    </section>
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

export function MapApp() {
  const params = useSearchParams();
  const initialLine = params.get("linha");
  const initialStation = params.get("estacao");
  const [initialView] = useState(() => parseView(params.get("v")));
  const valid = (s: string | null) => (s && stationBySlug.has(s) ? s : null);
  const [routeEnds, setRouteEnds] = useState<{ from: string | null; to: string | null }>(() => ({
    from: valid(params.get("de")),
    to: valid(params.get("para")),
  }));
  const [route, setRoute] = useState<Route | null>(() =>
    routeEnds.from && routeEnds.to ? planRoute(routeEnds.from, routeEnds.to) : null,
  );
  const [mode, setMode] = useState<MapMode>(params.get("modo") === "real" ? "real" : "esquematico");
  const [selectedLine, setSelectedLine] = useState<string | null>(initialLine && lineById.has(initialLine) ? initialLine : null);
  const [selectedStation, setSelectedStation] = useState<string | null>(
    initialStation && stationBySlug.has(initialStation) ? initialStation : null,
  );
  const [showRail, setShowRail] = useState(() => {
    const l = initialLine ?? "";
    const s = initialStation ? stationBySlug.get(initialStation) : null;
    return RAIL_LINES.has(l) || Boolean(s && s.linhas.every((x) => RAIL_LINES.has(x)));
  });
  const [panel, setPanel] = useState<Panel>(route ? "route" : selectedStation ? "station" : selectedLine ? "line" : "home");
  // No celular a folha começa fechada (mapa limpo), a não ser que o link já aponte algo.
  const [sheetOpen, setSheetOpen] = useState(Boolean(selectedStation || selectedLine || route));
  const [target, setTarget] = useState<string | null>(null);
  const [view, setView] = useState<{ center: LngLat; zoom: number } | null>(initialView);
  const mapRef = useRef<SubwayMapHandle>(null);
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
  const alertCount = notices().length;

  // Endereço compartilhável: modo, linha, estação e a vista do mapa (?v=lng,lat,zoom).
  // Com o GPS ativo a vista NÃO vai para o endereço — ela revelaria onde você está.
  useEffect(() => {
    const u = new URLSearchParams();
    if (mode === "real") u.set("modo", "real");
    if (selectedLine) u.set("linha", selectedLine);
    if (selectedStation) u.set("estacao", selectedStation);
    if (panel === "route" && routeEnds.from) u.set("de", routeEnds.from);
    if (panel === "route" && routeEnds.to) u.set("para", routeEnds.to);
    if (view && geo.status === "idle") u.set("v", `${view.center[0].toFixed(4)},${view.center[1].toFixed(4)},${view.zoom.toFixed(1)}`);
    const qs = u.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [mode, selectedLine, selectedStation, view, geo.status, panel, routeEnds]);

  // Rota vinda do endereço: enquadra o caminho quando o mapa estiver pronto.
  useEffect(() => {
    if (!route || initialView) return;
    const id = setTimeout(() => focusRoute(route), 700);
    return () => clearTimeout(id);
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routeState = useMemo(
    () =>
      panel === "route" && route
        ? { trechos: new Set(route.trechos), estacoes: new Set(route.legs.flatMap((l) => l.estacoes)) }
        : null,
    [panel, route],
  );

  // Ao abrir pelo link de uma estação (sem vista salva), centraliza nela.
  useEffect(() => {
    if (initialStation && stationBySlug.has(initialStation) && !initialView) {
      const id = setTimeout(() => mapRef.current?.focusStation(initialStation), 600);
      return () => clearTimeout(id);
    }
  }, [initialStation, initialView]);

  const openPanel = (p: Panel) => {
    setPanel(p);
    setSheetOpen(true);
  };

  const pickStation = (slug: string | null) => {
    setSelectedStation(slug);
    if (!slug) {
      if (panel === "station") setPanel(selectedLine ? "line" : "home");
      setSheetOpen(Boolean(selectedLine) && panel !== "station");
      return;
    }
    const st = stationBySlug.get(slug);
    if (st && st.linhas.every((l) => RAIL_LINES.has(l))) setShowRail(true);
    openPanel("station");
    mapRef.current?.focusStation(slug);
  };

  const pickLine = (id: string) => {
    if (RAIL_LINES.has(id)) setShowRail(true);
    setSelectedLine(id);
    setSelectedStation(null);
    openPanel("line");
  };

  const locate = () => {
    openPanel("near");
    requestGeo();
  };

  function focusRoute(r: Route) {
    const pts = r.legs.flatMap((l) => l.estacoes).map((s) => stationBySlug.get(s)!);
    if (pts.some((s) => s.linhas.every((l) => RAIL_LINES.has(l))) || r.legs.some((l) => RAIL_LINES.has(l.linha))) setShowRail(true);
    mapRef.current?.focusPoints(pts.map((s) => (mode === "real" ? s.geo : s.schem)));
  }

  const backHome = () => {
    setSelectedLine(null);
    setSelectedStation(null);
    setPanel("home");
  };

  const walkTo = selectedStation ? nearby.find((n) => n.slug === selectedStation) ?? null : null;

  const content = (
    <div key={panel} className="anim-panel">
      {panel === "home" && (
        <div className="flex flex-col gap-3">
          <LinesGrid showRail={showRail} onToggleRail={() => setShowRail((v) => !v)} onPickLine={pickLine} />
          <StationSearch onPick={(s) => pickStation(s)} />
          <button
            type="button"
            onClick={() => {
              setSelectedLine(null);
              setPanel("route");
            }}
            className="flex items-center justify-between border-t border-rule pt-2 text-body font-bold"
          >
            Como chegar <span aria-hidden>→</span>
          </button>
        </div>
      )}
      {panel === "line" && selectedLine && (
        <LineView id={selectedLine} selectedStation={selectedStation} onBack={backHome} onPickStation={(s) => pickStation(s)} />
      )}
      {panel === "station" && selectedStation && (
        <StationView
          slug={selectedStation}
          walk={walkTo}
          onBack={() => {
            setSelectedStation(null);
            setPanel(selectedLine ? "line" : "home");
          }}
          onPickLine={pickLine}
          onPickStation={(s) => pickStation(s)}
        />
      )}
      {panel === "near" && (
        <NearView
          geo={geo}
          nearby={nearby}
          target={target}
          onRetry={requestGeo}
          onBack={() => setPanel(selectedStation ? "station" : selectedLine ? "line" : "home")}
          onPick={(s) => {
            setTarget(s);
            pickStation(s);
          }}
        />
      )}
      {panel === "route" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <BackButton onClick={() => setPanel("home")} />
            <h2 className="text-lead font-bold tracking-tight">Como chegar</h2>
          </div>
          <RoutePlanner
            initialFrom={routeEnds.from}
            initialTo={routeEnds.to}
            showMapLink={false}
            onRoute={(r, from, to) => {
              setRouteEnds({ from, to });
              setRoute(r);
              if (r) focusRoute(r);
            }}
          />
        </div>
      )}
      {panel === "alerts" && <AlertsView onBack={() => setPanel(selectedLine ? "line" : "home")} onPickLine={pickLine} />}
    </div>
  );

  const sheetTitle =
    panel === "line" && selectedLine
      ? "Linha"
      : panel === "station"
        ? "Estação"
        : panel === "near"
          ? "Perto de você"
          : panel === "alerts"
            ? "Avisos"
            : panel === "route"
              ? "Rota"
              : "Linhas";

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg">
      <h1 className="sr-only">Mapa da rede de metrô de São Paulo</h1>
      <SubwayMap
        ref={mapRef}
        mode={mode}
        showRail={showRail}
        selectedLine={selectedLine}
        selectedStation={selectedStation}
        user={user}
        target={target}
        route={routeState}
        onStationClick={pickStation}
        initialView={initialView}
        onViewChange={setView}
      />

      {/* Desktop: cartão flutuante no canto, como no Live Subway Map. */}
      <aside className="absolute left-2 top-2 hidden max-h-[calc(100%-80px)] w-44 flex-col md:flex" aria-label="Painel do mapa">
        <Card className="flex min-h-0 flex-col gap-2 p-3">
          <Brand />
          {panel === "home" && <p className="text-title-s font-bold tracking-tight">Mapa da rede</p>}
          <ModeTabs mode={mode} onChange={setMode} />
          <div className="-mx-3 min-h-0 overflow-y-auto px-3 pb-0.5">{content}</div>
        </Card>
      </aside>

      {/* Celular: marca flutuando no canto, como o logo do Live Subway Map. */}
      <div className="pointer-events-none absolute inset-x-1 top-1 flex items-center justify-between md:hidden">
        <Link href="/" className="pointer-events-auto flex items-center gap-1" aria-label="Metrô, versão beta — início">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface" style={{ boxShadow: "var(--shadow-card)" }}>
            <Mark />
          </span>
          <span className="text-body font-bold tracking-tight [text-shadow:0_0_3px_var(--bg),0_0_6px_var(--bg)]">Mapa da rede</span>
          <BetaTag />
        </Link>
        <span className="pointer-events-auto inline-flex size-6 items-center justify-center rounded-full bg-surface" style={{ boxShadow: "var(--shadow-card)" }}>
          <ThemeToggle />
        </span>
      </div>

      {/* Base da tela. Celular: botões → folha → aviso. Desktop: botões no canto direito. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-1 md:inset-x-auto md:right-2 md:bottom-6">
        <div className="pointer-events-auto flex items-end justify-between gap-1 px-1 md:flex-col md:px-0">
          <div className="md:hidden">
            <IconButton label="Linhas e estações" onClick={() => (sheetOpen && panel === "home" ? setSheetOpen(false) : openPanel("home"))}>
              <LinesIcon />
            </IconButton>
          </div>
          <div className="md:hidden">
            <ModePill mode={mode} onChange={setMode} />
          </div>
          <div className="flex flex-col gap-1">
            <AlertButton count={alertCount} onClick={() => openPanel("alerts")} />
            <IconButton label="Estação mais perto de mim" onClick={locate}>
              <LocateIcon />
            </IconButton>
            {/* No celular o zoom é por gesto de pinça. */}
            <div className="hidden md:contents">
              <IconButton label="Aproximar" onClick={() => mapRef.current?.zoomBy(1)}>
                <span aria-hidden className="text-lead font-bold">+</span>
              </IconButton>
              <IconButton label="Afastar" onClick={() => mapRef.current?.zoomBy(-1)}>
                <span aria-hidden className="text-lead font-bold">−</span>
              </IconButton>
            </div>
          </div>
        </div>
        {sheetOpen && (
          <Sheet title={sheetTitle} onClose={() => setSheetOpen(false)}>
            {content}
          </Sheet>
        )}
        <Disclaimer className="pointer-events-auto flex md:hidden" />
      </div>
      <Disclaimer className="absolute inset-x-0 bottom-0 hidden md:flex" />
      {/* Lista completa para leitores de tela: o mapa nunca é o único caminho. */}
      <nav className="sr-only" aria-label="Todas as linhas">
        <ul>
          {lines.map((l) => (
            <li key={l.id}>
              <Link href={`/linhas/${l.id}`}>{l.nome}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
