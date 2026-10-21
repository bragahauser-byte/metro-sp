"use client";

import { prefersReducedMotion } from "@/lib/prefs";
import "./maplibre-min.css";
import { useEffect, useImperativeHandle, useRef, useSyncExternalStore, type Ref } from "react";
import { basemapStyle, type Theme } from "./basemap-style";
import { BOUNDS, type Camera, type CameraEvents, MAX_ZOOM, MIN_ZOOM, MapLibreCamera, SchematicCamera } from "./camera";
import { easeInOut } from "./geometry";
import { type LngLat, RAIL_LINES, stationBySlug, stations } from "./network";
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
  route: RenderState["route"];
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

const reducedMotion = prefersReducedMotion;

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
  route,
  onStationClick,
  initialView,
  onViewChange,
  ref,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const mapLibreRef = useRef<Promise<Camera> | null>(null);
  const rendererRef = useRef<NetworkRenderer | null>(null);
  const stateRef = useRef<RenderState>({
    t: mode === "esquematico" ? 1 : 0,
    showRail,
    selectedLine,
    selectedStation,
    hoveredStation: null,
    user,
    target,
    route,
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

  const eventsRef = useRef<CameraEvents | null>(null);

  /**
   * Carrega o MapLibre (só na primeira vez que o modo real é usado) e passa a câmera para ele,
   * na mesma posição e zoom da câmera própria — a troca não tem salto.
   */
  function ensureMapLibre(): Promise<Camera> {
    if (mapLibreRef.current) return mapLibreRef.current;
    mapLibreRef.current = (async () => {
      const maplibre = await import("maplibre-gl");
      const el = containerRef.current!;
      const prev = cameraRef.current;
      const center = prev?.getCenter() ?? stations[0].geo;
      const zoom = prev?.getZoom() ?? 11;
      prev?.destroy();
      // O worker do MapLibre 6 é um arquivo à parte, copiado para /public em predev/prebuild.
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      const map = new maplibre.Map({
        container: el,
        style: basemapStyle(themeRef.current),
        center,
        zoom,
        maxBounds: BOUNDS,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        // A atribuição (OSM, OpenFreeMap, OpenMapTiles) fica no painel, visível nos dois modos.
        attributionControl: false,
      });
      map.touchZoomRotate.disableRotation();
      const cam = new MapLibreCamera(map, eventsRef.current!);
      cameraRef.current = cam;
      if (rendererRef.current) rendererRef.current.view = cam;
      rendererRef.current?.draw();
      return cam;
    })();
    return mapLibreRef.current;
  }

  // Monta a câmera e o desenho da rede uma vez.
  useEffect(() => {
    const el = containerRef.current, canvas = canvasRef.current;
    if (!el || !canvas) return;
    if (paperRef.current) paperRef.current.style.opacity = String(stateRef.current.t);
    const startMode: MapMode = stateRef.current.t > 0.5 ? "esquematico" : "real";
    const iv = initialViewRef.current;
    // Eventos comuns às duas câmeras (criados aqui, fora do render).
    eventsRef.current = {
      render: () => rendererRef.current?.draw(),
      moveend: () => {
        const cam = cameraRef.current;
        if (cam) viewRef.current?.({ center: cam.getCenter(), zoom: cam.getZoom() });
      },
      click: (p) => clickRef.current(rendererRef.current?.hitTest(p.x, p.y) ?? null),
      hover: (p) => {
        const renderer = rendererRef.current, cam = cameraRef.current;
        if (!renderer || !cam) return;
        const slug = renderer.hitTest(p.x, p.y);
        cam.setCursor(slug ? "pointer" : "");
        if (slug !== stateRef.current.hoveredStation) {
          stateRef.current.hoveredStation = slug;
          renderer.draw();
        }
      },
    };
    // Começa sempre com a câmera própria (leve); o modo real troca para o MapLibre.
    const cam = new SchematicCamera(el, iv ?? { center: stations[0].schem, zoom: 11 }, eventsRef.current!);
    cameraRef.current = cam;
    if (!iv) cam.fit(framePoints(startMode, stateRef.current.showRail), framePadding(), { duration: 0 });
    const renderer = new NetworkRenderer(cam, canvas, stateRef.current);
    rendererRef.current = renderer;
    const sync = () => {
      renderer.resize(el.clientWidth, el.clientHeight);
      renderer.draw();
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    sync();
    // A fonte do site pode terminar de carregar depois do primeiro quadro.
    document.fonts?.ready.then(() => {
      renderer.refreshColors();
      renderer.draw();
    });
    if (startMode === "real") void ensureMapLibre();
    return () => {
      ro.disconnect();
      cameraRef.current?.destroy();
      cameraRef.current = null;
      mapLibreRef.current = null;
      rendererRef.current = null;
    };
    // Montagem única; as mudanças de props são tratadas nos efeitos abaixo.
  }, []);

  // Tema: troca o estilo do fundo (se o MapLibre já existe) e as cores da rede.
  useEffect(() => {
    themeRef.current = theme;
    const cam = cameraRef.current;
    if (cam instanceof MapLibreCamera) cam.map.setStyle(basemapStyle(theme));
    rendererRef.current?.refreshColors();
    rendererRef.current?.draw();
  }, [theme]);

  // Estado simples: redesenha.
  useEffect(() => {
    Object.assign(stateRef.current, { showRail, selectedLine, selectedStation, user, target, route });
    rendererRef.current?.draw();
  }, [showRail, selectedLine, selectedStation, user, target, route]);

  // Troca de modo: anima t e enquadra a rede no destino ao mesmo tempo.
  useEffect(() => {
    const to = mode === "esquematico" ? 1 : 0;
    const from = stateRef.current.t;
    if (from === to) return;
    const duration = reducedMotion() ? 0 : 900;
    const frame = (cam: Camera) => {
      const pad = framePadding();
      const focus = stateRef.current.selectedStation ? stationBySlug.get(stateRef.current.selectedStation) : null;
      const { user: me, target: dest } = stateRef.current;
      const destStation = dest ? stationBySlug.get(dest) : null;
      if (me && destStation && mode === "real") {
        // Veio do GPS: enquadra você e a estação mais próxima.
        cam.fit([me.lngLat, destStation.geo], { ...pad, top: pad.top + 60, bottom: pad.bottom + 60 }, { maxZoom: 16, duration });
      } else if (focus) {
        cam.focus(mode === "real" ? focus.geo : focus.schem, cam.getZoom(), pad, duration);
      } else {
        cam.fit(framePoints(mode, stateRef.current.showRail), pad, { duration });
      }
    };
    // No modo real a câmera é o MapLibre: enquadra quando ele estiver pronto.
    if (to === 0) void ensureMapLibre().then(frame);
    else if (cameraRef.current) frame(cameraRef.current);
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
      const cam = cameraRef.current;
      if (!st || !cam) return;
      const center = stateRef.current.t > 0.5 ? st.schem : st.geo;
      cam.focus(center, Math.max(cam.getZoom(), 14), framePadding(), reducedMotion() ? 0 : 1000);
    },
    focusPoints(points) {
      const cam = cameraRef.current;
      if (!cam || points.length === 0) return;
      const pad = framePadding();
      cam.fit(points, { ...pad, top: pad.top + 40, bottom: pad.bottom + 40 }, { maxZoom: 16, duration: reducedMotion() ? 0 : 900 });
    },
    zoomBy(delta) {
      cameraRef.current?.zoomBy(delta, reducedMotion() ? 0 : 250);
    },
  }));

  return (
    <div className="absolute inset-0" role="region" aria-label="Mapa interativo da rede" aria-describedby="mapa-alternativa">
      {/* O CSS do MapLibre põe position: relative no contêiner; o invólucro é que ocupa a tela. */}
      <div className="absolute inset-0">
        <div
          ref={containerRef}
          role="application"
          aria-roledescription="mapa"
          aria-label="Mapa: arraste ou use as setas para mover, + e − para o zoom"
          className="h-full w-full [outline-offset:-4px]"
        />
      </div>
      {/* "Papel" que cobre as ruas no modo esquemático. */}
      <div ref={paperRef} aria-hidden className="pointer-events-none absolute inset-0 bg-bg opacity-0" />
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0" />
    </div>
  );
}
