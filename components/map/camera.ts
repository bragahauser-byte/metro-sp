// Câmeras do mapa. A rede é desenhada pelo NetworkRenderer, que só precisa projetar coordenadas
// e saber o zoom; quem move a vista é uma "câmera":
//   - SchematicCamera: leve, sem dependências, para o modo esquemático (o padrão). Usa a mesma
//     projeção Web Mercator (tiles de 512 px) do MapLibre, então trocar de câmera não dá salto.
//   - MapLibreCamera: adapta o MapLibre, carregado só quando o modo real é aberto.
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Pt } from "./geometry";
import type { LngLat } from "./network";

export type Padding = { top: number; right: number; bottom: number; left: number };

export type CameraEvents = {
  render: () => void;
  moveend: () => void;
  click: (p: Pt) => void;
  hover: (p: Pt) => void;
};

export interface Camera {
  project(ll: LngLat): Pt;
  getZoom(): number;
  getCenter(): LngLat;
  /** Enquadra os pontos na área livre (padding) com animação. */
  fit(points: LngLat[], padding: Padding, opts: { maxZoom?: number; duration: number }): void;
  /** Leva o ponto ao centro da área livre, no zoom pedido. */
  focus(ll: LngLat, zoom: number, padding: Padding, duration: number): void;
  zoomBy(delta: number, duration: number): void;
  setCursor(cursor: string): void;
  destroy(): void;
}

export const MIN_ZOOM = 8.5;
export const MAX_ZOOM = 17.5;
export const BOUNDS: [LngLat, LngLat] = [
  [-47.6, -24.3],
  [-45.6, -22.8],
];

// ---------------------------------------------------------------- projeção

const TILE = 512;
const clampLat = (lat: number) => Math.max(-85.05, Math.min(85.05, lat));
/** Coordenada "mundo" em fração [0,1] (Web Mercator). */
function toWorld([lng, lat]: LngLat): [number, number] {
  const s = Math.sin((clampLat(lat) * Math.PI) / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}
function fromWorld([x, y]: [number, number]): LngLat {
  const lng = x * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return [lng, lat];
}

function boundsZoom(points: LngLat[], w: number, h: number, pad: Padding, maxZoom: number) {
  const ws = points.map(toWorld);
  const xs = ws.map((p) => p[0]), ys = ws.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const availW = Math.max(40, w - pad.left - pad.right), availH = Math.max(40, h - pad.top - pad.bottom);
  const zx = Math.log2(availW / (Math.max(1e-9, x1 - x0) * TILE));
  const zy = Math.log2(availH / (Math.max(1e-9, y1 - y0) * TILE));
  const zoom = Math.max(MIN_ZOOM, Math.min(maxZoom, zx, zy));
  return { zoom, world: [(x0 + x1) / 2, (y0 + y1) / 2] as [number, number] };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// ---------------------------------------------------------------- câmera própria

export class SchematicCamera implements Camera {
  private center: [number, number]; // mundo
  private zoom: number;
  private w = 0;
  private h = 0;
  private raf = 0;
  private pointers = new Map<number, Pt>();
  private moved = false;
  private pinch: { dist: number; zoom: number } | null = null;
  private wheelEnd = 0;
  private cleanup: (() => void)[] = [];

  constructor(
    private el: HTMLElement,
    view: { center: LngLat; zoom: number },
    private on: CameraEvents,
  ) {
    this.center = toWorld(view.center);
    this.zoom = view.zoom;
    this.resize();
    const listen = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn));
    };
    el.style.touchAction = "none";
    el.style.cursor = "grab";
    listen("pointerdown", (e) => this.down(e));
    listen("pointermove", (e) => this.move(e));
    listen("pointerup", (e) => this.up(e));
    listen("pointercancel", (e) => this.up(e));
    listen("wheel", (e) => this.wheel(e), { passive: false });
    // Teclado: setas movem, + e − aproximam/afastam (o mapa recebe foco com Tab).
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
    listen("keydown", (e) => {
      const step = 80 / this.scale;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => this.animate([this.center[0] - step, this.center[1]], this.zoom, 150),
        ArrowRight: () => this.animate([this.center[0] + step, this.center[1]], this.zoom, 150),
        ArrowUp: () => this.animate([this.center[0], this.center[1] - step], this.zoom, 150),
        ArrowDown: () => this.animate([this.center[0], this.center[1] + step], this.zoom, 150),
        "+": () => this.zoomBy(1, 200),
        "=": () => this.zoomBy(1, 200),
        "-": () => this.zoomBy(-1, 200),
      };
      const fn = keys[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    });
    listen("dblclick", (e) => {
      const p = this.local(e);
      this.zoomAround(p, this.zoom + (e.shiftKey ? -1 : 1), 250);
    });
    const ro = new ResizeObserver(() => {
      this.resize();
      this.on.render();
    });
    ro.observe(el);
    this.cleanup.push(() => ro.disconnect());
  }

  private resize() {
    this.w = this.el.clientWidth;
    this.h = this.el.clientHeight;
  }

  private local(e: MouseEvent): Pt {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private get scale() {
    return TILE * 2 ** this.zoom;
  }

  project(ll: LngLat): Pt {
    const [x, y] = toWorld(ll);
    return { x: (x - this.center[0]) * this.scale + this.w / 2, y: (y - this.center[1]) * this.scale + this.h / 2 };
  }

  private unprojectWorld(p: Pt): [number, number] {
    return [this.center[0] + (p.x - this.w / 2) / this.scale, this.center[1] + (p.y - this.h / 2) / this.scale];
  }

  getZoom() {
    return this.zoom;
  }

  getCenter(): LngLat {
    return fromWorld(this.center);
  }

  private clamp() {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom));
    const [a, b] = BOUNDS.map(toWorld);
    this.center = [Math.max(a[0], Math.min(b[0], this.center[0])), Math.max(b[1], Math.min(a[1], this.center[1]))];
  }

  private animate(toCenter: [number, number], toZoom: number, duration: number) {
    cancelAnimationFrame(this.raf);
    const fromC = this.center, fromZ = this.zoom;
    if (duration <= 0) {
      this.center = toCenter;
      this.zoom = toZoom;
      this.clamp();
      this.on.render();
      this.on.moveend();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - start) / duration));
      // Interpola no espaço de tela do zoom (passeio suave mesmo com zoom grande).
      this.zoom = fromZ + (toZoom - fromZ) * k;
      this.center = [fromC[0] + (toCenter[0] - fromC[0]) * k, fromC[1] + (toCenter[1] - fromC[1]) * k];
      this.clamp();
      this.on.render();
      if (k < 1) this.raf = requestAnimationFrame(step);
      else this.on.moveend();
    };
    this.raf = requestAnimationFrame(step);
  }

  /** Centro (mundo) que deixa `world` no meio da área livre, no zoom `zoom`. */
  private paddedCenter(world: [number, number], zoom: number, pad: Padding): [number, number] {
    const s = TILE * 2 ** zoom;
    return [world[0] - (pad.left - pad.right) / 2 / s, world[1] - (pad.top - pad.bottom) / 2 / s];
  }

  fit(points: LngLat[], padding: Padding, opts: { maxZoom?: number; duration: number }) {
    if (!points.length) return;
    const { zoom, world } = boundsZoom(points, this.w, this.h, padding, opts.maxZoom ?? MAX_ZOOM);
    this.animate(this.paddedCenter(world, zoom, padding), zoom, opts.duration);
  }

  focus(ll: LngLat, zoom: number, padding: Padding, duration: number) {
    this.animate(this.paddedCenter(toWorld(ll), zoom, padding), zoom, duration);
  }

  zoomBy(delta: number, duration: number) {
    this.zoomAround({ x: this.w / 2, y: this.h / 2 }, this.zoom + delta, duration);
  }

  /** Muda o zoom mantendo fixo o ponto da tela `p` (sob o cursor ou entre os dedos). */
  private zoomAround(p: Pt, zoom: number, duration: number) {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const anchor = this.unprojectWorld(p);
    const s = TILE * 2 ** z;
    const center: [number, number] = [anchor[0] - (p.x - this.w / 2) / s, anchor[1] - (p.y - this.h / 2) / s];
    this.animate(center, z, duration);
  }

  setCursor(cursor: string) {
    this.el.style.cursor = cursor || "grab";
  }

  private down(e: PointerEvent) {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this.local(e));
    cancelAnimationFrame(this.raf);
    this.moved = false;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
    }
  }

  private move(e: PointerEvent) {
    const p = this.local(e);
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === "mouse") this.on.hover(p);
      return;
    }
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2 && this.pinch) {
      // Pinça: zoom pela distância entre os dedos, ancorado no ponto médio.
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const anchor = this.unprojectWorld(mid);
      this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinch.zoom + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.dist)));
      const s = this.scale;
      this.center = [anchor[0] - (mid.x - this.w / 2) / s, anchor[1] - (mid.y - this.h / 2) / s];
      // Arrastar com os dois dedos também move a vista.
      const dx = (p.x - prev.x) / 2, dy = (p.y - prev.y) / 2;
      this.center = [this.center[0] - dx / s, this.center[1] - dy / s];
      this.moved = true;
    } else if (this.pointers.size === 1) {
      const dx = p.x - prev.x, dy = p.y - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) {
        this.center = [this.center[0] - dx / this.scale, this.center[1] - dy / this.scale];
        if (Math.hypot(dx, dy) > 1) this.moved = true;
        this.el.style.cursor = "grabbing";
      }
    }
    this.clamp();
    this.on.render();
  }

  private up(e: PointerEvent) {
    const p = this.local(e);
    const wasPinch = this.pointers.size === 2;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    this.el.style.cursor = "grab";
    if (this.pointers.size === 0) {
      if (!this.moved && !wasPinch && e.type === "pointerup") this.on.click(p);
      else this.on.moveend();
    }
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    const p = this.local(e);
    // Trackpad (deltas pequenos) ou roda do mouse.
    const delta = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022);
    cancelAnimationFrame(this.raf);
    const anchor = this.unprojectWorld(p);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + delta));
    const s = this.scale;
    this.center = [anchor[0] - (p.x - this.w / 2) / s, anchor[1] - (p.y - this.h / 2) / s];
    this.clamp();
    this.on.render();
    window.clearTimeout(this.wheelEnd);
    this.wheelEnd = window.setTimeout(() => this.on.moveend(), 200);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.wheelEnd);
    for (const fn of this.cleanup) fn();
    this.el.style.touchAction = "";
    this.el.style.cursor = "";
  }
}

// ---------------------------------------------------------------- MapLibre

export class MapLibreCamera implements Camera {
  constructor(
    public map: MapLibreMap,
    on: CameraEvents,
  ) {
    map.on("render", () => on.render());
    map.on("moveend", () => on.moveend());
    map.on("click", (e) => on.click({ x: e.point.x, y: e.point.y }));
    map.on("mousemove", (e) => on.hover({ x: e.point.x, y: e.point.y }));
  }

  project(ll: LngLat): Pt {
    const p = this.map.project(ll);
    return { x: p.x, y: p.y };
  }

  getZoom() {
    return this.map.getZoom();
  }

  getCenter(): LngLat {
    const c = this.map.getCenter();
    return [c.lng, c.lat];
  }

  fit(points: LngLat[], padding: Padding, opts: { maxZoom?: number; duration: number }) {
    if (!points.length) return;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const cam = this.map.cameraForBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      // maxZoom só quando definido: undefined explícito vira NaN dentro do MapLibre.
      opts.maxZoom === undefined ? { padding } : { padding, maxZoom: opts.maxZoom },
    );
    if (cam) this.map.easeTo({ ...cam, duration: opts.duration });
  }

  focus(ll: LngLat, zoom: number, padding: Padding, duration: number) {
    this.map.flyTo({ center: ll, zoom, padding, duration });
  }

  zoomBy(delta: number, duration: number) {
    this.map.easeTo({ zoom: this.map.getZoom() + delta, duration });
  }

  setCursor(cursor: string) {
    this.map.getCanvas().style.cursor = cursor;
  }

  destroy() {
    this.map.remove();
  }
}
