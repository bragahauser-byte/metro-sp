// Geocodificação no navegador. Na Vercel passa pelo proxy /api/geocode (cache + limite). No
// GitHub Pages não há servidor: chama o Photon direto, o que a política dele permite para uso
// moderado — a busca já espera 300 ms, pede 3 letras e cancela as requisições antigas.
import { IS_STATIC, withBase } from "@/lib/env";
import { type Place, parsePhoton, photonUrl } from "@/lib/geo/photon";
import type { Geocoder } from "@/lib/geo/search";

const memo = new Map<string, Place[]>();

export const geocode: Geocoder = async (q, near, signal) => {
  const key = `${q.trim().toLowerCase()}|${near?.map((n) => n.toFixed(2)).join(",") ?? ""}`;
  const hit = memo.get(key);
  if (hit) return hit;
  let places: Place[];
  if (IS_STATIC) {
    const res = await fetch(photonUrl(q, near), { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    places = parsePhoton(await res.json());
  } else {
    const u = new URLSearchParams({ q: q.trim() });
    if (near) {
      u.set("lat", near[1].toFixed(2));
      u.set("lon", near[0].toFixed(2));
    }
    const res = await fetch(withBase(`/api/geocode?${u}`), { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    places = ((await res.json()) as { lugares?: Place[] }).lugares ?? [];
  }
  if (memo.size > 200) memo.clear();
  memo.set(key, places);
  return places;
};
