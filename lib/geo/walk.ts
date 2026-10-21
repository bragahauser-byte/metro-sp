// Distância e caminhada. Tudo é ESTIMATIVA: linha reta (haversine) × fator de desvio das ruas,
// a passo de 4,5 km/h. Não usamos roteador de caminhada externo (os servidores públicos de
// demonstração não permitem uso em produção), então a interface sempre diz "cerca de".

export type LngLat = [number, number];

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distância em linha reta, em metros. */
export function haversine([lon1, lat1]: LngLat, [lon2, lat2]: LngLat) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** O caminho pelas ruas é, em média, ~30% maior que a linha reta. */
export const DETOUR = 1.3;
export const WALK_KMH = 4.5;
export const WALK_M_PER_MIN = (WALK_KMH * 1000) / 60; // 75 m/min

export type Walk = {
  /** Linha reta, em metros. */
  retaM: number;
  /** Estimativa do caminho pelas ruas (reta × DETOUR), arredondada a 10 m. */
  distanciaM: number;
  /** Minutos a pé, arredondados para cima (mínimo 1). */
  minutos: number;
};

export function estimateWalk(a: LngLat, b: LngLat): Walk {
  const retaM = haversine(a, b);
  const distanciaM = Math.round((retaM * DETOUR) / 10) * 10;
  return { retaM, distanciaM, minutos: Math.max(1, Math.ceil((retaM * DETOUR) / WALK_M_PER_MIN)) };
}

export function formatDistance(m: number) {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}
