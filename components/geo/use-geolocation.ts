"use client";

import { useCallback, useEffect, useRef } from "react";
import type { LngLat } from "@/components/map/network";
import { type GeoState, requestLocation, useLocation } from "./location";

export type { GeoState } from "./location";

export const GEO_MESSAGES: Record<Extract<GeoState, { status: "error" }>["reason"], string> = {
  denied: "A localização está bloqueada neste navegador. Escolha a origem pela busca — ou libere nas configurações.",
  unavailable: "Não foi possível descobrir sua localização agora. Tente de novo ou escolha a origem pela busca.",
  timeout: "A localização demorou demais para responder. Tente de novo ou escolha a origem pela busca.",
  unsupported: "Este navegador não oferece localização. Escolha a origem pela busca.",
};

/**
 * Localização compartilhada (ver ./location): `request` pede a posição e chama `onLocated` quando
 * ela chega. A posição fica apenas na memória desta página — não é enviada, salva nem registrada.
 */
export function useGeolocation(onLocated?: (lngLat: LngLat) => void) {
  const { geo } = useLocation();
  const onLocatedRef = useRef(onLocated);
  useEffect(() => {
    onLocatedRef.current = onLocated;
  });
  const request = useCallback(() => {
    requestLocation().then((ll) => ll && onLocatedRef.current?.(ll));
  }, []);
  return { state: geo, request };
}
