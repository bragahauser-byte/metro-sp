// Gera o diagrama esquemático (octilinear: só 0°, 45° e 90°) a partir da geografia.
// Entrada: data/lines.json, data/stations.geojson. Saída: data/schematic.json.
// As coordenadas saem em lon/lat "falsos" em torno de São Paulo, para o mapa usar a mesma câmera
// nos dois modos e a transição só interpolar posições.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../data/", import.meta.url);
const lines = JSON.parse(await readFile(new URL("lines.json", root), "utf8"));
const stations = JSON.parse(await readFile(new URL("stations.geojson", root), "utf8")).features;

// ---------------------------------------------------------------- projeção

const R = 6378137;
const merc = ([lon, lat]) => [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
const unmerc = ([x, y]) => [(x / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)];

const CENTER = merc([-46.6339, -23.5505]); // Sé
const pos = new Map(); // slug -> [x, y] em km, relativo à Sé
for (const f of stations) {
  const [x, y] = merc(f.geometry.coordinates);
  pos.set(f.properties.slug, [(x - CENTER[0]) / 1000, (y - CENTER[1]) / 1000]);
}

// Lupa radial: amplia o centro (onde as estações são densas) e comprime a periferia.
const LENS = 0.55;
for (const [slug, [x, y]] of pos) {
  const r = Math.hypot(x, y);
  if (r === 0) continue;
  const k = (3 * Math.pow(r / 3, LENS)) / r;
  pos.set(slug, [x * k, y * k]);
}
const anchor = new Map([...pos].map(([s, p]) => [s, [...p]]));

// ---------------------------------------------------------------- arestas

const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const edges = new Map(); // key -> { a, b, lines:Set }
const lineEdges = new Map(); // linha -> [[a,b], ...] na ordem das sequências
for (const l of lines) {
  const list = [];
  for (const seq of l.sequencias) {
    for (let i = 1; i < seq.length; i++) {
      const [a, b] = [seq[i - 1], seq[i]];
      const k = edgeKey(a, b);
      if (!edges.has(k)) edges.set(k, { a, b, lines: new Set() });
      edges.get(k).lines.add(l.id);
      list.push([a, b]);
    }
  }
  lineEdges.set(l.id, list);
}

const DIRS = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);
const dirIndex = ([dx, dy]) => ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;

const MIN_LEN = 2.0; // km esquemáticos entre estações vizinhas (garante espaço para os nomes)
const MIN_SEP = 1.6; // distância mínima entre estações não vizinhas

// Direção-alvo de cada aresta, com suavização ao longo de cada linha (evita zigue-zague).
function targetDirections() {
  const dir = new Map();
  for (const [k, e] of edges) {
    const [ax, ay] = pos.get(e.a), [bx, by] = pos.get(e.b);
    dir.set(k, dirIndex([bx - ax, by - ay]));
  }
  for (const list of lineEdges.values()) {
    for (let i = 1; i + 1 < list.length; i++) {
      const [p, c, n] = [list[i - 1], list[i], list[i + 1]].map(([a, b]) => {
        const d = dir.get(edgeKey(a, b));
        return a < b ? d : (d + 4) % 8; // orientado no sentido da linha
      });
      // Se os vizinhos concordam e a aresta do meio desvia só 45°, alinha com eles.
      const diff = (x, y) => Math.min((x - y + 8) % 8, (y - x + 8) % 8);
      if (p === n && diff(c, p) === 1) {
        const [a, b] = list[i];
        dir.set(edgeKey(a, b), a < b ? p : (p + 4) % 8);
      }
    }
  }
  return dir;
}

// ---------------------------------------------------------------- ajuste

// Direção e comprimento-alvo de cada trecho ficam fixos (vindos da geografia com lupa); as posições
// saem de mínimos quadrados: p_b - p_a ≈ comprimento · direção, com âncora fraca na geografia.
// Como cada trecho mantém o sentido geográfico, a ordem das estações ao longo da linha se preserva.
const dir = targetDirections();
const slugs = [...pos.keys()];
const target = new Map(); // key -> vetor alvo de a para b
for (const [k, e] of edges) {
  const [ax, ay] = anchor.get(e.a), [bx, by] = anchor.get(e.b);
  const d = DIRS[dir.get(k)];
  const len = Math.max(MIN_LEN, Math.hypot(bx - ax, by - ay));
  target.set(k, [d[0] * len, d[1] * len]);
}
const incident = new Map(slugs.map((s) => [s, []]));
for (const [k, e] of edges) {
  const [tx, ty] = target.get(k);
  incident.get(e.a).push([e.b, -tx, -ty]); // p_a ≈ p_b - T
  incident.get(e.b).push([e.a, tx, ty]); //   p_b ≈ p_a + T
}
const LAMBDA = 0.02;
for (let it = 0; it < 6000; it++) {
  for (const s of slugs) {
    const q = anchor.get(s);
    let x = LAMBDA * q[0], y = LAMBDA * q[1];
    for (const [n, tx, ty] of incident.get(s)) {
      const pn = pos.get(n);
      x += pn[0] + tx;
      y += pn[1] + ty;
    }
    const w = LAMBDA + incident.get(s).length;
    pos.set(s, [x / w, y / w]);
  }
  // Repulsão fraca entre estações que não são vizinhas (evita terminal em cima de outra linha).
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = slugs[i], b = slugs[j];
      if (incident.get(a).some(([n]) => n === b)) continue;
      const pa = pos.get(a), pb = pos.get(b);
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1];
      const d = Math.hypot(dx, dy);
      if (d >= MIN_SEP || d === 0) continue;
      const push = ((MIN_SEP - d) / d) * 0.1;
      pos.set(a, [pa[0] - dx * push, pa[1] - dy * push]);
      pos.set(b, [pb[0] + dx * push, pb[1] + dy * push]);
    }
  }
}

// ---------------------------------------------------------------- cadeias octilineares

// Estações-chave: baldeações, terminais e bifurcações. Entre duas chaves corre uma "cadeia" de
// estações de uma linha só; ela vira um caminho octilinear limpo (até duas dobras) com as
// estações espaçadas por igual — como nos diagramas de metrô desenhados à mão.
const degree = new Map(slugs.map((s) => [s, 0]));
for (const e of edges.values()) {
  degree.set(e.a, degree.get(e.a) + 1);
  degree.set(e.b, degree.get(e.b) + 1);
}
const linesAt = new Map(slugs.map((s) => [s, new Set()]));
for (const e of edges.values()) {
  for (const l of e.lines) {
    linesAt.get(e.a).add(l);
    linesAt.get(e.b).add(l);
  }
}
const isKey = (s) => degree.get(s) !== 2 || linesAt.get(s).size > 1;

const GRID = 0.25;
const snap = (p) => [Math.round(p[0] / GRID) * GRID, Math.round(p[1] / GRID) * GRID];
const ls = new Map([...pos].map(([s, p]) => [s, [...p]])); // solução de mínimos quadrados
for (const s of slugs) if (isKey(s)) pos.set(s, snap(pos.get(s)));

const adjacency = new Map(slugs.map((s) => [s, []]));
for (const e of edges.values()) {
  adjacency.get(e.a).push(e.b);
  adjacency.get(e.b).push(e.a);
}
const chains = [];
const used = new Set();
for (const start of slugs.filter(isKey)) {
  for (const next of adjacency.get(start)) {
    if (used.has(edgeKey(start, next))) continue;
    const chain = [start];
    let prev = start, cur = next;
    used.add(edgeKey(prev, cur));
    while (!isKey(cur)) {
      chain.push(cur);
      const nxt = adjacency.get(cur).find((n) => n !== prev);
      prev = cur;
      cur = nxt;
      used.add(edgeKey(prev, cur));
    }
    chain.push(cur);
    chains.push(chain);
  }
}

/** Candidatos de caminho octilinear de a até b: reto, uma dobra (2 opções) e "Z" com diagonal no meio. */
function candidates(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx < 1e-9 || ady < 1e-9 || Math.abs(adx - ady) < 1e-9) return [[a, b]];
  const sx = Math.sign(dx), sy = Math.sign(dy);
  const m = Math.min(adx, ady);
  const rest = Math.max(adx, ady) - m; // parte reta
  const horiz = adx > ady;
  const straight = (p, len) => (horiz ? [p[0] + sx * len, p[1]] : [p[0], p[1] + sy * len]);
  const diag = (p, len) => [p[0] + sx * len, p[1] + sy * len];
  const p1 = diag(a, m);
  const p2 = straight(a, rest);
  const z1 = straight(a, rest / 2), z2 = diag(z1, m);
  const z3 = diag(a, m / 2), z4 = straight(z3, rest);
  return [[a, p1, b], [a, p2, b], [a, z1, z2, b], [a, z3, z4, b]];
}

const lengthOf = (path) => path.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
function pointAt(path, t) {
  let remaining = t * lengthOf(path);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (remaining <= seg || i === path.length - 1) {
      const k = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return { p: [ax + (bx - ax) * k, ay + (by - ay) * k], i };
    }
    remaining -= seg;
  }
}
/** Trecho do caminho entre os parâmetros t0 < t1, incluindo as dobras do meio. */
function subPath(path, t0, t1) {
  const a = pointAt(path, t0), b = pointAt(path, t1);
  return [a.p, ...path.slice(a.i, b.i), b.p];
}

const segmentPaths = new Map(); // edgeKey -> caminho de a para b (na orientação de edges)
let bendCount = 0;
// Direções já ocupadas na saída de cada estação-chave: duas cadeias saindo para o mesmo lado
// ficariam desenhadas uma por cima da outra.
const usedDirs = new Map(slugs.map((s) => [s, new Set()]));
const placed = new Map(); // estações já posicionadas pelas cadeias anteriores
for (const s of slugs) if (isKey(s)) placed.set(s, pos.get(s));
// Cadeias longas primeiro: elas definem a estrutura, as curtas se acomodam.
chains.sort((x, y) => y.length - x.length);
for (const chain of chains) {
  const a = pos.get(chain[0]), b = pos.get(chain.at(-1));
  const n = chain.length - 1;
  // Escolhe o candidato que deixa as estações intermediárias mais perto da solução de mínimos quadrados.
  let best = null, bestCost = Infinity;
  for (const path of candidates(a, b)) {
    let cost = 0;
    for (let i = 1; i < n; i++) {
      const { p } = pointAt(path, i / n);
      const q = ls.get(chain[i]);
      cost += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }
    cost += (path.length - 2) * 0.05; // leve preferência por menos dobras
    const first = dirIndex([path[1][0] - path[0][0], path[1][1] - path[0][1]]);
    const last = dirIndex([path.at(-2)[0] - path.at(-1)[0], path.at(-2)[1] - path.at(-1)[1]]);
    if (usedDirs.get(chain[0]).has(first)) cost += 50;
    if (usedDirs.get(chain.at(-1)).has(last)) cost += 50;
    // Estações da cadeia não podem cair em cima de estações de outras cadeias.
    for (let i = 1; i < n; i++) {
      const { p } = pointAt(path, i / n);
      for (const [other, q] of placed) {
        if (chain.includes(other)) continue;
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < 0.8) cost += 20 * (0.8 - d);
      }
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = path;
    }
  }
  bendCount += best.length - 2;
  usedDirs.get(chain[0]).add(dirIndex([best[1][0] - best[0][0], best[1][1] - best[0][1]]));
  usedDirs.get(chain.at(-1)).add(dirIndex([best.at(-2)[0] - best.at(-1)[0], best.at(-2)[1] - best.at(-1)[1]]));
  for (let i = 1; i < n; i++) {
    pos.set(chain[i], pointAt(best, i / n).p);
    placed.set(chain[i], pos.get(chain[i]));
  }
  for (let i = 0; i < n; i++) {
    const sp = subPath(best, i / n, (i + 1) / n);
    const k = edgeKey(chain[i], chain[i + 1]);
    segmentPaths.set(k, edges.get(k).a === chain[i] ? sp : sp.reverse());
  }
}

const toLonLat = ([x, y]) => {
  const [lon, lat] = unmerc([x * 1000 + CENTER[0], y * 1000 + CENTER[1]]);
  return [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
};

const out = { estacoes: {}, trechos: {} };
for (const [slug, p] of pos) out.estacoes[slug] = toLonLat(p);
for (const k of edges.keys()) out.trechos[k] = segmentPaths.get(k).map(toLonLat);

// Diagnóstico: estações sobrepostas (ou quase) atrapalham a leitura.
let overlaps = 0;
for (let i = 0; i < slugs.length; i++)
  for (let j = i + 1; j < slugs.length; j++) {
    const p = pos.get(slugs[i]), q = pos.get(slugs[j]);
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.3) {
      overlaps++;
      console.warn(`muito perto: ${slugs[i]} e ${slugs[j]}`);
    }
  }
await writeFile(new URL("schematic.json", root), JSON.stringify(out) + "\n");
console.log(`schematic.json: ${slugs.length} estações, ${chains.length} cadeias, ${bendCount} dobras, ${overlaps} quase sobreposições`);
