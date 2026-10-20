import type { Metadata } from "next";
import Link from "next/link";
import { LineBadge } from "@/components/ui/line-badge";
import { StatusChip } from "@/components/ui/status-chip";
import { RAIL_LINES, lines, stationsOfLine } from "@/components/map/network";

export const metadata: Metadata = {
  title: "Linhas",
  description: "Todas as linhas de metrô, monotrilho e trem metropolitano de São Paulo, com situação e estações.",
};

function LineList({ title, ids }: { title: string; ids: string[] }) {
  return (
    <section aria-labelledby={`h-${title}`} className="flex flex-col gap-1">
      <h2 id={`h-${title}`} className="text-caption font-semibold uppercase tracking-widest text-ink-muted">
        {title}
      </h2>
      <ul className="flex flex-col">
        {lines
          .filter((l) => ids.includes(l.id))
          .map((l) => (
            <li key={l.id} className="border-b border-rule">
              <Link href={`/linhas/${l.id}`} className="group flex items-center gap-2 py-2">
                <LineBadge line={l.id} size="lg" />
                <span className="flex-1">
                  <span className="block text-lead font-bold tracking-tight group-hover:underline">{l.nome}</span>
                  <span className="block text-caption text-ink-muted">
                    {stationsOfLine(l.id).length} estações · operação {l.operador}
                  </span>
                </span>
                <StatusChip status={l.status} />
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}

export default function LinhasPage() {
  const metro = lines.filter((l) => !RAIL_LINES.has(l.id)).map((l) => l.id);
  const rail = lines.filter((l) => RAIL_LINES.has(l.id)).map((l) => l.id);
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-2 py-6 sm:px-4">
      <header>
        <h1 className="text-title-l font-bold tracking-tight sm:text-display">Linhas</h1>
      </header>
      <LineList title="Metrô e monotrilho" ids={metro} />
      <LineList title="Trens metropolitanos" ids={rail} />
    </main>
  );
}
