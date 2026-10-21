// GET /api/avisos/atualizar — força uma nova coleta (para um cron ou chamada manual).
// Protegido por CRON_SECRET (variável de ambiente; a Vercel envia "Authorization: Bearer <segredo>"
// nas chamadas de cron). Sem o segredo configurado, o endpoint fica desligado.
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

function authorized(header: string | null, secret: string) {
  const a = Buffer.from(header ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, erro: "Atualização manual desligada (CRON_SECRET não configurado)." }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), secret)) return Response.json({ ok: false }, { status: 401 });
  // Marca o cache como vencido; a próxima leitura de /api/avisos coleta de novo. Repetir não muda nada.
  revalidateTag("avisos", { expire: 0 });
  return Response.json({ ok: true });
}
