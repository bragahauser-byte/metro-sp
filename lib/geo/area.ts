// Área atendida: Região Metropolitana de São Paulo (com folga para Jundiaí, ponta da Linha 7).
import type { LngLat } from "./walk.ts";

/** [oeste, sul, leste, norte] */
export const RMSP_BBOX = [-47.25, -24.1, -45.65, -23.1] as const;

export const inArea = ([lng, lat]: LngLat) =>
  lng >= RMSP_BBOX[0] && lng <= RMSP_BBOX[2] && lat >= RMSP_BBOX[1] && lat <= RMSP_BBOX[3];
