// GET /api/avisos — comunicados oficiais recentes (RSS), normalizados e sem repetidos.
// A coleta fica em cache no servidor: a fonte é lida no máximo a cada 30 minutos, não importa
// quantas pessoas abram o site. Não é status em tempo real e o site diz isso onde mostra os dados.
import { cacheLife, cacheTag } from "next/cache";
import { MIN_INTERVAL_S, collect } from "@/lib/ops/collect";
import { OPS_SOURCES } from "@/lib/ops/sources";

async function snapshot() {
  "use cache";
  cacheLife({ stale: 300, revalidate: MIN_INTERVAL_S, expire: 24 * 3600 });
  cacheTag("avisos");
  return collect(OPS_SOURCES, new Date());
}

export async function GET() {
  return Response.json(await snapshot(), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" },
  });
}
