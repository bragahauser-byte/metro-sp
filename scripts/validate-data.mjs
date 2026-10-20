// Confere a consistência dos dados em /data. Sai com código 1 se algo falhar.
// Uso: npm run validate
import { readFile } from "node:fs/promises";

const read = async (f) => JSON.parse(await readFile(new URL(`../data/${f}`, import.meta.url), "utf8"));
const lines = await read("lines.json");
const stations = (await read("stations.geojson")).features;
const { trechos, transferencias } = await read("edges.json");
const tracks = (await read("tracks.geojson")).features;
const colors = await read("line-colors.json");
const tokens = await readFile(new URL("../styles/tokens.css", import.meta.url), "utf8");

const STATUS = new Set(["operando", "operacao-assistida", "em-obras", "planejada"]);
const errors = [];
const fail = (msg) => errors.push(msg);

// Linhas: cor do Guia Rápido, igual ao token CSS.
for (const l of lines) {
  const ref = colors.find((c) => c.id === l.id);
  if (!/^#[0-9A-F]{6}$/.test(l.cor ?? "")) fail(`Linha ${l.id}: sem cor válida`);
  if (!ref || ref.cor !== l.cor) fail(`Linha ${l.id}: cor diferente de line-colors.json`);
  const token = tokens.match(new RegExp(`--color-line-${l.id}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!token || token[1].toUpperCase() !== l.cor) fail(`Linha ${l.id}: token --color-line-${l.id} ausente ou diferente`);
  if (!STATUS.has(l.status)) fail(`Linha ${l.id}: status inválido ${l.status}`);
}

// Estações: coordenada dentro da Grande São Paulo, status válido, pertence às linhas que diz.
const bySlug = new Map();
for (const f of stations) {
  const p = f.properties;
  if (bySlug.has(p.slug)) fail(`slug repetido: ${p.slug}`);
  bySlug.set(p.slug, p);
  const [lon, lat] = f.geometry?.coordinates ?? [];
  if (!(lon > -47.2 && lon < -46.0 && lat > -24.0 && lat < -23.0)) fail(`${p.slug}: coordenada ausente ou fora da RMSP`);
  if (!STATUS.has(p.status)) fail(`${p.slug}: status inválido`);
  for (const id of p.linhas) {
    if (!p.paradas[id]) fail(`${p.slug}: sem parada na linha ${id}`);
    const l = lines.find((x) => x.id === id);
    if (!l?.sequencias.flat().includes(p.slug)) fail(`${p.slug}: diz estar na linha ${id}, mas não está na sequência`);
  }
}
for (const l of lines)
  for (const slug of l.sequencias.flat()) if (!bySlug.has(slug)) fail(`Linha ${l.id}: estação inexistente ${slug}`);

// Trechos e transferências apontam para estações existentes; geometria com 2+ pontos.
for (const t of trechos) {
  if (!bySlug.has(t.de) || !bySlug.has(t.para)) fail(`trecho ${t.linha} ${t.de}→${t.para}: estação inexistente`);
  if (!STATUS.has(t.status)) fail(`trecho ${t.de}→${t.para}: status inválido`);
}
if (tracks.length !== trechos.length) fail("tracks.geojson e edges.json com número de trechos diferente");
for (const f of tracks) if ((f.geometry?.coordinates?.length ?? 0) < 2) fail(`traçado ${f.properties.de}→${f.properties.para} sem geometria`);
for (const t of transferencias) {
  const a = t.estacao ?? t.de, b = t.estacao ?? t.para;
  if (!bySlug.has(a) || !bySlug.has(b)) fail(`transferência ${a}–${b}: estação inexistente`);
}

// Grafo conexo: toda estação alcançável a partir de qualquer outra (trechos + passagens).
const adj = new Map([...bySlug.keys()].map((s) => [s, new Set()]));
const link = (a, b) => {
  adj.get(a)?.add(b);
  adj.get(b)?.add(a);
};
for (const t of trechos) link(t.de, t.para);
for (const t of transferencias) if (t.tipo === "passagem") link(t.de, t.para);
const start = bySlug.keys().next().value;
const seen = new Set([start]);
const queue = [start];
while (queue.length) {
  for (const n of adj.get(queue.shift())) {
    if (!seen.has(n)) {
      seen.add(n);
      queue.push(n);
    }
  }
}
if (seen.size !== bySlug.size) {
  const missing = [...bySlug.keys()].filter((s) => !seen.has(s));
  fail(`grafo desconexo: ${missing.length} estações isoladas (${missing.slice(0, 8).join(", ")}…)`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} problema(s):\n  ` + errors.join("\n  "));
  process.exit(1);
}
console.log(`✓ ${lines.length} linhas, ${stations.length} estações, ${trechos.length} trechos — tudo consistente e conexo.`);
