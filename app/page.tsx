import { Suspense } from "react";
import { MapApp } from "@/components/map/map-app";
import { Splash } from "@/components/map/splash";

// O site abre direto no mapa (como Google Maps e Apple Maps). A abertura aparece só enquanto o
// mapa e os dados carregam.
export default function Home() {
  return (
    <Suspense fallback={<Splash />}>
      <MapApp />
    </Suspense>
  );
}
