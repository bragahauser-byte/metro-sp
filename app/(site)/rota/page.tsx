import type { Metadata } from "next";
import { Suspense } from "react";
import { RoutePage } from "@/components/route/route-page";

export const metadata: Metadata = {
  title: "Como chegar",
  description: "Planeje o caminho entre duas estações de metrô e trem de São Paulo, com baldeações e tempo estimado.",
};

export default function RotaPage() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-2 py-6 sm:px-4">
      <header>
        <h1 className="text-title-l font-bold tracking-tight sm:text-display">Como chegar</h1>
        <p className="mt-1 text-lead text-ink-muted">Escolha duas estações. O caminho prefere menos baldeações.</p>
      </header>
      <Suspense fallback={null}>
        <RoutePage />
      </Suspense>
    </main>
  );
}
