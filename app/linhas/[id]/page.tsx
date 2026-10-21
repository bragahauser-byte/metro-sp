import type { Metadata } from "next";
import { MapRedirect } from "@/components/map-redirect";
import { lines } from "@/components/map/network";

export const metadata: Metadata = { robots: { index: false } };

export function generateStaticParams() {
  return lines.map((l) => ({ id: l.id }));
}

export default async function Page({ params }: PageProps<"/linhas/[id]">) {
  const { id } = await params;
  return <MapRedirect params={{ linha: id }} />;
}
