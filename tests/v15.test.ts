import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPlanner } from "../lib/route/engine.ts";
import { buildSteps } from "../lib/route/steps.ts";
import { planPlaceRoute } from "../lib/geo/place-route.ts";
import { FAR_FROM_NETWORK_M, nearestToNetwork, stationCandidates } from "../lib/geo/nearest.ts";
import { expandQuery, looksLikeAddress, normalizeCep } from "../lib/geo/aliases.ts";
import { isWeak, matchScore, mergePlaces, rankPlaces } from "../lib/geo/rank.ts";
import { nominatimUrl, parseNominatim } from "../lib/geo/nominatim.ts";
import { searchEverywhere } from "../lib/geo/search.ts";
import type { Place } from "../lib/geo/photon.ts";
import type { LngLat } from "../lib/geo/walk.ts";
import { parseArtesp, parseCptm, situationFor } from "../lib/ops/status.ts";
import { collect, resetStatusThrottle } from "../lib/ops/collect.ts";
import { STATUS_SOURCES } from "../lib/ops/sources.ts";
import { getLocation, requestLocation, resetLocation, startWatch, stopWatch } from "../components/geo/location.ts";
import { loadNetwork, loadSchedule } from "./helpers.ts";

const net = loadNetwork();
const { plan } = createPlanner(net, loadSchedule());
const stations = JSON.parse(readFileSync(new URL("../data/stations.geojson", import.meta.url), "utf8")).features.map(
  (f: { properties: { slug: string; status: string }; geometry: { coordinates: LngLat } }) => ({
    slug: f.properties.slug,
    status: f.properties.status,
    geo: f.geometry.coordinates,
  }),
);
const names = {
  station: (slug: string) => net.stations.find((s) => s.slug === slug)?.nome ?? slug,
  line: (id: string) => net.lines.find((l) => l.id === id)?.nome ?? id,
};
const fastest = (a: string, b: string) => {
  const r = plan({ from: a, to: b });
  return r.status === "ok" ? r.routes[0] : null;
};

const place = (nome: string, lngLat: LngLat, detalhe = ""): Place => ({ id: nome, nome, detalhe, tipo: "lugar", lngLat });

// ---------------------------------------------------------------- geocodificação

test("busca: apelidos e CEP viram o texto que o geocodificador conhece", () => {
  assert.equal(expandQuery("MASP"), "Museu de Arte de São Paulo");
  assert.equal(expandQuery("  allianz parque "), "Nubank Parque");
  assert.equal(expandQuery("04210000"), "04210-000");
  assert.equal(normalizeCep("04210-000"), "04210-000");
  assert.equal(expandQuery("Rua Augusta 1500"), "Rua Augusta 1500");
  assert.ok(looksLikeAddress("Rua Augusta 1500"));
  assert.ok(!looksLikeAddress("MASP"));
});

test("busca: resultado que bate com o texto vem antes; empate, o mais perto", () => {
  const ref: LngLat = [-46.6559, -23.5614];
  const cafe = place("MASP Suplicy", [-46.7, -23.6], "café");
  const museu = place("Museu de Arte de São Paulo", [-46.6558, -23.5613], "Avenida Paulista, 1578");
  const longe = place("Museu de Arte de São Paulo", [-46.9, -23.4], "outro");
  const out = rankPlaces([longe, cafe, museu], "Museu de Arte de São Paulo", ref);
  assert.deepEqual(out.map((p) => p.detalhe), ["Avenida Paulista, 1578", "outro", "café"]);
  assert.equal(matchScore(museu, "museu arte"), 2);
  assert.equal(matchScore(museu, "Museu de Arte de São Paulo"), 4, "nome igual vale mais");
  const mac = place("Museu de Arte Contemporânea da Universidade de São Paulo", [-46.6558, -23.5613]);
  assert.deepEqual(rankPlaces([mac, museu], "Museu de Arte de São Paulo", ref).map((p) => p.nome)[0], "Museu de Arte de São Paulo");
  assert.equal(matchScore(cafe, "museu arte"), 0);
  assert.ok(isWeak([cafe], "Museu de Arte de São Paulo"), "o Photon não achou o museu: vale perguntar ao Nominatim");
  assert.ok(!isWeak([museu], "Museu de Arte de São Paulo"));
});

test("busca: Photon + Nominatim sem repetir o mesmo lugar", () => {
  const a = place("Nubank Parque", [-46.6788, -23.5275]);
  const b = place("Nubank Parque", [-46.67885, -23.52755]);
  const c = place("Hotel Allianz Parque", [-46.677, -23.528]);
  assert.equal(mergePlaces([a], [b, c]).length, 2);
});

test("Nominatim: URL limitada à Grande SP, em pt-BR; resposta vira lugares (sem estações)", () => {
  const u = new URL(nominatimUrl("Museu de Arte de São Paulo"));
  assert.equal(u.searchParams.get("bounded"), "1");
  assert.equal(u.searchParams.get("accept-language"), "pt-BR");
  assert.equal(u.searchParams.get("countrycodes"), "br");
  const places = parseNominatim([
    { osm_type: "way", osm_id: 1, lat: "-23.5614", lon: "-46.6559", name: "Museu de Arte de São Paulo", category: "tourism", type: "museum", address: { road: "Avenida Paulista", house_number: "1578", suburb: "Bela Vista", city: "São Paulo" } },
    { osm_type: "node", osm_id: 2, lat: "-23.5754", lon: "-46.6409", name: "Paraíso", category: "railway", type: "station" },
    { osm_type: "node", osm_id: 3, lat: "-22.9", lon: "-43.2", name: "No Rio", category: "tourism", type: "museum" },
    { osm_type: "node", osm_id: 4, lat: "-23.59", lon: "-46.61", name: "04210-000", category: "place", type: "postcode", address: { postcode: "04210-000" } },
  ]);
  assert.deepEqual(places.map((p) => [p.nome, p.tipo]), [
    ["Museu de Arte de São Paulo", "lugar"],
    ["04210-000", "cep"],
  ]);
  assert.equal(places[0].detalhe, "Avenida Paulista, 1578, Bela Vista, São Paulo");
});

test("busca com provedor mockado: estações na hora, lugares depois; falha não trava", async () => {
  const stationsFn = (q: string) => (q.toLowerCase().includes("para") ? [{ slug: "paraiso", nome: "Paraíso", linhas: ["1", "2"] }] : []);
  const ok = await searchEverywhere("Paraíso", { stations: stationsFn, geocode: async () => [place("Paraíso (bairro)", [-46.64, -23.57])] });
  assert.equal(ok.estacoes[0].slug, "paraiso");
  assert.equal(ok.lugares.length, 1);
  const down = await searchEverywhere("Paraíso", {
    stations: stationsFn,
    geocode: async () => {
      throw new Error("503");
    },
  });
  assert.equal(down.erro, "indisponivel");
  assert.equal(down.estacoes.length, 1, "estações continuam");
  const slow = await searchEverywhere("Rua Augusta 1500", {
    stations: () => [],
    timeoutMs: 30,
    geocode: (_q, _n, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort")))),
  });
  assert.equal(slow.erro, "tempo");
  const nada = await searchEverywhere("xqzwv", { stations: () => [], geocode: async () => [] });
  assert.deepEqual([nada.estacoes.length, nada.lugares.length, nada.erro], [0, 0, null]);
});

// ---------------------------------------------------------------- rota

test("estação de embarque pelo tempo total: perto do MASP, a melhor para a Saúde não é só a mais próxima", () => {
  const masp: LngLat = [-46.6559, -23.5614];
  const saude = { kind: "station" as const, slug: "saude" };
  const res = planPlaceRoute({ kind: "place", lngLat: masp, nome: "MASP" }, saude, { stations, plan: fastest });
  assert.equal(res.status, "ok");
  if (res.status !== "ok") return;
  // Confere: nenhuma estação candidata dá tempo total (a pé + rede) menor que a escolhida.
  for (const c of stationCandidates(masp, stations).candidates) {
    const r = fastest(c.slug, "saude");
    if (r) assert.ok(res.minutos <= c.walk.minutos + r.minutos, `${c.slug}: ${c.walk.minutos}+${r.minutos} < ${res.minutos}`);
  }
  assert.equal(res.minutos, res.walkIn!.minutos + res.route.minutos);
});

test("rota com baldeação: Consolação → Saúde = Linha 2 até Paraíso, Linha 1 até Saúde; passos legíveis", () => {
  const r = fastest("consolacao", "saude")!;
  assert.deepEqual(r.legs.map((l) => l.linha), ["2", "1"]);
  assert.equal(r.legs[0].estacoes.at(-1), "paraiso");
  const steps = buildSteps(r, names, {
    walkIn: { retaM: 300, distanciaM: 450, minutos: 6 },
    walkOut: { retaM: 200, distanciaM: 300, minutos: 4 },
    from: { nome: "Rua Augusta 1500", lngLat: [-46.656, -23.556], isStation: false },
    to: { nome: "Hospital", lngLat: [-46.64, -23.62], isStation: false },
  });
  assert.deepEqual(steps.map((s) => s.kind), ["walk", "ride", "transfer", "alight", "walk"]);
  assert.equal(steps[0].titulo, "Caminhe 450 m (6 min) até a Estação Consolação");
  assert.match(steps[1].titulo, /^Pegue a Linha 2-Verde sentido /);
  assert.match(steps[1].detalhe, /Embarque em Consolação · \d+ estaç(ão|ões) · ~\d+ min/);
  assert.match(steps[2].titulo, /^Baldeie para a Linha 1-Azul sentido Jabaquara/);
  assert.equal(steps[3].titulo, "Desça em Saúde");
  assert.equal(steps[4].titulo, "Caminhe 300 m (4 min) até Hospital");
  // Tocar num passo: o mapa enquadra as estações do trecho e os pontos a pé.
  assert.deepEqual(steps[0].focus, { stations: ["consolacao"], points: [[-46.656, -23.556]] });
  assert.deepEqual(steps[2].focus.stations, r.legs[1].estacoes);
});

test("rota com linha em alerta: o passo mostra a alteração; sem fonte, 'sem leitura' (nunca normal)", () => {
  const cptm = parseCptm([
    { linhaId: 11, dataGeracao: "2026-10-21T09:00:00", descricao: "Falha", tipo: "C", status: "Velocidade Reduzida" },
    { linhaId: 10, dataGeracao: "2026-10-21T09:00:00", descricao: "", tipo: "C", status: "Operação Normal" },
  ]);
  assert.equal(situationFor("11", cptm).kind, "alerta");
  assert.equal(situationFor("10", cptm).kind, "normal");
  assert.equal(situationFor("1", cptm).kind, "sem-leitura", "Metrô sem dado aberto");
  const r = fastest("bras", "tatuape");
  if (r) for (const leg of r.legs) assert.notEqual(situationFor(leg.linha, []).kind, "normal");
});

test("longe da rede: mais de 3 km avisa e aponta a estação mais próxima mesmo assim", () => {
  const se = stations.find((s: { slug: string }) => s.slug === "se")!;
  const perto = nearestToNetwork([se.geo[0] + 0.002, se.geo[1]], stations)!;
  assert.equal(perto.slug, "se");
  assert.equal(perto.longe, false);
  // Interior de Juquitiba: dezenas de km da rede, mas ainda há uma "mais próxima".
  const longe = nearestToNetwork([-47.07, -23.93], stations)!;
  assert.ok(longe.longe);
  assert.ok(longe.walk.retaM > FAR_FROM_NETWORK_M);
  assert.ok(typeof longe.slug === "string" && longe.slug.length > 0);
});

// ---------------------------------------------------------------- localização

function fakeGeo(behavior: "deny" | "ok") {
  const calls = { watch: 0, clear: 0 };
  const geolocation = {
    getCurrentPosition(ok: PositionCallback, err: PositionErrorCallback) {
      if (behavior === "deny") err({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "denied" } as GeolocationPositionError);
      else ok({ coords: { longitude: -46.64, latitude: -23.57, accuracy: 20 } } as GeolocationPosition);
    },
    watchPosition() {
      calls.watch++;
      return 7;
    },
    clearWatch() {
      calls.clear++;
    },
  };
  Object.defineProperty(globalThis, "navigator", { value: { geolocation }, configurable: true });
  return calls;
}

test("permissão negada: nada quebra, a origem fica para a busca e o estado diz 'denied'", async () => {
  resetLocation();
  fakeGeo("deny");
  const ll = await requestLocation();
  assert.equal(ll, null);
  const s = getLocation();
  assert.deepEqual(s.geo, { status: "error", reason: "denied" });
  assert.equal(s.permission, "denied");
});

test("localização permitida: posição só na memória; watchPosition só enquanto há rota e para ao fechar", async () => {
  resetLocation();
  const calls = fakeGeo("ok");
  assert.deepEqual(await requestLocation(), [-46.64, -23.57]);
  assert.equal(getLocation().permission, "granted");
  const stop = startWatch();
  startWatch(); // segunda chamada não abre outro acompanhamento
  assert.equal(calls.watch, 1);
  assert.equal(getLocation().watching, true);
  stop();
  assert.equal(calls.clear, 1);
  assert.equal(getLocation().watching, false);
  stopWatch();
  assert.equal(calls.clear, 1, "parar de novo não faz nada");
});

// ---------------------------------------------------------------- ARTESP

const ARTESP = {
  meta: { versao: "1.1.0" },
  empresas: [
    {
      id: 1,
      nome: "ViaQuatro",
      fiscalizacao_artesp: true,
      linhas: [{ nome: "Linha 4-Amarela", codigo: "4", ativa: true, status: { situacao: "Operação Normal", classificacao: "operacional", operacao_normal: true, atualizado_em: "2026-10-21T10:00:00-03:00", atualizado_ha: "5 minutos" } }],
    },
    {
      id: 2,
      nome: "ViaMobilidade",
      linhas: [
        { nome: "Linha 8-Diamante", codigo: "8", status: { situacao: "", classificacao: { tipo: "problema", label: "Problema (Offline)" }, operacao_normal: false } },
        { nome: "Linha 9-Esmeralda", codigo: "9", status: { situacao: "Operação Normal", operacao_normal: false } },
      ],
    },
  ],
};

test("ARTESP: formato da documentação (classificação texto ou objeto)", () => {
  const s = parseArtesp(ARTESP);
  assert.deepEqual(s.map((x) => [x.linha, x.situacao]), [
    ["4", "normal"],
    ["8", "atencao"],
    ["9", "atencao"],
  ]);
});

const artespFetch = (status: number) => {
  const calls: string[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push(`${url} ${(init.headers as Record<string, string>).Authorization ?? ""}`);
    if (url.includes("cptm")) return Response.json([]);
    return status === 200 ? Response.json(ARTESP) : new Response("{}", { status });
  };
  return { fetcher, calls };
};

test("ARTESP sem chave: não chama, linhas ficam 'sem leitura automática'", async () => {
  resetStatusThrottle();
  const { fetcher, calls } = artespFetch(200);
  const snap = await collect([], new Date("2026-10-21T13:00:00Z"), fetcher, STATUS_SOURCES, {});
  assert.ok(!calls.some((c) => c.includes("artesp")));
  assert.equal(snap.situacao.fontes.find((f) => f.id === "artesp")!.desligada, true);
  assert.equal(situationFor("4", snap.situacao.linhas).kind, "sem-leitura");
});

for (const [code, msg] of [
  [401, "chave recusada (401)"],
  [429, "limite de requisições (429)"],
] as const) {
  test(`ARTESP ${code}: erro claro e linhas 'sem leitura automática'`, async () => {
    resetStatusThrottle();
    const { fetcher } = artespFetch(code);
    const snap = await collect([], new Date("2026-10-21T13:00:00Z"), fetcher, STATUS_SOURCES, { ARTESP_API_KEY: "k" });
    const f = snap.situacao.fontes.find((x) => x.id === "artesp")!;
    assert.equal(f.ok, false);
    assert.equal(f.erro, msg);
    assert.equal(situationFor("4", snap.situacao.linhas).kind, "sem-leitura");
  });
}

test("ARTESP: chave só no cabeçalho do servidor e no máximo 1 leitura a cada 15 min", async () => {
  resetStatusThrottle();
  const { fetcher, calls } = artespFetch(200);
  const t0 = new Date("2026-10-21T13:00:00Z");
  await collect([], t0, fetcher, STATUS_SOURCES, { ARTESP_API_KEY: "k" });
  await collect([], new Date(t0.getTime() + 5 * 60_000), fetcher, STATUS_SOURCES, { ARTESP_API_KEY: "k" });
  await collect([], new Date(t0.getTime() + 14 * 60_000), fetcher, STATUS_SOURCES, { ARTESP_API_KEY: "k" });
  const artesp = calls.filter((c) => c.includes("artesp"));
  assert.equal(artesp.length, 1, "4 por hora no máximo");
  assert.ok(artesp[0].endsWith("Api-Key k"));
  await collect([], new Date(t0.getTime() + 15 * 60_000), fetcher, STATUS_SOURCES, { ARTESP_API_KEY: "k" });
  assert.equal(calls.filter((c) => c.includes("artesp")).length, 2);
  resetStatusThrottle();
});

test("estações ligadas só por passagem a pé (Consolação ↔ Paulista) não quebram o planejador", () => {
  const r = plan({ from: "consolacao", to: "paulista" });
  assert.ok(r.status === "sem-caminho" || r.routes.every((x) => x.legs.length > 0));
  const res = planPlaceRoute({ kind: "place", lngLat: [-46.66, -23.556], nome: "Sua localização" }, { kind: "place", lngLat: [-46.6552, -23.5583], nome: "Rua Augusta, 1500" }, { stations, plan: fastest });
  assert.ok(["a-pe", "ok"].includes(res.status));
});
