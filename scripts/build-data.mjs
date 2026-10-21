// Gera os dados do site a partir de data/raw/osm.json (rode antes scripts/fetch-osm.mjs).
// Saída: data/lines.json, data/stations.geojson, data/edges.json, data/tracks.geojson.
// Geometria e posição das estações: © OpenStreetMap contributors (ODbL).
// Cores, operadores e status: ver data/sources.md.
import { readFile, writeFile } from "node:fs/promises";
import { EXTRA_STATION_NODES, ROUTE_RELATIONS } from "./osm-config.mjs";

const root = new URL("../data/", import.meta.url);
const osm = JSON.parse(await readFile(new URL("raw/osm.json", root), "utf8"));
const colors = JSON.parse(await readFile(new URL("line-colors.json", root), "utf8"));

// ---------------------------------------------------------------- linhas

// Operadores: Mapa do Transporte Metropolitano, jul/2026. Status: notícias oficiais (sources.md).
const LINE_META = {
  1: { operador: "Metrô", tipo: "metro", status: "operando" },
  2: { operador: "Metrô", tipo: "metro", status: "operando" },
  3: { operador: "Metrô", tipo: "metro", status: "operando" },
  4: { operador: "Motiva", tipo: "metro", status: "operando" },
  5: { operador: "Motiva", tipo: "metro", status: "operando" },
  6: { operador: "Linha Uni", tipo: "metro", status: "operacao-assistida" },
  7: { operador: "TIC Trens", tipo: "trem", status: "operando" },
  8: { operador: "Motiva", tipo: "trem", status: "operando" },
  9: { operador: "Motiva", tipo: "trem", status: "operando" },
  10: { operador: "CPTM", tipo: "trem", status: "operando" },
  // Concessão da Trivia (jul/2026); após falhas a Artesp devolveu as linhas à CPTM (23/07/2026) e a
  // Trivia volta aos poucos: Linha 13 sob supervisão da CPTM desde 06/10/2026; 11 e 12 só depois.
  11: { operador: "CPTM (em transição para a Trivia)", tipo: "trem", status: "operando" },
  12: { operador: "CPTM (em transição para a Trivia)", tipo: "trem", status: "operando" },
  13: { operador: "Trivia, sob supervisão da CPTM", tipo: "trem", status: "operando" },
  15: { operador: "Metrô", tipo: "monotrilho", status: "operando" },
  17: { operador: "Metrô", tipo: "monotrilho", status: "operacao-assistida" },
};

// Sequências de estações que não vêm prontas das relações do OSM (nomes já normalizados).
const LINE_6_FULL = [
  "Brasilândia", "Maristela", "Itaberaba-Hospital Vila Penteado", "João Paulo I", "Freguesia do Ó",
  "Santa Marina", "Água Branca", "SESC-Pompeia", "Perdizes", "PUC-Cardoso de Almeida", "FAAP-Pacaembu",
  "Higienópolis-Mackenzie", "14 Bis-Saracura", "Bela Vista", "São Joaquim",
];
const LINE_6_ASSISTED = new Set(["João Paulo I", "Freguesia do Ó", "Santa Marina", "Água Branca", "SESC-Pompeia", "Perdizes"]);
// Paradas extras entram depois da estação indicada (Mapa do Transporte Metropolitano, jul/2026).
const INSERT_AFTER = {
  1: { "São Bento": "Sé" },
  10: { "Juventus-Mooca": "Brás", Tamanduateí: "Ipiranga", Utinga: "São Caetano do Sul" },
  15: { "Jardim Colonial": "São Mateus" },
};
// Ramal (formato "Y" da Linha 17): sai da estação indicada.
const BRANCHES = { 17: { from: "Brooklin Paulista" } };

// ---------------------------------------------------------------- nomes

// Nome principal + complemento (patrocínio ou homenagem), como no mapa oficial.
const COMPLEMENTS = {
  "Jabaquara - Comitê Paralímpico Brasileiro": ["Jabaquara", "Comitê Paralímpico Brasileiro"],
  "Saúde – Ultrafarma": ["Saúde", "Ultrafarma"],
  "Vergueiro - Sebrae": ["Vergueiro", "Sebrae"],
  "Carrão – Assaí Atacadista": ["Carrão", "Assaí Atacadista"],
  "Penha - Lojas Besni": ["Penha", "Lojas Besni"],
  "Faria Lima - PagBank": ["Faria Lima", "PagBank"],
  "Morumbi - Claro": ["Morumbi", "Claro"],
  "Berrini - Casas Bahia": ["Berrini", "Casas Bahia"],
  "Jurubatuba - Senac": ["Jurubatuba", "Senac"],
  "Lapa - Senac": ["Lapa", "Senac"],
  "Adolfo Pinheiro - Unisa": ["Adolfo Pinheiro", "Unisa"],
  "Vila Sônia - Professora Elizabeth Tenreiro": ["Vila Sônia", "Professora Elisabeth Tenreiro"],
  "Prefeito Celso Daniel - Santo André": ["Santo André", "Prefeito Celso Daniel"],
  "Mendes-Vila Natal": ["Mendes-Vila Natal", "Bruno Covas"],
  "São Caetano do Sul": ["São Caetano do Sul", "Prof. Walter Braido"],
  "Ribeirão Pires": ["Ribeirão Pires", "Antonio Bespalec"],
  "Jardim Silveira": ["Jardim Silveira", "Leo Madeiras"],
  "Santuário Nossa Senhora de Fátima - Sumaré": ["Sumaré", "Santuário Nossa Senhora de Fátima"],
};
const RENAMES = {
  "Estação 14 Bis": "14 Bis-Saracura",
  "Estação Itaberaba": "Itaberaba-Hospital Vila Penteado",
  "Washington Luis": "Washington Luís",
  "Lapa (Linha 7)": "Lapa",
  "Antônio João": "Antonio João",
  "Juventus - Mooca": "Juventus-Mooca",
};
// Mesmo nome, estações diferentes (sem integração): slug próprio.
const SLUG_OVERRIDES = { "Lapa (Linha 7)": "lapa-linha-7", "Lapa - Senac": "lapa-linha-8" };

function normalizeName(raw) {
  if (COMPLEMENTS[raw]) return { nome: COMPLEMENTS[raw][0], complemento: COMPLEMENTS[raw][1] };
  let n = RENAMES[raw] ?? raw;
  n = n.replace(/^Estação /, "").replace(/ \(Linha \d+\)$/, "");
  n = n.replace(/\s+[-–•]\s+/g, "-");
  return { nome: n, complemento: null };
}

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- geometria

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function haversine([lon1, lat1], [lon2, lat2]) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Douglas-Peucker em metros (projeção equiretangular local) — tolerância pequena preserva curvas.
function simplify(points, tol = 2) {
  if (points.length < 3) return points;
  const lat0 = rad(points[0][1]);
  const xy = points.map(([lon, lat]) => [rad(lon) * Math.cos(lat0) * R, rad(lat) * R]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a], [bx, by] = xy[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * xy[i][0] - dx * xy[i][1] + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = ([lon, lat]) => [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
const key = ([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`;

/** Grafo de trilhos a partir de ways com geometria; vértices identificados pela coordenada. */
function trackGraph(ways) {
  const coords = new Map();
  const adj = new Map();
  const link = (a, b) => {
    const ka = key(a), kb = key(b);
    coords.set(ka, a);
    coords.set(kb, b);
    const w = haversine(a, b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push([kb, w]);
    adj.get(kb).push([ka, w]);
  };
  for (const way of ways) {
    const pts = way.geometry.map((g) => [g.lon, g.lat]);
    for (let i = 1; i < pts.length; i++) link(pts[i - 1], pts[i]);
  }
  // Emenda pontas soltas a até 40 m de outro trecho (ways mapeados sem nó em comum).
  const ends = [...adj].filter(([, n]) => n.length === 1).map(([k]) => k);
  for (const k of ends) {
    const c = coords.get(k);
    let best = null, bestD = 40;
    for (const [k2, c2] of coords) {
      if (k2 === k || adj.get(k).some(([n]) => n === k2)) continue;
      const d = haversine(c, c2);
      if (d < bestD && d > 0) {
        bestD = d;
        best = k2;
      }
    }
    if (best) {
      adj.get(k).push([best, bestD]);
      adj.get(best).push([k, bestD]);
    }
  }
  return { coords, adj };
}

function nearestVertex(graph, p) {
  let best = null, bestD = Infinity;
  for (const [k, c] of graph.coords) {
    const d = haversine(p, c);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return { k: best, d: bestD };
}

function shortestPath(graph, from, to) {
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  const queue = [[0, from]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, u] = queue.shift();
    if (done.has(u)) continue;
    if (u === to) break;
    done.add(u);
    for (const [v, w] of graph.adj.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        queue.push([nd, v]);
      }
    }
  }
  if (!dist.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]));
  return { path: path.map((k) => graph.coords.get(k)), length: dist.get(to) };
}

// ---------------------------------------------------------------- leitura do OSM

const byKey = new Map(osm.elements.map((e) => [`${e.type}/${e.id}`, e]));
const relations = osm.elements.filter((e) => e.type === "relation" && e.tags?.route);
const looseWays = osm.elements.filter((e) => e.type === "way" && e.geometry);

/** Paradas em ordem: [{ raw, coord }] a partir das relações da linha. */
function relationStops(rel) {
  return rel.members
    .filter((m) => m.type === "node" && /^stop/.test(m.role))
    .map((m) => {
      const n = byKey.get(`node/${m.ref}`);
      return { raw: n.tags.name, coord: [n.lon, n.lat] };
    });
}

function extraStop(id) {
  const n = byKey.get(`node/${id}`);
  const raw = n.tags.name ?? (n.tags.wikipedia?.includes("Maristela") ? "Maristela" : null);
  if (!raw) throw new Error(`nó ${id} sem nome`);
  return { raw, coord: [n.lon, n.lat] };
}

const stations = new Map(); // slug -> estação
const lines = [];
const segments = []; // trechos entre estações vizinhas
const warnings = [];

function registerStop(lineId, stop, status) {
  const { nome, complemento } = normalizeName(stop.raw);
  const slug = SLUG_OVERRIDES[stop.raw] ?? slugify(nome);
  let st = stations.get(slug);
  if (!st) {
    st = { slug, nome, complemento, paradas: {}, statusPorLinha: {} };
    stations.set(slug, st);
  }
  st.complemento ??= complemento;
  for (const other of Object.values(st.paradas)) {
    const d = haversine(other, stop.coord);
    if (d > 700) warnings.push(`${slug}: paradas a ${Math.round(d)} m entre linhas — conferir se é a mesma estação`);
  }
  st.paradas[lineId] = round(stop.coord);
  st.statusPorLinha[lineId] = status;
  return slug;
}

for (const [lineIdNum, relIds] of Object.entries(ROUTE_RELATIONS)) {
  const lineId = String(lineIdNum);
  const rels = relIds.map((id) => relations.find((r) => r.id === id));
  const meta = LINE_META[lineId];
  const color = colors.find((c) => c.id === lineId);

  // Paradas em ordem (a 8 tem a extensão em outra relação, que começa onde a primeira termina).
  let stops = rels.flatMap(relationStops);
  stops = stops.filter((s, i) => i === 0 || s.raw !== stops[i - 1].raw);

  const ways = rels.flatMap((r) => r.members.filter((m) => m.type === "way" && m.role === "" && m.geometry).map((m) => ({ geometry: m.geometry })));
  if (lineId === "6" || lineId === "15" || lineId === "17") {
    const extra = looseWays.filter((w) => (lineId === "6" ? /^Linha 6/.test(w.tags?.name ?? "") : w.tags?.railway === "monorail"));
    ways.push(...extra);
  }
  const graph = trackGraph(ways);

  const sequences = [];
  const extraStops = (EXTRA_STATION_NODES[lineId] ?? []).map(extraStop);

  if (lineId === "6") {
    const all = [...stops, ...extraStops];
    const byName = new Map(all.map((s) => [normalizeName(s.raw).nome, s]));
    const seq = LINE_6_FULL.map((n) => {
      const s = byName.get(n);
      if (!s) throw new Error(`Linha 6: estação ${n} não encontrada`);
      return registerStop(lineId, s, LINE_6_ASSISTED.has(n) ? "operacao-assistida" : "em-obras");
    });
    sequences.push(seq);
  } else {
    const status = meta.status;
    const ordered = [...stops];
    for (const extra of BRANCHES[lineId] ? [] : extraStops) {
      const after = INSERT_AFTER[lineId]?.[normalizeName(extra.raw).nome];
      const idx = ordered.findIndex((s) => normalizeName(s.raw).nome === after);
      if (idx < 0) throw new Error(`Linha ${lineId}: não sei onde inserir ${extra.raw}`);
      ordered.splice(idx + 1, 0, extra);
    }
    const main = ordered.map((s) => registerStop(lineId, s, status));
    sequences.push(main);
    const branch = BRANCHES[lineId];
    if (branch) {
      const from = slugify(branch.from);
      sequences.push([from, ...extraStops.map((s) => registerStop(lineId, s, status))]);
    }
  }

  // Trechos com geometria real pelos trilhos; reta (marcada) quando não há trilho mapeado.
  for (const seq of sequences) {
    for (let i = 1; i < seq.length; i++) {
      const a = stations.get(seq[i - 1]), b = stations.get(seq[i]);
      const pa = a.paradas[lineId], pb = b.paradas[lineId];
      const status =
        a.statusPorLinha[lineId] === "em-obras" || b.statusPorLinha[lineId] === "em-obras" ? "em-obras" : meta.status;
      const va = nearestVertex(graph, pa), vb = nearestVertex(graph, pb);
      let geometry = null, length = null, aproximado = false;
      if (va.d < 150 && vb.d < 150) {
        const sp = shortestPath(graph, va.k, vb.k);
        // Caminho absurdo (>2,5x a distância em linha reta) indica trilho faltando no meio.
        if (sp && sp.length < 2.5 * haversine(pa, pb) + 200) {
          geometry = [pa, ...sp.path, pb];
          length = sp.length;
        }
      }
      if (!geometry) {
        geometry = [pa, pb];
        length = haversine(pa, pb);
        aproximado = true;
        if (status !== "em-obras") warnings.push(`Linha ${lineId}: ${a.slug} → ${b.slug} sem trilho mapeado (reta)`);
      }
      segments.push({
        linha: lineId,
        de: a.slug,
        para: b.slug,
        status,
        distanciaM: Math.round(length),
        aproximado,
        geometria: simplify(geometry.map(round)),
      });
    }
  }

  const ops = segments.filter((s) => s.linha === lineId && s.status !== "em-obras");
  lines.push({
    id: lineId,
    numero: Number(lineId),
    nome: color.nome,
    cor: color.cor,
    tinta: color.tinta,
    operador: meta.operador,
    tipo: meta.tipo,
    status: meta.status,
    extensaoOperacionalKm: Math.round(ops.reduce((t, s) => t + s.distanciaM, 0) / 100) / 10,
    sequencias: sequences,
  });
}

// ---------------------------------------------------------------- faixas paralelas (modo real)

// Trechos de linhas diferentes que correm juntos (ex.: 11 e 12 entre Brás e Tatuapé) são
// desenhados lado a lado, como no Live Subway Map. `faixa` é o deslocamento em "larguras de
// linha" para a direita do sentido de/para do próprio trecho.
function distToPolyline(p, line) {
  let best = Infinity;
  const lat0 = rad(p[1]);
  const toXY = ([lon, lat]) => [rad(lon) * Math.cos(lat0) * R, rad(lat) * R];
  const [px, py] = toXY(p);
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = toXY(line[i - 1]), [bx, by] = toXY(line[i]);
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}
function samples(line, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(line[Math.round((i / n) * (line.length - 1))]);
  return out;
}
const direction = (s) => {
  const a = s.geometria[0], b = s.geometria.at(-1);
  return [b[0] - a[0], b[1] - a[1]];
};
// Sobreposição simétrica: um trecho curto ao lado de um longo conta para os dois.
const overlaps = (a, b) => samples(a.geometria).filter((p) => distToPolyline(p, b.geometria) < 35).length >= 7;
// Corredores: trechos sobrepostos se juntam por transitividade; dentro do corredor cada linha
// tem uma posição fixa (ordem numérica), então as faixas não trocam de lado ao longo do caminho.
const parent = segments.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
for (let i = 0; i < segments.length; i++)
  for (let j = i + 1; j < segments.length; j++) {
    const [x, y] = [segments[i], segments[j]];
    if (x.linha !== y.linha && (overlaps(x, y) || overlaps(y, x))) parent[find(i)] = find(j);
  }
// Feixes vizinhos com as mesmas linhas (ex.: Vila Mariana→Ana Rosa e Ana Rosa→Paraíso, ambos 1+2)
// viram um só, para a ordem das faixas não trocar na estação do meio.
for (let changed = true; changed; ) {
  changed = false;
  const groups = new Map();
  segments.forEach((s, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, { lines: new Set(), stations: new Set() });
    groups.get(r).lines.add(s.linha);
    groups.get(r).stations.add(s.de).add(s.para);
  });
  const roots = [...groups.keys()].filter((r) => groups.get(r).lines.size > 1);
  for (let i = 0; i < roots.length && !changed; i++)
    for (let j = i + 1; j < roots.length && !changed; j++) {
      const [a, b] = [groups.get(roots[i]), groups.get(roots[j])];
      const sameLines = a.lines.size === b.lines.size && [...a.lines].every((l) => b.lines.has(l));
      const touch = [...a.stations].some((s) => b.stations.has(s));
      if (sameLines && touch) {
        parent[find(roots[i])] = find(roots[j]);
        changed = true;
      }
    }
}
const corridors = new Map();
segments.forEach((s, i) => {
  const r = find(i);
  if (!corridors.has(r)) corridors.set(r, []);
  corridors.get(r).push(s);
});
for (const members of corridors.values()) {
  const lineIds = [...new Set(members.map((m) => m.linha))].sort((x, y) => Number(x) - Number(y));
  if (lineIds.length === 1) {
    for (const m of members) m.faixa = 0;
    continue;
  }
  // Sentido de referência: o da linha de menor número, somando os trechos dela no corredor.
  const ref = members.filter((m) => m.linha === lineIds[0]).map(direction).reduce((t, d) => [t[0] + d[0], t[1] + d[1]], [0, 0]);
  // Ordem das faixas pela geometria: a linha que sai do feixe pela esquerda fica na faixa da
  // esquerda — assim as linhas não se cruzam nas pontas do feixe.
  const corridorStations = new Set(members.flatMap((m) => [m.de, m.para]));
  const leftScore = new Map(lineIds.map((l) => [l, 0]));
  for (const l of lineIds) {
    for (const o of segments) {
      if (o.linha !== l || members.includes(o)) continue;
      const from = corridorStations.has(o.de) ? o.de : corridorStations.has(o.para) ? o.para : null;
      if (!from) continue;
      const start = from === o.de ? o.geometria[0] : o.geometria.at(-1);
      const end = from === o.de ? o.geometria.at(-1) : o.geometria[0];
      const v = [end[0] - start[0], end[1] - start[1]];
      const len = Math.hypot(...v) || 1;
      // Produto vetorial > 0: a saída fica à esquerda do sentido de referência.
      leftScore.set(l, leftScore.get(l) + (ref[0] * v[1] - ref[1] * v[0]) / len);
    }
  }
  lineIds.sort((a, b) => leftScore.get(b) - leftScore.get(a) || Number(a) - Number(b));
  for (const m of members) {
    const rank = lineIds.indexOf(m.linha) - (lineIds.length - 1) / 2;
    const [dx, dy] = direction(m);
    m.faixa = dx * ref[0] + dy * ref[1] >= 0 ? rank : -rank;
  }
}

// ---------------------------------------------------------------- transferências

const transfers = [];
for (const st of stations.values()) {
  const ls = Object.keys(st.paradas);
  for (let i = 0; i < ls.length; i++)
    for (let j = i + 1; j < ls.length; j++)
      transfers.push({ estacao: st.slug, de: ls[i], para: ls[j], tipo: "mesma-estacao" });
}
// Estações de nomes diferentes ligadas por passagem interna (Mapa do Transporte Metropolitano, jul/2026).
const PASSAGES = [["paulista", "consolacao"]];
for (const [a, b] of PASSAGES) {
  if (!stations.has(a) || !stations.has(b)) throw new Error(`passagem ${a}–${b}: estação ausente`);
  transfers.push({ de: a, para: b, tipo: "passagem" });
}

// ---------------------------------------------------------------- entradas e acessibilidade

// osm-extra.json: entradas (railway=subway_entrance/train_station_entrance) e nós de estação com
// a marca wheelchair. Sem marca = sem informação (não quer dizer inacessível).
const extra = JSON.parse(await readFile(new URL("raw/osm-extra.json", root), "utf8"));
const centerOf = (st) => {
  const pts = Object.values(st.paradas);
  return [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
};
const WHEELCHAIR = { yes: "sim", designated: "sim", limited: "limitado", no: "nao" };
for (const node of extra.elements) {
  const wc = WHEELCHAIR[node.tags?.wheelchair];
  if (!wc || !node.tags?.name) continue;
  const coord = node.center ? [node.center.lon, node.center.lat] : [node.lon, node.lat];
  const slug = slugify(normalizeName(node.tags.name).nome);
  const st = stations.get(slug);
  if (!st || haversine(centerOf(st), coord) > 800) continue;
  // Qualquer nó "sim" vence; "limitado" vence "não".
  const rank = { sim: 3, limitado: 2, nao: 1 };
  if (!st.acessivel || rank[wc] > rank[st.acessivel]) st.acessivel = wc;
}
const entrances = [];
for (const node of extra.elements) {
  if (node.type !== "node" || !/entrance$/.test(node.tags?.railway ?? "")) continue;
  const coord = [node.lon, node.lat];
  let best = null, bestD = 400;
  for (const st of stations.values()) {
    const d = haversine(centerOf(st), coord);
    if (d < bestD) {
      bestD = d;
      best = st.slug;
    }
  }
  if (!best) continue;
  entrances.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: round(coord) },
    properties: { estacao: best, ref: node.tags.ref ?? null, acessivel: WHEELCHAIR[node.tags.wheelchair] ?? null },
  });
}

// ---------------------------------------------------------------- saída

const STATUS_ORDER = ["operando", "operacao-assistida", "em-obras", "planejada"];
const features = [...stations.values()]
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  .map((st) => {
    const pts = Object.values(st.paradas);
    const center = round([pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length]);
    const statuses = Object.values(st.statusPorLinha);
    const integracoes = [
      ...transfers.filter((t) => t.tipo === "passagem" && (t.de === st.slug || t.para === st.slug)).map((t) => (t.de === st.slug ? t.para : t.de)),
    ];
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: center },
      properties: {
        slug: st.slug,
        nome: st.nome,
        complemento: st.complemento,
        linhas: Object.keys(st.paradas).sort((a, b) => a - b),
        status: STATUS_ORDER.find((s) => statuses.includes(s)),
        statusPorLinha: st.statusPorLinha,
        paradas: st.paradas,
        integracoes,
        acessivel: st.acessivel ?? null,
      },
    };
  });

const attribution = "© OpenStreetMap contributors (ODbL)";
await writeFile(new URL("lines.json", root), JSON.stringify(lines, null, 2) + "\n");
await writeFile(
  new URL("stations.geojson", root),
  JSON.stringify({ type: "FeatureCollection", attribution, features }) + "\n",
);
await writeFile(
  new URL("entrances.geojson", root),
  JSON.stringify({ type: "FeatureCollection", attribution, features: entrances }) + "\n",
);
await writeFile(
  new URL("edges.json", root),
  JSON.stringify(
    {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a geometria vai só para tracks.geojson
      trechos: segments.map(({ geometria, ...s }) => s),
      transferencias: transfers,
    },
    null,
    1,
  ) + "\n",
);
await writeFile(
  new URL("tracks.geojson", root),
  JSON.stringify({
    type: "FeatureCollection",
    attribution,
    features: segments.map(({ geometria, ...p }) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: geometria },
      properties: p,
    })),
  }) + "\n",
);

console.log(`${lines.length} linhas, ${features.length} estações, ${segments.length} trechos, ${transfers.length} transferências, ${entrances.length} entradas`);
console.log(`  acessibilidade marcada no OSM: ${features.filter((f) => f.properties.acessivel).length} estações`);
for (const l of lines) console.log(`  Linha ${l.id}: ${l.sequencias.flat().length} paradas, ${l.extensaoOperacionalKm} km operacionais`);
if (warnings.length) console.log("Avisos:\n  " + warnings.join("\n  "));
