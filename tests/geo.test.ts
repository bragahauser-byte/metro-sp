import { test } from "node:test";
import assert from "node:assert/strict";
import { DETOUR, WALK_M_PER_MIN, estimateWalk, haversine } from "../lib/geo/walk.ts";
import { stationCandidates } from "../lib/geo/nearest.ts";
import { planPlaceRoute } from "../lib/geo/place-route.ts";
import { parsePhoton, photonUrl } from "../lib/geo/photon.ts";
import { searchEverywhere } from "../lib/geo/search.ts";
import { inArea } from "../lib/geo/area.ts";
import { createPlanner } from "../lib/route/engine.ts";
import { loadNetwork, loadSchedule } from "./helpers.ts";
import type { LngLat } from "../lib/geo/walk.ts";
import { readFileSync } from "node:fs";

const net = loadNetwork();
const { plan } = createPlanner(net, loadSchedule());
const geo = JSON.parse(readFileSync(new URL("../data/stations.geojson", import.meta.url), "utf8")) as {
  features: { properties: { slug: string; status: string; nome: string; linhas: string[] }; geometry: { coordinates: LngLat } }[];
};
const points = geo.features.map((f) => ({ slug: f.properties.slug, status: f.properties.status, geo: f.geometry.coordinates }));
const fastest = (from: string, to: string) => {
  const r = plan({ from, to, max: 1 });
  return r.status === "ok" ? r.routes[0] : null;
};

// Rua Otávio Alves Dundas (São Lucas), coordenada devolvida pelo Photon em 20/10/2026.
const RUA_OTAVIO: LngLat = [-46.5345762, -23.6001673];
// Shopping Eldorado (Pinheiros), perto da estação Hebraica-Rebouças (Linha 9).
const ELDORADO: LngLat = [-46.6965, -23.5728];

test("caminhada: haversine × 1,3 a 4,5 km/h, arredondada para cima", () => {
  const a: LngLat = [-46.6333, -23.5505];
  const b: LngLat = [-46.6333, -23.5595]; // ~1 km ao sul
  const d = haversine(a, b);
  assert.ok(d > 990 && d < 1010, `reta ${d}`);
  const w = estimateWalk(a, b);
  assert.equal(w.minutos, Math.ceil((d * DETOUR) / WALK_M_PER_MIN));
  assert.equal(w.minutos, 18);
  assert.equal(w.distanciaM, 1300);
  assert.equal(estimateWalk(a, a).minutos, 1, "nunca menos de 1 minuto");
});

test("ranking de estações próximas: as 3 mais perto, em ordem, dentro de 2 km", () => {
  const { candidates, raioM } = stationCandidates(RUA_OTAVIO, points);
  assert.equal(raioM, 2000);
  assert.ok(candidates.length >= 1 && candidates.length <= 3);
  // Linha 15-Prata: Camilo Haddad (~600 m) e Vila Tolstói (~740 m) ficam mais perto que São Lucas.
  assert.deepEqual(candidates.map((c) => c.slug), ["camilo-haddad", "vila-tolstoi", "sao-lucas"]);
  for (let i = 1; i < candidates.length; i++) assert.ok(candidates[i - 1].walk.retaM <= candidates[i].walk.retaM);
  assert.ok(candidates.every((c) => c.walk.retaM <= 2000));
});

test("sem estação em 2 km, o raio cresce; longe demais, nenhuma candidata", () => {
  // Ponto ~3 km a leste da estação mais a leste da rede.
  const east = points.filter((p) => p.status === "operando").reduce((a, b) => (b.geo[0] > a.geo[0] ? b : a));
  const far: LngLat = [east.geo[0] + 0.03, east.geo[1]];
  const r = stationCandidates(far, points);
  assert.equal(r.raioM, 3500);
  assert.ok(r.candidates.length >= 1);
  // Interior de Juquitiba: nada em 5 km.
  assert.deepEqual(stationCandidates([-47.07, -23.93], points), { candidates: [], raioM: null });
});

test("estação em obras não é candidata", () => {
  const obras = points.find((p) => p.status === "em-obras");
  if (!obras) return;
  const r = stationCandidates(obras.geo, points, { n: 10 });
  assert.ok(!r.candidates.some((c) => c.slug === obras.slug));
});

test("melhor combinação embarque × desembarque minimiza a pé + rede + a pé", () => {
  const res = planPlaceRoute(
    { kind: "place", lngLat: RUA_OTAVIO, nome: "Rua Otávio Alves Dundas" },
    { kind: "place", lngLat: ELDORADO, nome: "Shopping Eldorado" },
    { stations: points, plan: fastest },
  );
  assert.equal(res.status, "ok");
  if (res.status !== "ok") return;
  assert.equal(res.minutos, res.walkIn!.minutos + res.route.minutos + res.walkOut!.minutos);
  // Nenhuma outra combinação das candidatas é mais rápida.
  const ins = stationCandidates(RUA_OTAVIO, points).candidates;
  const outs = stationCandidates(ELDORADO, points).candidates;
  for (const i of ins)
    for (const o of outs) {
      const r = fastest(i.slug, o.slug);
      if (r) assert.ok(res.minutos <= i.walk.minutos + r.minutos + o.walk.minutos, `${i.slug}→${o.slug}`);
    }
});

test("combinação escolhida com plano falso: prefere caminhar mais se a rede compensa", () => {
  const stations = [
    { slug: "a1", geo: [0, 0] as LngLat },
    { slug: "a2", geo: [0.01, 0] as LngLat },
    { slug: "b1", geo: [0.5, 0] as LngLat },
  ];
  // a1 é mais perto da origem, mas a viagem a partir de a2 é muito mais curta.
  const fake = (f: string) => ({ minutos: f === "a1" ? 60 : 10 });
  const res = planPlaceRoute({ kind: "place", lngLat: [0.001, 0], nome: "o" }, { kind: "station", slug: "b1" }, {
    stations,
    plan: fake,
  });
  // Fora da área real não importa aqui: o cálculo é só geométrico.
  assert.equal(res.status, "ok");
  if (res.status === "ok") {
    assert.equal(res.board, "a2");
    assert.equal(res.walkOut, null, "destino já é estação: sem caminhada no fim");
  }
});

test("perto demais: sugere ir a pé; mesmo lugar e fora da área são informados", () => {
  const a: LngLat = [-46.6333, -23.5505];
  const b: LngLat = [-46.6333, -23.5535]; // ~330 m
  const walk = planPlaceRoute({ kind: "place", lngLat: a, nome: "a" }, { kind: "place", lngLat: b, nome: "b" }, { stations: points, plan: fastest });
  assert.equal(walk.status, "a-pe");
  assert.equal(planPlaceRoute({ kind: "place", lngLat: a, nome: "a" }, { kind: "place", lngLat: a, nome: "a" }, { stations: points, plan: fastest }).status, "mesmo-lugar");
  const out = planPlaceRoute({ kind: "place", lngLat: [-47.07, -23.93], nome: "Juquitiba" }, { kind: "station", slug: "se" }, { stations: points, plan: fastest });
  assert.deepEqual(out, { status: "fora-da-area", lado: "origem" });
});

test("Photon: URL restrita à Grande SP e resposta convertida em lugares rotulados", () => {
  const url = new URL(photonUrl("rua otavio alves dundas", [-46.63, -23.55]));
  assert.equal(url.searchParams.get("bbox"), "-47.25,-24.1,-45.65,-23.1");
  assert.equal(url.searchParams.get("lat"), "-23.550");
  assert.equal(url.searchParams.get("lang"), "default");
  // Viés fora da área é ignorado.
  assert.equal(new URL(photonUrl("x y z", [2.35, 48.85])).searchParams.get("lat"), null);

  const places = parsePhoton({
    features: [
      { properties: { osm_type: "W", osm_id: 1, type: "street", name: "Rua Otávio Alves Dundas", district: "São Lucas", city: "São Paulo", postcode: "03266-190" }, geometry: { coordinates: RUA_OTAVIO } },
      { properties: { osm_type: "W", osm_id: 2, type: "street", name: "Rua Otávio Alves Dundas", district: "São Lucas", city: "São Paulo", postcode: "03266-190" }, geometry: { coordinates: RUA_OTAVIO } },
      { properties: { osm_type: "N", osm_id: 3, type: "house", street: "Avenida Paulista", housenumber: "1578", city: "São Paulo" }, geometry: { coordinates: [-46.656, -23.561] } },
      { properties: { osm_type: "N", osm_id: 4, osm_key: "railway", osm_value: "station", name: "Sé" }, geometry: { coordinates: [-46.634, -23.55] } },
      { properties: { osm_type: "N", osm_id: 5, type: "house", name: "Torre Eiffel" }, geometry: { coordinates: [2.29, 48.86] } },
      { properties: { osm_key: "place", osm_value: "postcode", type: "other", name: "03266-190", district: "São Lucas" }, geometry: { coordinates: [-46.53, -23.59] } },
    ],
  });
  assert.deepEqual(places.map((p) => [p.tipo, p.nome]), [
    ["rua", "Rua Otávio Alves Dundas"],
    ["endereco", "Avenida Paulista, 1578"],
    ["cep", "03266-190"],
  ]);
  assert.equal(places[0].detalhe, "São Lucas, São Paulo, 03266-190");
  assert.deepEqual(parsePhoton(null), []);
  assert.deepEqual(parsePhoton({ features: "x" }), []);
});

const stationSearch = (q: string) =>
  geo.features
    .filter((f) => f.properties.nome.toLowerCase().includes(q.toLowerCase()))
    .map((f) => ({ slug: f.properties.slug, nome: f.properties.nome, linhas: f.properties.linhas }));

test("autocomplete misto: estações primeiro, depois lugares (provedor simulado)", async () => {
  const res = await searchEverywhere("Luz", {
    stations: stationSearch,
    geocode: async () => [{ id: "w1", nome: "Rua da Luz", detalhe: "Centro", tipo: "rua", lngLat: [-46.63, -23.53] }],
  });
  assert.equal(res.erro, null);
  assert.equal(res.estacoes[0].slug, "luz");
  assert.equal(res.lugares[0].nome, "Rua da Luz");
  // Menos de 3 letras: nem chama o provedor.
  let called = false;
  await searchEverywhere("Lu", { stations: stationSearch, geocode: async () => ((called = true), []) });
  assert.equal(called, false);
});

test("provedor com erro ou lento: estações continuam e a falha vira mensagem", async () => {
  const failing = await searchEverywhere("Tatuapé", {
    stations: stationSearch,
    geocode: async () => {
      throw new Error("HTTP 502");
    },
  });
  assert.equal(failing.erro, "indisponivel");
  assert.equal(failing.estacoes[0].slug, "tatuape");

  const slow = await searchEverywhere("Tatuapé", {
    stations: stationSearch,
    timeoutMs: 30,
    geocode: (_q, _n, signal) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
  });
  assert.equal(slow.erro, "tempo");
  assert.equal(slow.estacoes[0].slug, "tatuape");

  // Cancelada por nova digitação: a promessa é rejeitada (resultado descartado).
  const ctl = new AbortController();
  const p = searchEverywhere("Tatuapé", {
    stations: stationSearch,
    signal: ctl.signal,
    geocode: (_q, _n, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
  });
  ctl.abort();
  await assert.rejects(p);
});

test("lugar fora da área", () => {
  assert.equal(inArea(RUA_OTAVIO), true);
  assert.equal(inArea([-43.17, -22.9]), false); // Rio de Janeiro
});
