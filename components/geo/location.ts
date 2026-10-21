"use client";

// Localização do aparelho, num lugar só (mapa, busca e rota leem o mesmo estado). Fica apenas na
// memória desta página: nunca vai para o servidor, não é salva nem registrada. Acompanhamento
// contínuo (watchPosition) só enquanto há rota ativa saindo de "Sua localização".
import { useSyncExternalStore } from "react";
import type { LngLat } from "@/components/map/network";

export type GeoError = "denied" | "unavailable" | "timeout" | "unsupported";
export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ok"; lngLat: LngLat; accuracy: number }
  | { status: "error"; reason: GeoError };

/** O que o navegador diz da permissão antes de perguntar ("unknown" se não dá para saber). */
export type Permission = "unknown" | "prompt" | "granted" | "denied";

type Snapshot = { geo: GeoState; permission: Permission; watching: boolean };

let snap: Snapshot = { geo: { status: "idle" }, permission: "unknown", watching: false };
const listeners = new Set<() => void>();
const set = (p: Partial<Snapshot>) => {
  snap = { ...snap, ...p };
  listeners.forEach((l) => l());
};

const SERVER: Snapshot = { geo: { status: "idle" }, permission: "unknown", watching: false };
export function useLocation(): Snapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snap,
    () => SERVER,
  );
}

export const OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 };

export function errorReason(code: number): GeoError {
  return code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable";
}

/** Consulta a permissão sem disparar o pedido (Permissions API; Safari antigo não tem). */
export async function checkPermission(): Promise<Permission> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (!status) return "unknown";
    const read = () => set({ permission: status.state as Permission });
    read();
    status.onchange = read;
    return status.state as Permission;
  } catch {
    return "unknown";
  }
}

/** Pede a posição (o navegador mostra o pedido de permissão se ainda não foi respondido). */
export function requestLocation(): Promise<LngLat | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    set({ geo: { status: "error", reason: "unsupported" } });
    return Promise.resolve(null);
  }
  set({ geo: { status: "locating" } });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lngLat: LngLat = [pos.coords.longitude, pos.coords.latitude];
        set({ geo: { status: "ok", lngLat, accuracy: pos.coords.accuracy }, permission: "granted" });
        resolve(lngLat);
      },
      (err) => {
        const reason = errorReason(err.code);
        set({ geo: { status: "error", reason }, ...(reason === "denied" ? { permission: "denied" as const } : {}) });
        resolve(null);
      },
      OPTIONS,
    );
  });
}

let watchId: number | null = null;

/** Acompanha a posição enquanto a rota estiver aberta. Devolve a função que para. */
export function startWatch(): () => void {
  if (watchId !== null || typeof navigator === "undefined" || !("geolocation" in navigator)) return () => {};
  watchId = navigator.geolocation.watchPosition(
    (pos) => set({ geo: { status: "ok", lngLat: [pos.coords.longitude, pos.coords.latitude], accuracy: pos.coords.accuracy } }),
    (err) => {
      // Perder o sinal no meio do caminho não apaga a última posição boa.
      if (errorReason(err.code) === "denied") set({ geo: { status: "error", reason: "denied" }, permission: "denied" });
    },
    OPTIONS,
  );
  set({ watching: true });
  return stopWatch;
}

export function stopWatch() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (snap.watching) set({ watching: false });
}

/** Só para testes: volta ao começo. */
export function resetLocation() {
  stopWatch();
  snap = { geo: { status: "idle" }, permission: "unknown", watching: false };
}

/** Estado atual fora do React (testes e efeitos). */
export const getLocation = () => snap;
