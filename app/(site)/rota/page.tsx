import type { Metadata } from "next";
import { Suspense } from "react";
import { RoutePage } from "@/components/route/route-page";

export const metadata: Metadata = {
  title: "Como chegar",
  description:
    "Planeje o caminho entre estações de metrô e trem de São Paulo: alternativas, horário de partida ou chegada, viabilidade pelos horários oficiais, acessibilidade e voz.",
};

export default function RotaPage() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-2 py-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-bold">Como chegar</h1>
        <p className="mt-1 text-lg text-ink-muted">
          Digite ou fale as estações. Mostramos alternativas e conferimos os horários oficiais quando eles existem.
        </p>
      </header>
      <Suspense fallback={null}>
        <RoutePage />
      </Suspense>
    </main>
  );
}
