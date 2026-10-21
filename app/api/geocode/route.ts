// GET /api/geocode?q=…&lat=…&lon=… — proxy do Photon (OpenStreetMap) para a busca de lugares.
// Sem chave nem segredo. Cache na CDN (1 dia) e em memória (1 h), limite por IP e um teto global
// para não pesar no serviço público (política do Photon: "please be fair").
import { PHOTON_BASE, parsePhoton, photonUrl } from "@/lib/geo/photon";
import { inArea } from "@/lib/geo/area";
import type { LngLat } from "@/lib/geo/walk";

const UA = "metro-sp-conceitual/1.3 (+https://metro-sp-beta.vercel.app; github.com/bragahauser-byte/metro-sp)";
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const PER_IP = { limit: 30, windowMs: 60_000 };
const GLOBAL = { limit: 120, windowMs: 60_000 };

const cache = new Map<string, { at: number; body: string }>();
const hits = new Map<string, number[]>();
let global: number[] = [];

function allow(list: number[], now: number, { limit, windowMs }: { limit: number; windowMs: number }) {
  const recent = list.filter((t) => now - t < windowMs);
  if (recent.length >= limit) return { ok: false, recent };
  recent.push(now);
  return { ok: true, recent };
}

const json = (body: string, status: number, cacheControl: string) =>
  new Response(body, { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl } });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (q.length < 3 || q.length > 120) return json(JSON.stringify({ erro: "Digite de 3 a 120 caracteres." }), 400, "no-store");
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  // Viés arredondado a ~1 km: melhora o cache e não carrega posição precisa.
  const near: LngLat | null = Number.isFinite(lat) && Number.isFinite(lon) && inArea([lon, lat]) ? [Number(lon.toFixed(2)), Number(lat.toFixed(2))] : null;
  const key = `${q.toLowerCase()}|${near?.join(",") ?? ""}`;
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.at < TTL_MS) return json(cached.body, 200, "public, s-maxage=86400, stale-while-revalidate=604800");

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
  const mine = allow(hits.get(ip) ?? [], now, PER_IP);
  hits.set(ip, mine.recent);
  if (hits.size > 5000) hits.clear();
  if (!mine.ok) return json(JSON.stringify({ erro: "Muitas buscas seguidas. Espere um pouco." }), 429, "no-store");
  const all = allow(global, now, GLOBAL);
  global = all.recent;
  if (!all.ok) return json(JSON.stringify({ erro: "Busca de endereços ocupada. Tente em instantes." }), 503, "no-store");

  try {
    const res = await fetch(photonUrl(q, near, 8, PHOTON_BASE), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = JSON.stringify({ lugares: parsePhoton(await res.json()), fonte: "Photon · © OpenStreetMap contributors" });
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: now, body });
    return json(body, 200, "public, s-maxage=86400, stale-while-revalidate=604800");
  } catch {
    return json(JSON.stringify({ erro: "Busca de endereços indisponível agora." }), 502, "no-store");
  }
}
