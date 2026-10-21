// Estações mais próximas de um ponto — calculado só no navegador; a localização nunca sai daqui.
import { stations } from "@/components/map/network";
import { type LngLat, estimateWalk } from "@/lib/geo/walk";

export { formatDistance, haversine } from "@/lib/geo/walk";

export type Nearby = { slug: string; distanciaM: number; minutos: number };

export function nearestStations(from: LngLat, n = 3): Nearby[] {
  return stations
    .filter((s) => s.status === "operando" || s.status === "operacao-assistida")
    .map((s) => {
      const w = estimateWalk(from, s.geo);
      return { slug: s.slug, distanciaM: w.retaM, minutos: w.minutos };
    })
    .sort((a, b) => a.distanciaM - b.distanciaM)
    .slice(0, n);
}
