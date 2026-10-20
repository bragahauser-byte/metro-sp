"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LngLat } from "@/components/map/network";

export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ok"; lngLat: LngLat; accuracy: number }
  | { status: "error"; reason: "denied" | "unavailable" | "timeout" | "unsupported" };

export const GEO_MESSAGES: Record<Extract<GeoState, { status: "error" }>["reason"], string> = {
  denied: "Você não autorizou o acesso à localização. Dá para buscar a estação pelo nome.",
  unavailable: "Não foi possível descobrir sua localização agora. Tente de novo ou busque pelo nome.",
  timeout: "A localização demorou demais para responder. Tente de novo ou busque pelo nome.",
  unsupported: "Este navegador não oferece localização. Busque a estação pelo nome.",
};

/**
 * Localização sob demanda: só pede permissão quando `request` é chamado por um clique.
 * A posição fica apenas na memória desta página — não é enviada, salva nem registrada.
 */
export function useGeolocation(onLocated?: (lngLat: LngLat) => void) {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const onLocatedRef = useRef(onLocated);
  useEffect(() => {
    onLocatedRef.current = onLocated;
  });

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "error", reason: "unsupported" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lngLat: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setState({ status: "ok", lngLat, accuracy: pos.coords.accuracy });
        onLocatedRef.current?.(lngLat);
      },
      (err) =>
        setState({
          status: "error",
          reason: err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  const clear = useCallback(() => setState({ status: "idle" }), []);

  return { state, request, clear };
}
