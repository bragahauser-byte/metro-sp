import type { Metadata } from "next";
import { NearMe } from "@/components/geo/near-me";

export const metadata: Metadata = {
  title: "Perto de mim",
  description: "As três estações de metrô e trem mais perto de você, com distância e tempo a pé.",
};

export default function PertoDeMimPage() {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-2 py-6 sm:px-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase text-ink-muted">GPS</p>
        <h1 className="text-2xl font-bold">Perto de mim</h1>
      </header>
      <NearMe />
    </main>
  );
}
