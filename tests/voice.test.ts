import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikePlace, matchStation, parseRouteIntent } from "../lib/voice/parse-route.ts";
import { describeRoute } from "../lib/voice/describe-route.ts";
import { createPlanner } from "../lib/route/engine.ts";
import { loadNetwork, loadSchedule } from "./helpers.ts";

const net = loadNetwork();
const stations = net.stations;

test("frase completa do exemplo", () => {
  const r = parseRouteIntent("Quero ir da estação São Lucas até a estação Tatuapé", stations);
  assert.equal(r.de?.slug, "sao-lucas");
  assert.equal(r.para?.slug, "tatuape");
  assert.deepEqual(r.naoEntendido, []);
});

test("variações: sem acento, 'pra', 'saindo de', só destino", () => {
  assert.equal(parseRouteIntent("de se pra luz", stations).para?.slug, "luz");
  assert.equal(parseRouteIntent("de se pra luz", stations).de?.slug, "se");
  const r = parseRouteIntent("como chego na Paulista saindo da Consolação", stations);
  assert.equal(r.para?.slug, "paulista");
  assert.equal(r.de?.slug, "consolacao");
  const only = parseRouteIntent("quero ir para Vila Madalena", stations);
  assert.equal(only.de, null);
  assert.equal(only.para?.slug, "vila-madalena");
});

test("erro de reconhecimento pequeno ainda acha a estação", () => {
  assert.equal(matchStation("tatuapê", stations)?.slug, "tatuape");
  assert.equal(matchStation("vila mariana", stations)?.slug, "vila-mariana");
});

test("nome que não existe não vira estação inventada", () => {
  const r = parseRouteIntent("da estação Hogwarts até a estação Nárnia", stations);
  assert.equal(r.de, null);
  assert.equal(r.para, null);
  assert.equal(r.naoEntendido.length, 2);
});

test("descrição falada da rota", () => {
  const { plan } = createPlanner(net, loadSchedule());
  const res = plan({ from: "jabaquara", to: "se" });
  assert.equal(res.status, "ok");
  const byId = new Map(net.lines.map((l) => [l.id, l.nome]));
  const bySlug = new Map(stations.map((s) => [s.slug, s.nome]));
  const text = describeRoute(res.routes[0], { station: (s) => bySlug.get(s)!, line: (l) => byId.get(l)! });
  assert.match(text[0], /^Rota de cerca de \d+ minutos, sem baldeação\.$/);
  assert.match(text[1], /Embarque em Jabaquara para a Linha 1-Azul, sentido Tucuruvi\./);
  assert.equal(text.at(-1), "Desembarque em Sé.");
});

test("lugares na fala: endereço e shopping não viram estação parecida", () => {
  const r = parseRouteIntent("de Rua Otávio Alves Dundas até Shopping Eldorado", stations);
  assert.equal(r.de, null);
  assert.equal(r.para, null);
  assert.equal(r.deTexto, "rua otavio alves dundas");
  assert.equal(r.paraTexto, "shopping eldorado");
  assert.deepEqual(r.naoEntendido, ["rua otavio alves dundas", "shopping eldorado"]);
});

test("mistura de lugar e estação; endereço com número", () => {
  const r = parseRouteIntent("quero ir da Avenida Paulista 1578 até a estação Sé", stations);
  assert.equal(r.de, null);
  assert.equal(r.deTexto, "avenida paulista 1578");
  assert.equal(r.para?.slug, "se");
  assert.equal(looksLikePlace("Rua Vergueiro"), true);
  assert.equal(looksLikePlace("Vergueiro"), false);
  // "Rua Vergueiro" não pode virar a estação Vergueiro por semelhança.
  assert.equal(parseRouteIntent("para rua vergueiro", stations).para, null);
  // Estação com palavra de lugar no nome continua sendo achada pelo nome exato.
  assert.equal(parseRouteIntent("para Hospital São Paulo", stations).para?.slug, "hospital-sao-paulo");
});

test("descrição falada com trechos a pé", () => {
  const { plan } = createPlanner(net, loadSchedule());
  const res = plan({ from: "sao-lucas", to: "tatuape" });
  assert.equal(res.status, "ok");
  if (res.status !== "ok") return;
  const r = res.routes[0];
  const bySlug = new Map(stations.map((s) => [s.slug, s.nome]));
  const byId = new Map(net.lines.map((l) => [l.id, l.nome]));
  const text = describeRoute(r, { station: (s) => bySlug.get(s)!, line: (l) => byId.get(l)! }, "resumido", {
    walkIn: { minutos: 6, distanciaM: 450 },
    walkOut: { minutos: 4, distanciaM: 300 },
    destino: "Shopping Metrô Tatuapé",
  });
  assert.match(text[0], new RegExp(`cerca de ${r.minutos + 10} minutos`));
  assert.ok(text.some((t) => t.startsWith("Caminhe cerca de 6 minutos, uns 450 metros, até a estação São Lucas")));
  assert.ok(text.some((t) => t.includes("até Shopping Metrô Tatuapé")));
  assert.match(text.at(-1)!, /estimativas/);
});
