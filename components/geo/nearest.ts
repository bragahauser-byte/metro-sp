// Estações mais próximas de um ponto — calculado só no navegador; a localização nunca sai daqui.
import { type LngLat, stations } from "@/components/map/network";

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine([lon1, lat1]: LngLat, [lon2, lat2]: LngLat) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// A pé: 4,8 km/h, com 30% a mais de caminho por causa do traçado das ruas.
const WALK_M_PER_MIN = 80;
const DETOUR = 1.3;

export type Nearby = { slug: string; distanciaM: number; minutos: number };

export function nearestStations(from: LngLat, n = 3): Nearby[] {
  return stations
    .filter((s) => s.status === "operando" || s.status === "operacao-assistida")
    .map((s) => {
      const d = haversine(from, s.geo);
      return { slug: s.slug, distanciaM: d, minutos: Math.max(1, Math.ceil((d * DETOUR) / WALK_M_PER_MIN)) };
    })
    .sort((a, b) => a.distanciaM - b.distanciaM)
    .slice(0, n);
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}
