// Geometria de tela para o desenho da rede: reamostragem, interpolação entre modos, deslocamento
// lateral de faixas e caminhos com curvas de raio constante.

export type Pt = { x: number; y: number };

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function length(points: number[][]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

/** n pontos igualmente espaçados ao longo da polilinha (para interpolar real ↔ esquemático). */
export function resample<T extends number[]>(points: T[], n: number): T[] {
  const total = length(points);
  if (total === 0) return Array.from({ length: n }, () => [...points[0]] as T);
  const out: T[] = [];
  let seg = 1;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    while (seg < points.length - 1) {
      const l = Math.hypot(points[seg][0] - points[seg - 1][0], points[seg][1] - points[seg - 1][1]);
      if (acc + l >= target) break;
      acc += l;
      seg++;
    }
    const a = points[seg - 1], b = points[seg];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = Math.min(1, Math.max(0, (target - acc) / l));
    out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] as T);
  }
  return out;
}

/**
 * Desloca a polilinha para a direita do sentido de percurso (junções em meia-esquadria).
 * `d` é um valor fixo em px ou um par [início, fim] que varia ao longo do comprimento — assim a
 * faixa entra e sai de um feixe de linhas sem degrau nas estações.
 */
export function offsetPolyline(pts: Pt[], d: number | [number, number]): Pt[] {
  const [d0, d1] = typeof d === "number" ? [d, d] : d;
  if ((d0 === 0 && d1 === 0) || pts.length < 2) return pts;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1] || 1;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    const n1 = normal(i > 0 ? prev : pts[i], i > 0 ? pts[i] : next);
    const n2 = normal(i < pts.length - 1 ? pts[i] : prev, i < pts.length - 1 ? next : pts[i]);
    let nx = n1.x + n2.x, ny = n1.y + n2.y;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    // Fator de meia-esquadria, limitado para curvas fechadas não explodirem.
    const cos = nx * n1.x + ny * n1.y;
    const miter = Math.min(2, 1 / Math.max(0.5, cos));
    const di = lerp(d0, d1, cum[i] / total);
    out.push({ x: pts[i].x + nx * di * miter, y: pts[i].y + ny * di * miter });
  }
  return out;
}

export function normal(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  // Direita do sentido de percurso na tela (y para baixo).
  return { x: -dy / l, y: dx / l };
}

/**
 * Traça a polilinha no contexto arredondando cada dobra com raio constante `r` (limitado pela
 * metade dos segmentos vizinhos) — as curvas do Live Subway Map.
 */
export function tracePath(ctx: CanvasRenderingContext2D, pts: Pt[], r: number) {
  if (pts.length === 0) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.5) ctx.lineTo(b.x, b.y);
    else ctx.arcTo(b.x, b.y, c.x, c.y, rr);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

export type Box = { x: number; y: number; w: number; h: number };

export function intersects(a: Box, b: Box) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
