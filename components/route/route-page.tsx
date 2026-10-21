"use client";

import { useSearchParams } from "next/navigation";
import { stationBySlug } from "@/components/map/network";
import { RoutePlanner } from "./route-planner";

/** /rota?de=…&para=…: lê as estações do endereço e mantém o endereço em dia. */
export function RoutePage() {
  const params = useSearchParams();
  const valid = (s: string | null) => (s && stationBySlug.has(s) ? s : null);
  return (
    <RoutePlanner
      initialFrom={valid(params.get("de"))}
      initialTo={valid(params.get("para"))}
      onRoute={(_, from, to) => {
        const u = new URLSearchParams();
        if (from) u.set("de", from);
        if (to) u.set("para", to);
        const qs = u.toString();
        window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
      }}
    />
  );
}
