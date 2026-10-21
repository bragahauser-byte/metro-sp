import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineBadge } from "@/components/ui/line-badge";
import { StatusChip } from "@/components/ui/status-chip";
import { CURIOSITIES, lineNote } from "@/components/map/line-notes";
import { lineById, lines, stationBySlug } from "@/components/map/network";
import horarios from "@/data/horarios.json";
import { type ScheduleData, lineHoursSummary } from "@/lib/schedule/hours";

const TIPO: Record<string, string> = { metro: "Metrô", monotrilho: "Monotrilho", trem: "Trem metropolitano" };

export function generateStaticParams() {
  return lines.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/linhas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const line = lineById.get(id);
  if (!line) return {};
  const description = `${line.nome}: estações, integrações e situação. Operação ${line.operador}.`;
  return {
    title: line.nome,
    description,
    openGraph: { title: `${line.nome} · Metrô (beta)`, description, siteName: "Metrô (beta)", locale: "pt_BR", type: "website" },
  };
}

// Texto sobre o fundo na cor da linha: branco quando dá contraste, tinta escura nas cores claras.
function heroInk(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (l + 0.05) >= 4.5 ? "#ffffff" : "#111111";
}

function StationRule({ slugs, linha, cor }: { slugs: string[]; linha: string; cor: string }) {
  return (
    <ol className="relative">
      {/* Barra contínua centralizada nos pontos (ponto de 24px → centro em 12px; barra de 12px). */}
      <span aria-hidden className="absolute bottom-3 left-[6px] top-3 w-1.5" style={{ backgroundColor: cor }} />
      {slugs.map((slug) => {
        const st = stationBySlug.get(slug)!;
        const building = st.statusPorLinha[linha] === "em-obras";
        const others = st.linhas.filter((l) => l !== linha);
        return (
          <li key={slug} className="relative flex items-center gap-2 py-1">
            <span
              aria-hidden
              className="relative z-10 size-3 shrink-0 rounded-full border-[3px]"
              style={{ borderColor: building ? cor : "var(--bg)", background: building ? "var(--bg)" : "var(--ink)" }}
            />
            <span className="flex-1">
              <Link href={`/estacoes/${slug}`} className="text-lg font-bold hover:underline">
                {st.nome}
              </Link>
              {st.complemento && <span className="block text-xs text-ink-muted">{st.complemento}</span>}
              {building && <span className="block text-xs text-ink-muted">Em obras</span>}
            </span>
            <span className="flex flex-wrap justify-end gap-0.5">
              {others.map((l) => (
                <Link key={l} href={`/linhas/${l}`} aria-label={lineById.get(l)?.nome}>
                  <LineBadge line={l} size="sm" />
                </Link>
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function LinhaPage({ params }: PageProps<"/linhas/[id]">) {
  const { id } = await params;
  const line = lineById.get(id);
  if (!line) notFound();
  const note = lineNote(id);
  const ink = heroInk(line.cor);
  const [main, ...branches] = line.sequencias;
  const hours = lineHoursSummary(horarios as unknown as ScheduleData, id);
  const curiosities = CURIOSITIES[id] ?? [];
  const total = new Set(line.sequencias.flat()).size;

  return (
    <main className="flex flex-col">
      {/* Hero na cor da linha. */}
      <header style={{ backgroundColor: line.cor, color: ink }}>
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-2 py-8 sm:flex-row sm:items-end sm:px-4">
          <span className="inline-flex self-start rounded-full p-1" style={{ backgroundColor: "#ffffff" }}>
            <LineBadge line={id} size="xl" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase opacity-80">
              {TIPO[line.tipo]} · operação {line.operador}
            </p>
            <h1 className="text-2xl font-bold">{line.nome}</h1>
          </div>
          <Link
            href={`/mapa?linha=${id}`}
            className="inline-flex h-control items-center self-start bg-[#ffffff] px-3 text-base font-semibold text-[#111111] hover:opacity-90 sm:self-end"
            style={{ borderRadius: 999 }}
          >
            Ver no mapa
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1120px] gap-6 px-2 py-6 sm:px-4 md:grid-cols-[1fr_2fr]">
        <aside className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-2">
            <div className="border-t border-rule-strong pt-1">
              <dt className="text-xs text-ink-muted">Estações</dt>
              <dd className="text-2xl font-bold">{total}</dd>
            </div>
            <div className="border-t border-rule-strong pt-1">
              <dt className="text-xs text-ink-muted">Em operação</dt>
              <dd className="text-2xl font-bold">{line.extensaoOperacionalKm.toLocaleString("pt-BR")} km</dd>
            </div>
          </dl>
          <section className="flex flex-col gap-1 border-t border-rule pt-2">
            <h2 className="sr-only">Situação</h2>
            <StatusChip status={line.status} />
            <p className="text-base font-bold">{note.titulo}</p>
            <p className="text-base text-ink-muted">{note.texto}</p>
            {note.fonte && (
              <a className="text-xs text-ink-muted underline" href={note.fonte.url}>
                Fonte: {note.fonte.nome}
              </a>
            )}
          </section>
          <section className="flex flex-col gap-1 border-t border-rule pt-2">
            <h2 className="text-xs font-semibold uppercase text-ink-muted">Horário</h2>
            {hours ? (
              <>
                <p className="text-base">{hours.texto}</p>
                {hours.observacao && <p className="text-sm text-ink-muted">{hours.observacao}</p>}
                {hours.fonte && (
                  <a className="text-xs text-ink-muted underline" href={hours.fonte.url}>
                    Fonte: {hours.fonte.titulo} (consulta em {hours.fonte.consultadoEm.split("-").reverse().join("/")})
                  </a>
                )}
              </>
            ) : (
              <p className="text-base text-ink-muted">
                Horário não verificado em fonte oficial por este projeto. Consulte a operadora ({line.operador}).
              </p>
            )}
          </section>
          {curiosities.length > 0 && (
            <section className="flex flex-col gap-2 border-t border-rule pt-2">
              <h2 className="text-xs font-semibold uppercase text-ink-muted">Curiosidades</h2>
              {curiosities.map((c) => (
                <p key={c.texto} className="text-base">
                  {c.texto}{" "}
                  <a className="text-xs text-ink-muted underline" href={c.fonte.url}>
                    ({c.fonte.nome})
                  </a>
                </p>
              ))}
            </section>
          )}
          <p className="text-xs text-ink-muted">
            Extensão calculada pelo traçado do OpenStreetMap entre estações em operação. Ver{" "}
            <Link className="underline" href="/sobre">
              fontes
            </Link>
            .
          </p>
        </aside>

        <section aria-labelledby="estacoes" className="flex flex-col gap-3">
          <h2 id="estacoes" className="text-xl font-bold">
            Estações
          </h2>
          <StationRule slugs={main} linha={id} cor={line.cor} />
          {branches.map((b) => (
            <div key={b.join()} className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold uppercase text-ink-muted">
                Ramal a partir de {stationBySlug.get(b[0])?.nome}
              </h3>
              <StationRule slugs={b.slice(1)} linha={id} cor={line.cor} />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
