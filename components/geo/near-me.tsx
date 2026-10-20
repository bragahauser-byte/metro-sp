"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { LineBadge } from "@/components/ui/line-badge";
import { StationSearch } from "@/components/map/panels";
import { stationBySlug } from "@/components/map/network";
import { formatDistance, nearestStations } from "./nearest";
import { GEO_MESSAGES, useGeolocation } from "./use-geolocation";
import { useRouter } from "next/navigation";

export function NearMe() {
  const { state, request } = useGeolocation();
  const router = useRouter();
  const nearby = useMemo(() => (state.status === "ok" ? nearestStations(state.lngLat, 3) : []), [state]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Button onClick={request} disabled={state.status === "locating"} className="self-start">
          {state.status === "locating" ? "Procurando…" : "Estação mais perto de mim"}
        </Button>
        <p className="max-w-[56ch] text-caption text-ink-muted">
          O navegador pede sua permissão. A localização é usada só nesta página para calcular a distância — não é
          enviada, salva nem registrada.
        </p>
      </div>

      <div aria-live="polite">
        {state.status === "error" && <p className="text-body">{GEO_MESSAGES[state.reason]}</p>}
        {state.status === "ok" && (
          <ol className="flex flex-col">
            {nearby.map((n, i) => {
              const st = stationBySlug.get(n.slug)!;
              return (
                <li key={n.slug} className="flex items-center gap-2 border-b border-rule py-2">
                  <span className="w-3 text-title-s font-bold tabular-nums text-ink-muted">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-lead font-bold tracking-tight">{st.nome}</p>
                    <p className="text-caption text-ink-muted">
                      {formatDistance(n.distanciaM)} em linha reta · cerca de {n.minutos} min a pé
                    </p>
                  </div>
                  <span className="flex gap-0.5">
                    {st.linhas.map((l) => (
                      <LineBadge key={l} line={l} size="sm" />
                    ))}
                  </span>
                  <Link className="text-body font-semibold underline underline-offset-4" href={`/mapa?estacao=${n.slug}&modo=real`}>
                    Mapa
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="max-w-sm">
        <h2 className="mb-1 text-caption font-semibold uppercase tracking-widest text-ink-muted">Ou busque pelo nome</h2>
        <StationSearch onPick={(slug) => router.push(`/mapa?estacao=${slug}`)} />
      </div>
    </div>
  );
}
