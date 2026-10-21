import type { Metadata } from "next";
import { MapRedirect } from "@/components/map-redirect";
import { stations } from "@/components/map/network";

export const metadata: Metadata = { robots: { index: false } };

export function generateStaticParams() {
  return stations.map((s) => ({ slug: s.slug }));
}

export default async function Page({ params }: PageProps<"/estacoes/[slug]">) {
  const { slug } = await params;
  return <MapRedirect params={{ estacao: slug }} />;
}
