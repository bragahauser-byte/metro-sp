import type { Metadata } from "next";
import { Suspense } from "react";
import { MapApp } from "@/components/map/map-app";

export const metadata: Metadata = {
  title: "Mapa",
  description: "Mapa interativo da rede de metrô de São Paulo: diagrama esquemático e traçado real, com estação mais perto de você.",
};

export default function MapaPage() {
  return (
    <Suspense fallback={<p className="p-4 text-base text-ink-muted">Carregando o mapa…</p>}>
      <MapApp />
    </Suspense>
  );
}
