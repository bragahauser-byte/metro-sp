import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlanner } from "../lib/route/engine.ts";
import { fromLocal } from "../lib/time/sao-paulo.ts";
import { loadNetwork, loadSchedule } from "./helpers.ts";

const { plan } = createPlanner(loadNetwork(), loadSchedule());

test("rota básica: São Lucas → Tatuapé", () => {
  const r = plan({ from: "sao-lucas", to: "tatuape" });
  assert.equal(r.status, "ok");
  const best = r.routes[0];
  assert.equal(best.legs[0].linha, "15");
  // Melhor caminho real: 15 → 2 → 10 (Tamanduateí) → 11/12 ou 3 (Brás) até Tatuapé.
  assert.ok(["3", "11", "12"].includes(best.legs.at(-1)!.linha));
  assert.equal(best.legs[0].estacoes[0], "sao-lucas");
  assert.equal(best.legs.at(-1)!.estacoes.at(-1), "tatuape");
  assert.ok(best.minutos > 10 && best.minutos < 90, `${best.minutos} min`);
  // Os trechos destacados batem com as estações percorridas.
  const stops = best.legs.reduce((n, l) => n + l.estacoes.length - 1, 0);
  assert.equal(best.trechos.length, stops);
});

test("alternativas são distintas", () => {
  const r = plan({ from: "jabaquara", to: "corinthians-itaquera" });
  assert.equal(r.status, "ok");
  assert.ok(r.routes.length >= 2, "pelo menos uma alternativa");
  assert.equal(new Set(r.routes.map((x) => x.id)).size, r.routes.length);
  for (let i = 1; i < r.routes.length; i++) assert.ok(r.routes[i - 1].minutos <= r.routes[i].minutos);
});

test("entradas inválidas", () => {
  assert.equal(plan({ from: "se", to: "se" }).status, "mesma-estacao");
  assert.equal(plan({ from: "nao-existe", to: "se" }).status, "desconhecida");
});

test("estação em obras não entra no caminho", () => {
  const r = plan({ from: "perdizes", to: "sao-joaquim" });
  assert.equal(r.status, "ok");
  for (const leg of r.routes[0].legs) assert.ok(!leg.estacoes.includes("bela-vista"));
});

test("depois de 0h00 a baldeação entre linhas do Metrô é inviável", () => {
  const r = plan({ from: "jabaquara", to: "corinthians-itaquera", when: { mode: "partir", at: fromLocal("2026-10-20", "23:58") } });
  assert.equal(r.status, "ok");
  for (const route of r.routes) {
    if (route.baldeacoes > 0 && route.legs.every((l) => ["1", "2", "3", "15"].includes(l.linha))) assert.equal(route.viabilidade, "inviavel");
  }
  assert.ok(r.routes.some((x) => x.avisos.some((a) => a.nivel === "bloqueio")));
});

test("de dia, rota só no Metrô é viável e tem horários", () => {
  const r = plan({ from: "jabaquara", to: "se", when: { mode: "partir", at: fromLocal("2026-10-20", "10:00") } });
  const best = r.status === "ok" ? r.routes[0] : null;
  assert.ok(best);
  assert.equal(best.viabilidade, "viavel");
  assert.ok(best.partida && best.chegada && best.chegada > best.partida);
  assert.equal(best.legs[0].partida!.getTime(), fromLocal("2026-10-20", "10:00").getTime());
});

test("chegar até: a chegada coincide com o limite", () => {
  const limite = fromLocal("2026-10-20", "18:00");
  const r = plan({ from: "sao-lucas", to: "tatuape", when: { mode: "chegar", at: limite } });
  const best = r.status === "ok" ? r.routes[0] : null;
  assert.ok(best?.chegada);
  assert.ok(Math.abs(best.chegada.getTime() - limite.getTime()) < 60000);
});

test("linha de outra operadora fica como não verificada, nunca como viável", () => {
  const r = plan({ from: "butanta", to: "luz", when: { mode: "partir", at: fromLocal("2026-10-20", "12:00") } });
  assert.equal(r.status, "ok");
  const viaL4 = r.routes.find((x) => x.legs.some((l) => l.linha === "4"));
  assert.ok(viaL4);
  assert.equal(viaL4.viabilidade, "nao-verificado");
});

test("Linha 6 aos sábados: rota que depende dela é inviável", () => {
  const r = plan({ from: "joao-paulo-i", to: "perdizes", when: { mode: "partir", at: fromLocal("2026-10-24", "11:00") } });
  assert.equal(r.status, "ok");
  assert.equal(r.routes[0].viabilidade, "inviavel");
});

test("8h de dia útil: integração com a Linha 11 em Tatuapé/Itaquera fechada, a rota desvia por Brás", () => {
  const r = plan({ from: "vila-matilde", to: "guaianases", when: { mode: "partir", at: fromLocal("2026-10-20", "08:00") } });
  assert.equal(r.status, "ok");
  const best = r.routes[0];
  assert.notEqual(best.viabilidade, "inviavel");
  assert.equal(best.legs[1].estacoes[0], "bras");
  // As rotas mais curtas continuam na lista, marcadas como inviáveis, com o motivo e a fonte.
  const blocked = r.routes.filter((x) => x.viabilidade === "inviavel");
  assert.ok(blocked.length > 0);
  assert.ok(blocked.every((x) => x.avisos.some((a) => a.nivel === "bloqueio" && a.fonte?.url.includes("metro.sp.gov.br"))));
});

test("preferência de acessibilidade lista estações sem confirmação", () => {
  const r = plan({ from: "sao-lucas", to: "tatuape", acessivel: true });
  assert.equal(r.status, "ok");
  assert.ok(r.routes[0].acessibilidadeNaoConfirmada.includes("sao-lucas"));
});
