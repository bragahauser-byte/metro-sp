"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { BetaTag } from "@/components/ui/site-chrome";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { nearestStations } from "@/components/geo/nearest";
import { useGeolocation } from "@/components/geo/use-geolocation";
import { RAIL_LINES, lineById, stationBySlug } from "./network";
import { LineView, LinesGrid, NearView, StationSearch, StationView } from "./panels";
import { type MapMode, SubwayMap, type SubwayMapHandle } from "./subway-map";
import Link from "next/link";

type Panel = "home" | "line" | "station" | "near";

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

function Brand() {
  return (
    <div className="flex items-center justify-between">
      <Link href="/" className="inline-flex items-center gap-1" aria-label="Metrô, versão beta — início">
        <span className="text-lead font-bold tracking-tight">Metrô</span>
        <BetaTag />
      </Link>
      <ThemeToggle />
    </div>
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

export function MapApp() {
  const params = useSearchParams();
  const initialLine = params.get("linha");
  const initialStation = params.get("estacao");
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
  const [panel, setPanel] = useState<Panel>(selectedStation ? "station" : selectedLine ? "line" : "home");
  const [sheetOpen, setSheetOpen] = useState(Boolean(selectedStation || selectedLine));
  const [target, setTarget] = useState<string | null>(null);
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

  // Endereço compartilhável (sem nada de localização): ?modo, ?linha, ?estacao.
  useEffect(() => {
    const u = new URLSearchParams();
    if (mode === "real") u.set("modo", "real");
    if (selectedLine) u.set("linha", selectedLine);
    if (selectedStation) u.set("estacao", selectedStation);
    const qs = u.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [mode, selectedLine, selectedStation]);

  // Ao abrir pelo link de uma estação, centraliza nela.
  useEffect(() => {
    if (initialStation && stationBySlug.has(initialStation)) {
      const id = setTimeout(() => mapRef.current?.focusStation(initialStation), 600);
      return () => clearTimeout(id);
    }
  }, [initialStation]);

  const pickStation = (slug: string | null) => {
    setSelectedStation(slug);
    if (!slug) {
      setPanel((p) => (p === "station" ? (selectedLine ? "line" : "home") : p));
      return;
    }
    const st = stationBySlug.get(slug);
    if (st && st.linhas.every((l) => RAIL_LINES.has(l))) setShowRail(true);
    setPanel("station");
    setSheetOpen(true);
    mapRef.current?.focusStation(slug);
  };

  const pickLine = (id: string) => {
    if (RAIL_LINES.has(id)) setShowRail(true);
    setSelectedLine(id);
    setSelectedStation(null);
    setPanel("line");
    setSheetOpen(true);
  };

  const locate = () => {
    setPanel("near");
    setSheetOpen(true);
    requestGeo();
  };

  const walkTo = selectedStation ? nearby.find((n) => n.slug === selectedStation) ?? null : null;

  const content = (
    <>
      {panel === "home" && (
        <div className="flex flex-col gap-3">
          <LinesGrid showRail={showRail} onToggleRail={() => setShowRail((v) => !v)} onPickLine={pickLine} />
          <StationSearch onPick={(s) => pickStation(s)} />
        </div>
      )}
      {panel === "line" && selectedLine && (
        <LineView
          id={selectedLine}
          selectedStation={selectedStation}
          onBack={() => {
            setSelectedLine(null);
            setSelectedStation(null);
            setPanel("home");
          }}
          onPickStation={(s) => pickStation(s)}
        />
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
    </>
  );

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
        onStationClick={pickStation}
      />

      {/* Desktop: cartão flutuante no canto, como no Live Subway Map. */}
      <aside className="absolute left-2 top-2 hidden max-h-[calc(100%-80px)] w-44 flex-col md:flex" aria-label="Painel do mapa">
        <Card className="flex min-h-0 flex-col gap-2 p-3">
          <Brand />
          <p className="text-title-s font-bold tracking-tight">Mapa da rede</p>
          <ModeTabs mode={mode} onChange={setMode} />
          <div className="-mx-3 min-h-0 overflow-y-auto px-3 pb-0.5">{content}</div>
        </Card>
      </aside>

      {/* Celular: barra no topo + folha embaixo. */}
      <div className="absolute inset-x-1 top-1 md:hidden">
        <Card className="flex flex-col gap-1 px-2 pt-1.5 pb-1">
          <Brand />
          <ModeTabs mode={mode} onChange={setMode} />
        </Card>
      </div>
      {/* Base da tela: no celular, botões → folha → aviso numa coluna; no desktop, botões no canto. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-1 md:inset-x-auto md:right-2 md:bottom-6">
        <div className="pointer-events-auto flex flex-row justify-end gap-1 px-1 md:flex-col md:px-0">
          <IconButton label="Estação mais perto de mim" onClick={locate}>
            <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
              <circle cx="12" cy="12" r="3.5" fill="currentColor" />
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" />
            </svg>
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
        <section id="folha-do-mapa" aria-label="Painel do mapa" className="pointer-events-auto md:hidden">
          <Card className="mx-1 flex max-h-[55vh] min-h-0 flex-col">
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
              className="flex w-full items-center justify-between px-2 py-1.5 text-body font-bold"
            >
              <span>
                {panel === "station" && selectedStation
                  ? stationBySlug.get(selectedStation)?.nome
                  : panel === "line" && selectedLine
                    ? lineById.get(selectedLine)?.nome
                    : panel === "near"
                      ? "Perto de você"
                      : "Linhas e estações"}
              </span>
              <span aria-hidden className={`transition-transform duration-(--duration-base) ${sheetOpen ? "" : "rotate-180"}`}>
                ▾
              </span>
            </button>
            {sheetOpen && <div className="min-h-0 overflow-y-auto px-2 pb-2">{content}</div>}
          </Card>
        </section>
        <Disclaimer className="pointer-events-auto flex md:hidden" />
      </div>
      <Disclaimer className="absolute inset-x-0 bottom-0 hidden md:flex" />
    </main>
  );
}
