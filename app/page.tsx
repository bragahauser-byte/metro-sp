import Link from "next/link";
import { LineBadge } from "@/components/ui/line-badge";
import { METRO_LINE_IDS } from "@/components/ui/lines";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-2 py-12 sm:px-4">
      <p className="text-caption font-medium uppercase tracking-widest text-ink-muted">
        Em construção
      </p>
      <h1 className="max-w-[12ch] text-display font-bold tracking-tight sm:text-hero">
        A rede de São Paulo como objeto de design.
      </h1>
      <ul className="flex flex-wrap gap-1" aria-label="Linhas de metrô">
        {METRO_LINE_IDS.map((id) => (
          <li key={id}>
            <LineBadge line={id} size="lg" />
          </li>
        ))}
      </ul>
      <Link href="/estilo" className="text-body font-semibold underline underline-offset-4">
        Ver o design system →
      </Link>
    </main>
  );
}
