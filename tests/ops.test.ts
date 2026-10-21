import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, dedupeAndExpire, mentionedLines, normalizeItem, parseRss, stableId } from "../lib/ops/normalize.ts";
import { collect, keepLastGood } from "../lib/ops/collect.ts";
import type { OpsSource } from "../lib/ops/types.ts";

const SRC: OpsSource = {
  id: "teste",
  nome: "Fonte oficial de teste",
  site: "https://exemplo.gov.br",
  feed: "https://exemplo.gov.br/feed/",
  oficial: true,
  linhas: ["1", "2", "3", "15"],
  permissao: "teste",
};
const PRESS: OpsSource = { ...SRC, id: "imprensa", nome: "Jornal", oficial: false, linhas: ["1", "2", "3", "15"] };

// Feed de exemplo escrito para o teste (não é conteúdo real).
const FEED = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[Linhas 1-Azul e 3-Vermelha terão esquema especial no feriado]]></title>
<link>https://exemplo.gov.br/a</link><pubDate>Fri, 09 Oct 2026 21:50:25 +0000</pubDate>
<description><![CDATA[<p>O funcionamento ser&aacute; alterado &amp; a Linha 4-Amarela tamb&#233;m.</p>]]></description>
<category>Notícias</category></item>
<item><title>Licitação de espaços comerciais</title><link>https://exemplo.gov.br/b</link>
<pubDate>Mon, 05 Oct 2026 14:41:41 +0000</pubDate><description>Edital publicado.</description></item>
<item><title>Sem data</title><link>https://exemplo.gov.br/c</link><pubDate></pubDate><description>x</description></item>
</channel></rss>`;

const NOW = new Date("2026-10-12T12:00:00Z");

test("decodifica CDATA, tags e entidades", () => {
  assert.equal(decode("<![CDATA[<b>A &amp; B</b>]]>"), "A & B");
  assert.equal(decode("caf&#233;"), "café");
  // HTML escapado no feed não pode sobrar como texto.
  assert.equal(decode('Produtos &lt;img src="/x.png" /&gt; novos'), "Produtos novos");
});

test("lê o RSS e normaliza", () => {
  const raw = parseRss(FEED);
  assert.equal(raw.length, 3);
  const items = raw.map((r) => normalizeItem(r, SRC, NOW)).filter(Boolean);
  assert.equal(items.length, 2, "item sem data é descartado");
  const [a, b] = items;
  assert.equal(a!.tipo, "comunicado-oficial");
  assert.equal(a!.operacional, true);
  // A Linha 4 é de outra operadora: citada, mas não atribuída a esta fonte.
  assert.deepEqual(a!.linhas, ["1", "3"]);
  assert.equal(b!.operacional, false);
  assert.equal(a!.id, stableId("https://exemplo.gov.br/a"));
});

test("linhas citadas por número e por cor", () => {
  assert.deepEqual(mentionedLines("Obras nas linhas 1, 2 e 15 e na Linha Verde"), ["1", "2", "15"]);
  assert.deepEqual(mentionedLines("Linha 17-Ouro"), ["17"]);
  assert.deepEqual(mentionedLines("linha 99"), []);
});

test("notícia da imprensa nunca vira comunicado oficial", () => {
  const it = normalizeItem(parseRss(FEED)[0], PRESS, NOW)!;
  assert.equal(it.tipo, "noticia");
  assert.equal(it.confianca, "imprensa");
});

test("deduplica (prefere a fonte oficial) e expira", () => {
  const raw = parseRss(FEED)[0];
  const press = normalizeItem({ ...raw, link: "https://jornal.com/x" }, PRESS, NOW)!;
  const off = normalizeItem(raw, SRC, NOW)!;
  const out = dedupeAndExpire([press, off, off], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].confianca, "oficial");
  // Depois da validade some.
  assert.equal(dedupeAndExpire([off], new Date("2026-11-30T00:00:00Z")).length, 0);
});

test("coleta: uma fonte com erro não derruba a outra e o resultado é idempotente", async () => {
  const fetcher = async (url: string) => (url.includes("quebrada") ? new Response("x", { status: 503 }) : new Response(FEED, { status: 200 }));
  const broken = { ...SRC, id: "quebrada", feed: "https://quebrada.gov.br/feed/" };
  const a = await collect([SRC, broken], NOW, fetcher);
  const b = await collect([SRC, broken], NOW, fetcher);
  assert.deepEqual(a, b);
  // A licitação (não operacional, 3 dias de validade) já venceu em 12/10.
  assert.equal(a.itens.length, 1);
  assert.equal(a.fontes.find((f) => f.id === "quebrada")?.ok, false);
  assert.equal(a.fontes.find((f) => f.id === "quebrada")?.erro, "HTTP 503");
});

test("fonte que falha mantém os últimos dados válidos e a data da última leitura boa", async () => {
  const ok = async () => new Response(FEED, { status: 200 });
  const down = async () => new Response("x", { status: 500 });
  const before = await collect([SRC], NOW, ok);
  assert.equal(before.fontes[0].ultimaColetaOkEm, NOW.toISOString());
  const later = new Date(NOW.getTime() + 3600_000);
  const failed = await collect([SRC], later, down);
  assert.equal(failed.itens.length, 0);
  const merged = keepLastGood(failed, before, later);
  assert.equal(merged.itens.length, before.itens.length, "itens da última coleta boa continuam");
  assert.equal(merged.fontes[0].ok, false);
  assert.equal(merged.fontes[0].preservado, true);
  assert.equal(merged.fontes[0].ultimaColetaOkEm, NOW.toISOString(), "última atualização bem-sucedida ≠ horário desta tentativa");
  assert.equal(merged.atualizadoEm, later.toISOString());
  // Sem coleta anterior, nada é inventado.
  assert.deepEqual(keepLastGood(failed, null, later), failed);
});
