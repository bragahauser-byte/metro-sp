// GET /api/avisos — comunicados oficiais recentes (RSS), normalizados e sem repetidos.
// A coleta fica em cache no servidor: a fonte é lida no máximo a cada 30 minutos, não importa
// quantas pessoas abram o site. Não é status em tempo real e o site diz isso onde mostra os dados.
//
// Últimos dados válidos: se TODAS as fontes falham, a função em cache lança erro — e o Next
// continua servindo a última coleta boa guardada (até expirar em 24 h). Se só parte falha, os
// itens da fonte que caiu são mantidos a partir da última coleta boa vista por esta instância.
import { cacheLife, cacheTag } from "next/cache";
import { MIN_INTERVAL_S, collect, keepLastGood } from "@/lib/ops/collect";
import { OPS_SOURCES } from "@/lib/ops/sources";
import type { OpsSnapshot } from "@/lib/ops/types";

async function snapshot() {
  "use cache";
  cacheLife({ stale: 300, revalidate: MIN_INTERVAL_S, expire: 24 * 3600 });
  cacheTag("avisos");
  const snap = await collect(OPS_SOURCES, new Date());
  if (snap.fontes.every((f) => !f.ok)) throw new Error("nenhuma fonte respondeu");
  return snap;
}

let lastGood: OpsSnapshot | null = null;

export async function GET() {
  try {
    const snap = keepLastGood(await snapshot(), lastGood, new Date());
    lastGood = snap;
    return Response.json(snap, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } });
  } catch {
    if (lastGood) {
      const fontes = lastGood.fontes.map((f) => ({ ...f, ok: false, erro: "fonte indisponível agora", preservado: true }));
      return Response.json({ ...lastGood, fontes }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    }
    return Response.json({ erro: "Comunicados indisponíveis agora." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
