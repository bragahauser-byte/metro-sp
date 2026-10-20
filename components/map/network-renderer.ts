// Desenha a rede numa camada de canvas sincronizada com a câmera do MapLibre, no visual do Live
// Subway Map: faixas paralelas com fio na cor do fundo, larguras que crescem com o zoom, curvas de
// raio constante, pontos pretos por linha, baldeação como fio fino e rótulos com colisão.
// O parâmetro `t` interpola real (0) ↔ esquemático (1), estação por estação.
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  type Box,
  type Pt,
  intersects,
  lerp,
  normal,
  offsetPolyline,
  resample,
  tracePath,
} from "./geometry";
import { type LngLat, RAIL_LINES, type Segment, type Station, lineById, segments, stationBySlug, stations } from "./network";

const MORPH_SAMPLES = 40;

type Prepared = Segment & {
  geoR: LngLat[];
  schemR: LngLat[];
  /** Deslocamento (em larguras) no início e no fim do trecho, em cada modo. */
  geoEnds: [number, number];
  schemEnds: [number, number];
};

// Nas estações, a faixa de uma linha tem o mesmo deslocamento dos dois lados: se um trecho vizinho
// está num feixe e este não, este faz a rampa até ele (sem degrau nem troca de lado na estação).
function endOffset(own: number, neighbor: number | undefined) {
  if (neighbor === undefined || neighbor === own) return own;
  if (own === 0) return neighbor;
  if (neighbor === 0) return own;
  return (own + neighbor) / 2;
}
const prepared: Prepared[] = segments.map((s) => {
  const prev = segments.find((o) => o.linha === s.linha && o.para === s.de);
  const next = segments.find((o) => o.linha === s.linha && o.de === s.para);
  return {
    ...s,
    geoR: resample(s.geo, MORPH_SAMPLES),
    schemR: resample(s.schem, MORPH_SAMPLES),
    geoEnds: [endOffset(s.faixaGeo, prev?.faixaGeo), endOffset(s.faixaGeo, next?.faixaGeo)],
    schemEnds: [endOffset(s.faixaSchem, prev?.faixaSchem), endOffset(s.faixaSchem, next?.faixaSchem)],
  };
});

// Ordem de desenho: trens embaixo, metrô por cima (linhas de número menor por último, no topo).
const LINE_ORDER = [...new Set(prepared.map((s) => s.linha))].sort((a, b) => {
  const ra = RAIL_LINES.has(a) ? 0 : 1, rb = RAIL_LINES.has(b) ? 0 : 1;
  return ra - rb || Number(b) - Number(a);
});

const TERMINALS = new Set(
  [...lineById.values()].flatMap((l) => l.sequencias.flatMap((seq) => [seq[0], seq[seq.length - 1]])),
);

/** Largura da linha (px) por zoom — fina de longe, faixa larga de perto. */
export function lineWidth(z: number) {
  const stops: [number, number][] = [
    [8, 1.2], [10, 2], [11, 2.5], [12, 3.5], [13, 5], [14, 8], [15, 12], [16, 16], [17, 22],
  ];
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (z <= stops[i][0]) {
      const [z0, w0] = stops[i - 1], [z1, w1] = stops[i];
      return lerp(w0, w1, (z - z0) / (z1 - z0));
    }
  }
  return stops[stops.length - 1][1];
}

export type RenderState = {
  t: number; // 0 = real, 1 = esquemático
  showRail: boolean;
  selectedLine: string | null;
  selectedStation: string | null;
  hoveredStation: string | null;
  user: { lngLat: LngLat; accuracy: number } | null;
  target: string | null; // estação de destino a pé (GPS)
};

type Colors = { bg: string; ink: string; muted: string; focus: string; font: string };

type DotInfo = { x: number; y: number; linha: string; tx: number; ty: number };
type Placed = { slug: string; dots: DotInfo[]; label?: Box };

export class NetworkRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private colors: Colors;
  private measureCache = new Map<string, number>();
  /** Posições de tela do último quadro (para o clique encontrar a estação). */
  private placed: Placed[] = [];

  constructor(
    private map: MapLibreMap,
    private canvas: HTMLCanvasElement,
    public state: RenderState,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2D indisponível");
    this.ctx = ctx;
    this.colors = this.readColors();
  }

  readColors(): Colors {
    const css = getComputedStyle(document.documentElement);
    const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
    return {
      bg: v("--bg", "#f5f5f5"),
      ink: v("--ink", "#111111"),
      muted: v("--ink-muted", "#5c5c5c"),
      focus: v("--focus", "#0063ba"),
      font: getComputedStyle(document.body).fontFamily || "Inter, Helvetica, Arial, sans-serif",
    };
  }

  refreshColors() {
    this.colors = this.readColors();
    this.measureCache.clear();
  }

  resize(width: number, height: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private project([lng, lat]: LngLat): Pt {
    const p = this.map.project([lng, lat]);
    return { x: p.x, y: p.y };
  }

  private visibleLine(id: string) {
    return this.state.showRail || !RAIL_LINES.has(id);
  }

  private stationVisible(st: Station) {
    return st.linhas.some((l) => this.visibleLine(l));
  }

  private measure(text: string, font: string) {
    const k = `${font}|${text}`;
    let w = this.measureCache.get(k);
    if (w === undefined) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
      this.measureCache.set(k, w);
    }
    return w;
  }

  draw() {
    const { ctx, state, colors } = this;
    const z = this.map.getZoom();
    const t = state.t;
    const W = lineWidth(z);
    const gap = Math.max(1, W * 0.22);
    const spacing = W + gap;
    const radius = lerp(W * 1.5, Math.max(W * 2.2, 10), t);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    // ---------------------------------------------------------------- trechos
    const screen = new Map<Prepared, Pt[]>();
    for (const s of prepared) {
      if (!this.visibleLine(s.linha)) continue;
      const src = t <= 0 ? s.geo : t >= 1 ? s.schem : null;
      const pts = src
        ? src.map((p) => this.project(p))
        : s.geoR.map((g, i) => this.project([lerp(g[0], s.schemR[i][0], t), lerp(g[1], s.schemR[i][1], t)]));
      const off0 = lerp(s.geoEnds[0], s.schemEnds[0], t) * spacing;
      const off1 = lerp(s.geoEnds[1], s.schemEnds[1], t) * spacing;
      screen.set(s, offsetPolyline(pts, [off0, off1]));
    }

    const dim = (linha: string) => (state.selectedLine && state.selectedLine !== linha ? 0.16 : 1);

    for (const linha of LINE_ORDER) {
      if (!this.visibleLine(linha)) continue;
      const line = lineById.get(linha)!;
      const segs = prepared.filter((s) => s.linha === linha && screen.has(s));
      ctx.globalAlpha = dim(linha);
      // Contorno na cor do fundo: separa faixas vizinhas e corta a linha de baixo nos cruzamentos.
      ctx.lineJoin = "round";
      ctx.lineCap = "butt";
      ctx.setLineDash([]);
      ctx.strokeStyle = colors.bg;
      ctx.lineWidth = W + gap * 2;
      ctx.beginPath();
      for (const s of segs) tracePath(ctx, screen.get(s)!, radius);
      ctx.stroke();
      // A cor da linha; trechos em obras tracejados.
      ctx.strokeStyle = line.cor;
      ctx.lineWidth = W;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const s of segs) if (s.status !== "em-obras") tracePath(ctx, screen.get(s)!, radius);
      ctx.stroke();
      const building = segs.filter((s) => s.status === "em-obras");
      if (building.length) {
        ctx.lineCap = "butt";
        ctx.setLineDash([W * 1.6, W * 1.1]);
        ctx.beginPath();
        for (const s of building) tracePath(ctx, screen.get(s)!, radius);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;

    // ---------------------------------------------------------------- estações
    const placed: Placed[] = [];
    for (const st of stations) {
      if (!this.stationVisible(st)) continue;
      const dots: DotInfo[] = [];
      for (const linha of st.linhas) {
        if (!this.visibleLine(linha)) continue;
        // Ponto da estação nesta linha = ponta (deslocada) dos trechos que chegam nela.
        let x = 0, y = 0, n = 0, tx = 0, ty = 0;
        for (const s of prepared) {
          if (s.linha !== linha) continue;
          const pts = screen.get(s);
          if (!pts) continue;
          if (s.de === st.slug) {
            x += pts[0].x;
            y += pts[0].y;
            const nn = normal(pts[0], pts[Math.min(1, pts.length - 1)]);
            tx += nn.y;
            ty -= nn.x;
            n++;
          } else if (s.para === st.slug) {
            const l = pts.length - 1;
            x += pts[l].x;
            y += pts[l].y;
            const nn = normal(pts[Math.max(0, l - 1)], pts[l]);
            tx += nn.y;
            ty -= nn.x;
            n++;
          }
        }
        if (n === 0) continue;
        const tl = Math.hypot(tx, ty) || 1;
        dots.push({ x: x / n, y: y / n, linha, tx: tx / tl, ty: ty / tl });
      }
      if (dots.length) placed.push({ slug: st.slug, dots });
    }
    this.placed = placed;

    const showDots = z >= 10.8 || t > 0.5;
    const dotR = Math.min(9, Math.max(2.4, W * 0.42));

    if (showDots) {
      // Baldeação: fio preto fino ligando os pontos da mesma estação (e passagens entre estações).
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = Math.max(1.2, W * 0.12);
      ctx.lineCap = "round";
      for (const p of placed) {
        if (p.dots.length < 2) continue;
        ctx.globalAlpha = state.selectedLine && !p.dots.some((d) => d.linha === state.selectedLine) ? 0.16 : 1;
        ctx.beginPath();
        const sorted = [...p.dots].sort((a, b) => a.x - b.x || a.y - b.y);
        ctx.moveTo(sorted[0].x, sorted[0].y);
        for (const d of sorted.slice(1)) ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }
      for (const st of stations) {
        for (const other of st.integracoes) {
          const a = placed.find((p) => p.slug === st.slug), b = placed.find((p) => p.slug === other);
          if (!a || !b || st.slug > other) continue;
          // Passagem só aparece quando as estações estão de fato próximas na tela (no real, de perto).
          if (t > 0.5 || Math.hypot(a.dots[0].x - b.dots[0].x, a.dots[0].y - b.dots[0].y) > 12 * spacing + 40) continue;
          ctx.globalAlpha = state.selectedLine ? 0.16 : 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(a.dots[0].x, a.dots[0].y);
          ctx.lineTo(b.dots[0].x, b.dots[0].y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // Pontos pretos, um por linha.
      for (const p of placed) {
        for (const d of p.dots) {
          ctx.globalAlpha = dim(d.linha);
          ctx.fillStyle = colors.ink;
          ctx.beginPath();
          ctx.arc(d.x, d.y, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // De perto, o número da linha sob cada ponto (como as letras do Live Subway Map).
      if (z >= 15) {
        const size = Math.round(Math.min(16, W * 0.75));
        ctx.font = `700 ${size}px ${colors.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const p of placed) {
          for (const d of p.dots) {
            ctx.globalAlpha = dim(d.linha);
            const off = dotR + size * 0.8;
            ctx.fillStyle = colors.ink;
            ctx.fillText(d.linha, d.x + d.tx * off, d.y + d.ty * off);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------- destaques
    const highlight = (slug: string | null, strong: boolean) => {
      const p = slug ? placed.find((q) => q.slug === slug) : null;
      if (!p) return;
      const xs = p.dots.map((d) => d.x), ys = p.dots.map((d) => d.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const r = Math.max(10, Math.hypot(Math.max(...xs) - cx, Math.max(...ys) - cy) + dotR + 6);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = strong ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    highlight(state.hoveredStation, false);
    highlight(state.selectedStation, true);

    // ---------------------------------------------------------------- GPS
    if (state.user) {
      const u = this.project(state.user.lngLat);
      const target = state.target ? placed.find((p) => p.slug === state.target) : null;
      if (target) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 5]);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(target.dots[0].x, target.dots[0].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Círculo de precisão (em metros → px pela escala atual).
      const metersPerPx = (40075016.686 * Math.cos((state.user.lngLat[1] * Math.PI) / 180)) / (512 * 2 ** z);
      const acc = state.user.accuracy / metersPerPx;
      if (acc > 10 && t < 0.5) {
        ctx.fillStyle = colors.focus;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.arc(u.x, u.y, acc, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(u.x, u.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.focus;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---------------------------------------------------------------- rótulos
    this.drawLabels(placed, z, dotR);
  }

  private drawLabels(placed: Placed[], z: number, dotR: number) {
    const { ctx, state, colors } = this;
    const t = state.t;
    const effectiveZ = z + t * 0.6; // o esquemático é mais legível no mesmo zoom
    if (effectiveZ < 10.3) return;
    const size = effectiveZ < 12 ? 11 : effectiveZ < 13.5 ? 12.5 : effectiveZ < 15 ? 14 : 16;
    const font = `700 ${size}px ${colors.font}`;
    const small = `400 ${Math.round(size * 0.72)}px ${colors.font}`;
    const showAll = effectiveZ >= 12;
    const showComplement = effectiveZ >= 14;
    const lh = size * 1.15;

    const priority = (slug: string) => {
      const st = stationBySlug.get(slug)!;
      if (slug === state.selectedStation) return 0;
      if (st.linhas.length > 1) return 1;
      if (TERMINALS.has(slug)) return 2;
      return 3;
    };
    const order = [...placed]
      .filter((p) => {
        if (state.selectedLine) return p.dots.some((d) => d.linha === state.selectedLine) || p.slug === state.selectedStation;
        return showAll || priority(p.slug) <= 2;
      })
      .sort((a, b) => priority(a.slug) - priority(b.slug));

    // Obstáculos: os próprios pontos de todas as estações.
    const boxes: Box[] = [];
    for (const p of placed) for (const d of p.dots) boxes.push({ x: d.x - dotR, y: d.y - dotR, w: dotR * 2, h: dotR * 2 });

    ctx.textBaseline = "alphabetic";
    for (const p of order) {
      const st = stationBySlug.get(p.slug)!;
      const lines = wrapName(st.nome);
      const textW = Math.max(...lines.map((l) => this.measure(l, font)));
      const extra = showComplement && st.complemento ? [st.complemento] : [];
      const blockH = lines.length * lh + extra.length * size * 0.9;

      const xs = p.dots.map((d) => d.x), ys = p.dots.map((d) => d.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const halfX = (Math.max(...xs) - Math.min(...xs)) / 2 + dotR + 5;
      const halfY = (Math.max(...ys) - Math.min(...ys)) / 2 + dotR + 5;
      // Direção local da linha (média das tangentes).
      let tx = 0, ty = 0;
      for (const d of p.dots) {
        tx += d.tx;
        ty += d.ty;
      }
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const horizontal = Math.abs(tx) > 0.85;

      type Cand = { x: number; y: number; align: CanvasTextAlign; rotate: boolean };
      const cands: Cand[] = horizontal
        ? [
            { x: cx, y: cy - halfY - 2, align: "left", rotate: true },
            { x: cx, y: cy - halfY - 4 - blockH + size, align: "center", rotate: false },
            { x: cx, y: cy + halfY + size, align: "center", rotate: false },
          ]
        : [
            { x: cx + halfX, y: cy - blockH / 2 + size * 0.8, align: "left", rotate: false },
            { x: cx - halfX, y: cy - blockH / 2 + size * 0.8, align: "right", rotate: false },
            { x: cx, y: cy - halfY - blockH + size * 0.7, align: "center", rotate: false },
            { x: cx, y: cy + halfY + size, align: "center", rotate: false },
          ];

      let chosen: { c: Cand; box: Box } | null = null;
      for (const c of cands) {
        const box = labelBox(c, textW, blockH, size);
        if (box.x + box.w < 0 || box.x > this.width || box.y + box.h < 0 || box.y > this.height) continue;
        if (boxes.some((b) => intersects(b, box))) continue;
        chosen = { c, box };
        break;
      }
      if (!chosen) continue;
      boxes.push(chosen.box);
      p.label = chosen.box;

      const { c } = chosen;
      ctx.save();
      ctx.globalAlpha = state.selectedLine && !p.dots.some((d) => d.linha === state.selectedLine) ? 0.3 : 1;
      ctx.translate(c.x, c.y);
      if (c.rotate) ctx.rotate(-Math.PI / 4);
      ctx.textAlign = c.align;
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors.bg;
      ctx.fillStyle = colors.ink;
      ctx.font = font;
      lines.forEach((l, i) => {
        ctx.strokeText(l, 0, i * lh);
        ctx.fillText(l, 0, i * lh);
      });
      if (extra.length) {
        ctx.font = small;
        ctx.fillStyle = colors.muted;
        const y = (lines.length - 1) * lh + size * 0.95;
        ctx.strokeText(extra[0], 0, y);
        ctx.fillText(extra[0], 0, y);
      }
      ctx.restore();
    }
  }

  /** Estação sob o ponto (px), pelos pontos e pelo rótulo do último quadro. */
  hitTest(x: number, y: number): string | null {
    let best: string | null = null, bestD = 18;
    for (const p of this.placed) {
      for (const d of p.dots) {
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < bestD) {
          bestD = dist;
          best = p.slug;
        }
      }
      if (!best && p.label && x >= p.label.x && x <= p.label.x + p.label.w && y >= p.label.y && y <= p.label.y + p.label.h) {
        best = p.slug;
      }
    }
    return best;
  }
}

/** Quebra nomes longos em duas linhas no hífen ou espaço mais perto do meio. */
function wrapName(name: string): string[] {
  if (name.length <= 16) return [name];
  const mid = name.length / 2;
  let best = -1;
  for (let i = 0; i < name.length; i++) {
    const breakable = name[i] === " " || name[i] === "-";
    if (breakable && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  if (best < 0) return [name];
  const cut = name[best] === "-" ? best + 1 : best;
  return [name.slice(0, cut).trim(), name.slice(cut).trim()];
}

function labelBox(c: { x: number; y: number; align: CanvasTextAlign; rotate: boolean }, w: number, h: number, size: number): Box {
  if (c.rotate) {
    // Texto a 45°: caixa envolvente do retângulo girado.
    const d = (w + h) / Math.SQRT2;
    return { x: c.x - 2, y: c.y - d, w: d, h: d };
  }
  const x = c.align === "left" ? c.x : c.align === "right" ? c.x - w : c.x - w / 2;
  return { x: x - 2, y: c.y - size, w: w + 4, h: h + 2 };
}
