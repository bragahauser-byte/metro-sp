import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineBadge } from "@/components/ui/line-badge";
import { StatusChip } from "@/components/ui/status-chip";
import { StationMiniMap } from "@/components/pages/station-minimap";
import { entrances, lineById, neighborsOf, stationBySlug, stations } from "@/components/map/network";

export function generateStaticParams() {
  return stations.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/estacoes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const st = stationBySlug.get(slug);
  if (!st) return {};
  const names = st.linhas.map((l) => lineById.get(l)?.nome).join(", ");
  const description = `Estação ${st.nome} (${names}): linhas, integrações, vizinhas e mapa do entorno.`;
  return {
    title: `Estação ${st.nome}`,
    description,
    openGraph: { title: `Estação ${st.nome} · Metrô (beta)`, description, siteName: "Metrô (beta)", locale: "pt_BR", type: "website" },
  };
}

const ACESSO: Record<string, string> = {
  sim: "Acessível, segundo o OpenStreetMap.",
  limitado: "Acessibilidade parcial, segundo o OpenStreetMap.",
};

export default async function EstacaoPage({ params }: PageProps<"/estacoes/[slug]">) {
  const { slug } = await params;
  const st = stationBySlug.get(slug);
  if (!st) notFound();
  const nbs = neighborsOf(slug);
  const entradas = entrances.filter((e) => e.estacao === slug).length;

  return (
    <main className="mx-auto grid w-full max-w-[1120px] gap-6 px-2 py-6 sm:px-4 md:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-ink-muted">Estação</p>
          <h1 className="text-2xl font-bold">{st.nome}</h1>
          {st.complemento && <p className="text-lg text-ink-muted">{st.complemento}</p>}
          <ul className="flex flex-wrap gap-1" aria-label="Linhas">
            {st.linhas.map((l) => (
              <li key={l}>
                <Link href={`/linhas/${l}`} className="flex items-center gap-1 pr-1 hover:underline">
                  <LineBadge line={l} size="lg" />
                  <span className="text-base font-semibold">{lineById.get(l)?.nome}</span>
                </Link>
              </li>
            ))}
          </ul>
        </header>

        <section className="flex flex-col gap-1 border-t border-rule pt-2">
          <h2 className="text-xs font-semibold uppercase text-ink-muted">Situação</h2>
          <ul className="flex flex-wrap gap-1">
            {st.linhas.map((l) => (
              <li key={l} className="flex items-center gap-1">
                <LineBadge line={l} size="sm" />
                <StatusChip status={st.statusPorLinha[l]} />
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-1 border-t border-rule pt-2">
          <h2 className="text-xs font-semibold uppercase text-ink-muted">Integrações</h2>
          {st.linhas.length > 1 ? (
            <p className="text-base">Baldeação entre {st.linhas.map((l) => lineById.get(l)?.nome).join(" e ")} na própria estação.</p>
          ) : (
            <p className="text-base text-ink-muted">Sem baldeação para outras linhas nesta estação.</p>
          )}
          {st.integracoes.map((o) => (
            <p key={o} className="text-base">
              Passagem para a estação{" "}
              <Link className="font-semibold underline" href={`/estacoes/${o}`}>
                {stationBySlug.get(o)?.nome}
              </Link>
              .
            </p>
          ))}
        </section>

        <section className="flex flex-col gap-1 border-t border-rule pt-2">
          <h2 className="text-xs font-semibold uppercase text-ink-muted">Acessibilidade e acessos</h2>
          <p className="text-base">{(st.acessivel && ACESSO[st.acessivel]) ?? "Sem informação de acessibilidade confirmada."}</p>
          <p className="text-base text-ink-muted">
            {entradas > 0 ? `${entradas} entrada${entradas > 1 ? "s" : ""} mapeada${entradas > 1 ? "s" : ""} no OpenStreetMap.` : "Entradas ainda não mapeadas no OpenStreetMap."}
          </p>
        </section>

        <section className="flex flex-col gap-1 border-t border-rule pt-2">
          <h2 className="text-xs font-semibold uppercase text-ink-muted">Estações vizinhas</h2>
          <ul className="flex flex-col gap-1">
            {nbs.map((n, i) => (
              <li key={`${n.linha}-${i}`} className="flex flex-wrap items-center gap-1 text-base">
                <LineBadge line={n.linha} size="sm" />
                {[n.anterior, n.proxima].filter(Boolean).map((s, j) => (
                  <span key={s} className="flex items-center gap-1">
                    {j > 0 && <span aria-hidden className="text-ink-muted">·</span>}
                    <Link className="hover:underline" href={`/estacoes/${s}`}>
                      {stationBySlug.get(s!)?.nome}
                    </Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="flex flex-col gap-2">
        <StationMiniMap slug={slug} />
        <Link
          href={`/mapa?estacao=${slug}&modo=real`}
          className="inline-flex h-control items-center self-start bg-ink px-3 text-base font-semibold text-bg hover:opacity-85"
          style={{ borderRadius: 999 }}
        >
          Ver no mapa
        </Link>
      </aside>
    </main>
  );
}
