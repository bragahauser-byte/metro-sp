import Link from "next/link";
import { LineBadge } from "@/components/ui/line-badge";
import { METRO_LINE_IDS } from "@/components/ui/lines";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-2 py-12 sm:px-4">
      <p className="text-xs font-medium uppercase text-ink-muted">
        Beta
      </p>
      <h1 className="max-w-[22ch] text-2xl font-bold">
        A rede de São Paulo como objeto de design.
      </h1>
      <ul className="flex flex-wrap gap-1" aria-label="Linhas de metrô">
        {METRO_LINE_IDS.map((id) => (
          <li key={id}>
            <LineBadge line={id} size="lg" />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Link href="/mapa" className="text-lg font-semibold underline underline-offset-4">
          Abrir o mapa →
        </Link>
        <Link href="/perto-de-mim" className="text-lg font-semibold underline underline-offset-4">
          Estação mais perto de mim →
        </Link>
      </div>
    </main>
  );
}
