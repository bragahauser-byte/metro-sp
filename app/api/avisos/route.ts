// GET /api/avisos — situação das linhas agora (CPTM; ARTESP com chave) e comunicados oficiais
// recentes (RSS do Metrô), normalizados e sem repetidos. A coleta fica em cache no servidor: as
// fontes são lidas no máximo a cada 15 minutos, não importa quantas pessoas abram o site.
//
// Últimos dados válidos: se TODAS as fontes falham, a função em cache lança erro — e o Next
// continua servindo a última coleta boa guardada (até expirar em 24 h). Se só parte falha, os
// itens da fonte que caiu são mantidos a partir da última coleta boa vista por esta instância.
import { cacheLife, cacheTag } from "next/cache";
import { MIN_INTERVAL_S, anyOk, collect, keepLastGood } from "@/lib/ops/collect";
import { OPS_SOURCES, STATUS_SOURCES } from "@/lib/ops/sources";
import type { OpsSnapshot } from "@/lib/ops/types";

async function snapshot() {
  "use cache";
  cacheLife({ stale: 120, revalidate: MIN_INTERVAL_S, expire: 24 * 3600 });
  cacheTag("avisos");
  const snap = await collect(OPS_SOURCES, new Date(), fetch, STATUS_SOURCES, { ARTESP_API_KEY: process.env.ARTESP_API_KEY });
  if (!anyOk(snap)) throw new Error("nenhuma fonte respondeu");
  return snap;
}

let lastGood: OpsSnapshot | null = null;

export async function GET() {
  try {
    const snap = keepLastGood(await snapshot(), lastGood, new Date());
    lastGood = snap;
    return Response.json(snap, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=780" } });
  } catch {
    if (lastGood) {
      const down = (f: OpsSnapshot["fontes"][number]) => (f.desligada ? f : { ...f, ok: false, erro: "fonte indisponível agora", preservado: true });
      const snap = keepLastGood({ ...lastGood, fontes: lastGood.fontes.map(down), situacao: { linhas: [], fontes: lastGood.situacao.fontes.map(down) } }, lastGood, new Date());
      return Response.json(snap, { headers: { "Cache-Control": "public, s-maxage=60" } });
    }
    return Response.json({ erro: "Avisos indisponíveis agora." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
