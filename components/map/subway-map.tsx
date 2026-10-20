"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useImperativeHandle, useRef, useSyncExternalStore, type Ref } from "react";
import { basemapStyle, type Theme } from "./basemap-style";
import { easeInOut } from "./geometry";
import { type LngLat, RAIL_LINES, boundsOf, stationBySlug, stations } from "./network";
import { NetworkRenderer, type RenderState } from "./network-renderer";

export type MapMode = "real" | "esquematico";

export type SubwayMapHandle = {
  focusStation: (slug: string) => void;
  focusPoints: (points: LngLat[]) => void;
  zoomBy: (delta: number) => void;
};

type Props = {
  mode: MapMode;
  showRail: boolean;
  selectedLine: string | null;
  selectedStation: string | null;
  user: RenderState["user"];
  target: string | null;
  onStationClick: (slug: string | null) => void;
  /** Vista inicial vinda do endereço (?v=lng,lat,zoom). */
  initialView?: { center: LngLat; zoom: number } | null;
  /** Avisada ao fim de cada movimento da câmera (para guardar a vista no endereço). */
  onViewChange?: (view: { center: LngLat; zoom: number }) => void;
  ref?: Ref<SubwayMapHandle>;
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

function currentTheme(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}
function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

/**
 * Área livre para enquadrar a rede: em tela larga o cartão ocupa a esquerda; em tela média ele fica
 * no alto (a rede vai embaixo dele); no celular, barra no topo e folha embaixo.
 */
function framePadding() {
  const w = window.innerWidth;
  if (w >= 1100) return { top: 40, left: 400, right: 90, bottom: 50 };
  if (w >= 768) return { top: 450, left: 30, right: 90, bottom: 50 };
  // Celular: desconta a folha de baixo (aberta ou fechada) medindo a altura real dela.
  const sheet = document.getElementById("folha-do-mapa");
  return { top: 130, left: 20, right: 20, bottom: (sheet?.offsetHeight ?? 60) + 90 };
}

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pontos usados para enquadrar a rede num modo (metrô sempre; trens quando a camada está ligada). */
function framePoints(mode: MapMode, showRail: boolean): LngLat[] {
  return stations
    .filter((s) => showRail || s.linhas.some((l) => !RAIL_LINES.has(l)))
    .map((s) => (mode === "real" ? s.geo : s.schem));
}

export function SubwayMap({
  mode,
  showRail,
  selectedLine,
  selectedStation,
  user,
  target,
  onStationClick,
  initialView,
  onViewChange,
  ref,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const rendererRef = useRef<NetworkRenderer | null>(null);
  const stateRef = useRef<RenderState>({
    t: mode === "esquematico" ? 1 : 0,
    showRail,
    selectedLine,
    selectedStation,
    hoveredStation: null,
    user,
    target,
  });
  const clickRef = useRef(onStationClick);
  const viewRef = useRef(onViewChange);
  const initialViewRef = useRef(initialView);
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as Theme);
  const themeRef = useRef(theme);

  useEffect(() => {
    clickRef.current = onStationClick;
    viewRef.current = onViewChange;
  }, [onStationClick, onViewChange]);

  useEffect(() => {
    if (paperRef.current) paperRef.current.style.opacity = String(stateRef.current.t);
  }, []);

  // Cria o mapa uma vez.
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (disposed || !containerRef.current || !canvasRef.current) return;
      // O worker do MapLibre 6 é um arquivo à parte, copiado para /public em predev/prebuild.
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      const initial = stateRef.current.t > 0.5 ? "esquematico" : "real";
      const map = new maplibre.Map({
        container: containerRef.current,
        style: basemapStyle(themeRef.current),
        ...(initialViewRef.current
          ? { center: initialViewRef.current.center, zoom: initialViewRef.current.zoom }
          : { bounds: boundsOf(framePoints(initial, stateRef.current.showRail)), fitBoundsOptions: { padding: framePadding() } }),
        maxBounds: [
          [-47.6, -24.3],
          [-45.6, -22.8],
        ],
        minZoom: 8.5,
        maxZoom: 17.5,
        dragRotate: false,
        pitchWithRotate: false,
        // A atribuição (OSM, OpenFreeMap, OpenMapTiles) fica no painel, visível nos dois modos.
        attributionControl: false,
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = map;
      const renderer = new NetworkRenderer(map, canvasRef.current, stateRef.current);
      rendererRef.current = renderer;
      const sync = () => {
        const el = containerRef.current;
        if (!el) return;
        renderer.resize(el.clientWidth, el.clientHeight);
        renderer.draw();
      };
      ro = new ResizeObserver(sync);
      ro.observe(containerRef.current);
      sync();
      map.on("render", () => renderer.draw());
      // A fonte do site pode terminar de carregar depois do primeiro quadro.
      document.fonts?.ready.then(() => {
        renderer.refreshColors();
        renderer.draw();
      });
      map.on("mousemove", (e) => {
        const slug = renderer.hitTest(e.point.x, e.point.y);
        map.getCanvas().style.cursor = slug ? "pointer" : "";
        if (slug !== stateRef.current.hoveredStation) {
          stateRef.current.hoveredStation = slug;
          renderer.draw();
        }
      });
      map.on("click", (e) => clickRef.current(renderer.hitTest(e.point.x, e.point.y)));
      map.on("moveend", () => {
        const c = map.getCenter();
        viewRef.current?.({ center: [c.lng, c.lat], zoom: map.getZoom() });
      });
    })();
    return () => {
      disposed = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // Tema: troca o estilo do fundo e as cores da rede.
  useEffect(() => {
    themeRef.current = theme;
    mapRef.current?.setStyle(basemapStyle(theme));
    rendererRef.current?.refreshColors();
    rendererRef.current?.draw();
  }, [theme]);

  // Estado simples: redesenha.
  useEffect(() => {
    Object.assign(stateRef.current, { showRail, selectedLine, selectedStation, user, target });
    rendererRef.current?.draw();
  }, [showRail, selectedLine, selectedStation, user, target]);

  // Troca de modo: anima t e enquadra a rede no destino ao mesmo tempo.
  useEffect(() => {
    const to = mode === "esquematico" ? 1 : 0;
    const from = stateRef.current.t;
    if (from === to) return;
    const map = mapRef.current;
    const duration = reducedMotion() ? 0 : 900;
    if (map) {
      const focus = stateRef.current.selectedStation ? stationBySlug.get(stateRef.current.selectedStation) : null;
      const { user: me, target: dest } = stateRef.current;
      const destStation = dest ? stationBySlug.get(dest) : null;
      if (me && destStation && mode === "real") {
        // Veio do GPS: enquadra você e a estação mais próxima.
        const pad = framePadding();
        const cam = map.cameraForBounds(boundsOf([me.lngLat, destStation.geo]), {
          padding: { ...pad, top: pad.top + 60, bottom: pad.bottom + 60 },
          maxZoom: 16,
        });
        if (cam) map.easeTo({ ...cam, duration });
      } else if (focus) {
        map.easeTo({ center: mode === "real" ? focus.geo : focus.schem, padding: framePadding(), duration });
      } else {
        const cam = map.cameraForBounds(boundsOf(framePoints(mode, stateRef.current.showRail)), { padding: framePadding() });
        if (cam) map.easeTo({ ...cam, duration });
      }
    }
    if (duration === 0) {
      stateRef.current.t = to;
      if (paperRef.current) paperRef.current.style.opacity = String(to);
      rendererRef.current?.draw();
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      stateRef.current.t = from + (to - from) * easeInOut(k);
      if (paperRef.current) paperRef.current.style.opacity = String(stateRef.current.t);
      rendererRef.current?.draw();
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  useImperativeHandle(ref, () => ({
    focusStation(slug) {
      const st = stationBySlug.get(slug);
      const map = mapRef.current;
      if (!st || !map) return;
      const center = stateRef.current.t > 0.5 ? st.schem : st.geo;
      const pad = framePadding();
      map.flyTo({ center, zoom: Math.max(map.getZoom(), 14), padding: pad, duration: reducedMotion() ? 0 : 1000 });
    },
    focusPoints(points) {
      const map = mapRef.current;
      if (!map || points.length === 0) return;
      const pad = framePadding();
      const cam = map.cameraForBounds(boundsOf(points), { padding: { ...pad, top: pad.top + 40, bottom: pad.bottom + 40 }, maxZoom: 16 });
      if (cam) map.easeTo({ ...cam, duration: reducedMotion() ? 0 : 900 });
    },
    zoomBy(delta) {
      const map = mapRef.current;
      if (map) map.easeTo({ zoom: map.getZoom() + delta, duration: reducedMotion() ? 0 : 250 });
    },
  }));

  return (
    <div className="absolute inset-0" role="region" aria-label="Mapa interativo da rede. A lista no painel tem as mesmas informações.">
      {/* O CSS do MapLibre põe position: relative no contêiner; o invólucro é que ocupa a tela. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {/* "Papel" que cobre as ruas no modo esquemático. */}
      <div ref={paperRef} aria-hidden className="pointer-events-none absolute inset-0 bg-bg opacity-0" />
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0" />
    </div>
  );
}
