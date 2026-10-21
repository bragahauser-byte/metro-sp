import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, isAlert, parseArtesp, parseCptm, sortStatuses, spLocalToIso } from "../lib/ops/status.ts";
import { MIN_INTERVAL_S, STATUS_MAX_AGE_MS, anyOk, collect, keepLastGood } from "../lib/ops/collect.ts";
import { STATUS_SOURCES } from "../lib/ops/sources.ts";
import { NEARBY, isNearbyKind, photonNearbyUrl } from "../lib/geo/photon.ts";

const NOW = new Date("2026-10-21T13:00:00Z");

const CPTM_JSON = [
  { linhaId: 10, dataGeracao: "2026-10-21T09:56:58", descricao: "", tipo: "C", status: "Operação Normal" },
  { linhaId: 11, dataGeracao: "2026-10-21T09:56:58", descricao: "Falha em equipamento entre Guaianases e Calmon Viana", tipo: "C", status: "Velocidade Reduzida" },
  { linhaId: 12, dataGeracao: "2026-10-21T09:56:58", descricao: "", tipo: "C", status: "Paralisada" },
  { linhaId: 13, dataGeracao: "2026-10-21T09:56:58", descricao: "", tipo: "C", status: "Operação Encerrada" },
];

const ARTESP_JSON = {
  meta: { versao: "1" },
  empresas: [
    {
      id: 1,
      nome: "ViaQuatro",
      linhas: [{ nome: "Linha 4-Amarela", codigo: "L4", ativa: true, status: { situacao: "Operação Normal", operacao_normal: true, atualizado_em: "2026-10-21T09:55:00-03:00" } }],
    },
    {
      id: 2,
      nome: "ViaMobilidade",
      linhas: [
        { nome: "Linha 5-Lilás", codigo: 5, status: { situacao: "Operação Parcial", operacao_normal: false } },
        { nome: "Linha 9-Esmeralda", codigo: "9", status: { situacao: "", operacao_normal: true } },
      ],
    },
  ],
};

function fakeFetch(map: Record<string, () => Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const hit = Object.entries(map).find(([k]) => url.startsWith(k));
    if (!hit) throw new Error("sem rede");
    return hit[1]();
  };
  return { fetcher, calls };
}

test("classify: textos das operadoras viram níveis; na dúvida nunca é 'normal'", () => {
  assert.equal(classify("Operação Normal"), "normal");
  assert.equal(classify("OPERAÇÃO NORMAL"), "normal");
  assert.equal(classify("Velocidade Reduzida"), "atencao");
  assert.equal(classify("Operação Parcial"), "atencao");
  assert.equal(classify("Atividade Programada"), "atencao");
  assert.equal(classify("Paralisada"), "paralisada");
  assert.equal(classify("Operação Interrompida"), "paralisada");
  assert.equal(classify("Operação Encerrada"), "encerrada");
  assert.equal(classify(""), "desconhecida");
  assert.equal(classify("Dados indisponíveis"), "desconhecida");
});

test("spLocalToIso: hora sem fuso é de São Paulo (UTC−3)", () => {
  assert.equal(spLocalToIso("2026-10-21T09:56:58"), "2026-10-21T12:56:58.000Z");
  assert.equal(spLocalToIso("2026-10-21T09:56:58-03:00"), "2026-10-21T12:56:58.000Z");
  assert.equal(spLocalToIso("lixo"), null);
  assert.equal(spLocalToIso(null), null);
});

test("parseCptm: uma entrada por linha, com texto, detalhe e hora da fonte", () => {
  const s = parseCptm(CPTM_JSON);
  assert.deepEqual(
    s.map((x) => [x.linha, x.situacao]),
    [
      ["10", "normal"],
      ["11", "atencao"],
      ["12", "paralisada"],
      ["13", "encerrada"],
    ],
  );
  assert.equal(s[1].detalhe, "Falha em equipamento entre Guaianases e Calmon Viana");
  assert.equal(s[0].atualizadoEm, "2026-10-21T12:56:58.000Z");
  assert.equal(s[0].fonte.id, "cptm");
  assert.deepEqual(parseCptm({ erro: true }), []);
  assert.deepEqual(parseCptm([{ linhaId: 1, tipo: "M", status: "Operação Normal" }]), []);
});

test("parseArtesp: número da linha pelo código ou pelo nome; operacao_normal só desempata", () => {
  const s = parseArtesp(ARTESP_JSON);
  assert.deepEqual(
    s.map((x) => [x.linha, x.situacao]),
    [
      ["4", "normal"],
      ["5", "atencao"],
      ["9", "normal"],
    ],
  );
  assert.equal(s[0].atualizadoEm, "2026-10-21T12:55:00.000Z");
  assert.deepEqual(parseArtesp(null), []);
});

test("sortStatuses e isAlert: problemas primeiro", () => {
  const s = sortStatuses(parseCptm(CPTM_JSON));
  assert.deepEqual(
    s.map((x) => x.linha),
    ["12", "11", "13", "10"],
  );
  assert.deepEqual(
    s.filter(isAlert).map((x) => x.linha),
    ["12", "11"],
  );
});

test("collect: lê a CPTM sem chave e deixa a ARTESP desligada sem ARTESP_API_KEY", async () => {
  const { fetcher, calls } = fakeFetch({ "https://api.cptm.sp.gov.br/": () => Response.json(CPTM_JSON) });
  const snap = await collect([], NOW, fetcher, STATUS_SOURCES, {});
  assert.equal(MIN_INTERVAL_S, 900);
  assert.equal(snap.intervaloS, 900);
  assert.deepEqual(
    snap.situacao.linhas.map((l) => l.linha).sort(),
    ["10", "11", "12", "13"],
  );
  const artesp = snap.situacao.fontes.find((f) => f.id === "artesp")!;
  assert.equal(artesp.desligada, true);
  assert.equal(artesp.ok, false);
  assert.ok(!calls.some((c) => c.url.includes("artesp")), "sem chave não chama a ARTESP");
  assert.ok(anyOk(snap));
});

test("collect: com a chave, a ARTESP recebe 'Authorization: Api-Key …' e só entram as linhas dela", async () => {
  const { fetcher, calls } = fakeFetch({
    "https://api.cptm.sp.gov.br/": () => Response.json(CPTM_JSON),
    "https://ccm.artesp.sp.gov.br/": () => Response.json(ARTESP_JSON),
  });
  const snap = await collect([], NOW, fetcher, STATUS_SOURCES, { ARTESP_API_KEY: "teste" });
  const call = calls.find((c) => c.url.includes("artesp"))!;
  assert.equal((call.init.headers as Record<string, string>).Authorization, "Api-Key teste");
  assert.deepEqual(
    snap.situacao.linhas.filter((l) => l.fonte.id === "artesp").map((l) => l.linha),
    ["5", "4", "9"],
  );
});

test("collect: fonte que falha não derruba as outras e aparece com o erro", async () => {
  const { fetcher } = fakeFetch({ "https://api.cptm.sp.gov.br/": () => new Response("x", { status: 500 }) });
  const snap = await collect([], NOW, fetcher, STATUS_SOURCES, {});
  const cptm = snap.situacao.fontes.find((f) => f.id === "cptm")!;
  assert.equal(cptm.ok, false);
  assert.equal(cptm.erro, "HTTP 500");
  assert.equal(snap.situacao.linhas.length, 0);
  assert.equal(anyOk(snap), false);
});

test("keepLastGood: situação preservada por até 1 h quando a fonte cai; depois some", async () => {
  const ok = fakeFetch({ "https://api.cptm.sp.gov.br/": () => Response.json(CPTM_JSON) });
  const bad = fakeFetch({});
  const before = await collect([], NOW, ok.fetcher, STATUS_SOURCES, {});

  const soon = new Date(NOW.getTime() + 20 * 60 * 1000);
  const kept = keepLastGood(await collect([], soon, bad.fetcher, STATUS_SOURCES, {}), before, soon);
  assert.equal(kept.situacao.linhas.length, 4);
  assert.ok(kept.situacao.linhas.every((l) => l.preservado));
  const f = kept.situacao.fontes.find((x) => x.id === "cptm")!;
  assert.equal(f.preservado, true);
  assert.equal(f.ultimaColetaOkEm, NOW.toISOString());

  const late = new Date(NOW.getTime() + STATUS_MAX_AGE_MS + 60_000);
  const old = keepLastGood(await collect([], late, bad.fetcher, STATUS_SOURCES, {}), before, late);
  assert.equal(old.situacao.linhas.length, 0, "situação velha não é mostrada como 'agora'");
});

test("Buscar por perto: só categorias conhecidas, raio de 2 km e ponto arredondado", () => {
  assert.ok(isNearbyKind("farmacia"));
  assert.ok(!isNearbyKind("toString"));
  assert.ok(!isNearbyKind(null));
  const u = new URL(photonNearbyUrl("farmacia", [-46.65591, -23.56152]));
  assert.equal(u.pathname, "/reverse");
  assert.equal(u.searchParams.get("osm_tag"), NEARBY.farmacia.tag);
  assert.equal(u.searchParams.get("radius"), "2");
  assert.equal(u.searchParams.get("lat"), "-23.56");
  assert.equal(u.searchParams.get("lon"), "-46.66");
});
