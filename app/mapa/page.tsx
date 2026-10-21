import type { Metadata } from "next";
import { MapRedirect } from "@/components/map-redirect";

export const metadata: Metadata = { title: "Mapa", robots: { index: false } };

export default function Page() {
  return <MapRedirect />;
}
