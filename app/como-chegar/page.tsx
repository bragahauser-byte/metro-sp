import type { Metadata } from "next";
import { MapRedirect } from "@/components/map-redirect";

export const metadata: Metadata = { title: "Como chegar", robots: { index: false } };

export default function Page() {
  return <MapRedirect params={{ painel: "busca" }} />;
}
