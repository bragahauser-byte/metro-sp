"use client";

import { LineBadge } from "@/components/ui/line-badge";
import { StatusChip } from "@/components/ui/status-chip";
import { IconButton, Icons, Spinner } from "@/components/ui/button";
import { StationCombobox } from "@/components/route/station-combobox";
import { useOps } from "@/components/ops/use-ops";
import { FULL_SITE_URL } from "@/lib/env";
import { type Nearby, formatDistance } from "@/components/geo/nearest";
import { GEO_MESSAGES, type GeoState } from "@/components/geo/use-geolocation";
import { Switch } from "@/components/ui/switch";
import { schedule } from "@/components/route/plan";
import { lineHoursSummary } from "@/lib/schedule/hours";
import { lineNote, notices } from "./line-notes";
import { RAIL_LINES, lineById, lines, neighborsOf, stationBySlug, stationsOfLine } from "./network";

const TIPO: Record<string, string> = { metro: "Linha de metrô", monotrilho: "Monotrilho", trem: "Trem metropolitano" };

export function BackButton({ onClick, label = "Voltar" }: { onClick: () => void; label?: string }) {
  return (
    <IconButton variant="plain" onClick={onClick} label={label} className="-ml-1.5">
      {Icons.back}
    </IconButton>
  );
}

/** Busca por nome — também é a alternativa quando a localização falha. */
export function StationSearch({ onPick, autoFocus = false }: { onPick: (slug: string) => void; autoFocus?: boolean }) {
  return <StationCombobox label="Buscar estação pelo nome" hideLabel placeholder="Buscar estação" onPick={onPick} autoFocus={autoFocus} />;
}

export function LinesGrid({
  showRail,
  onToggleRail,
  onPickLine,
}: {
  showRail: boolean;
  onToggleRail: (v: boolean) => void;
  onPickLine: (id: string) => void;
}) {
  const metro = lines.filter((l) => !RAIL_LINES.has(l.id));
  const rail = lines.filter((l) => RAIL_LINES.has(l.id));
  const grid = (ls: typeof lines) => (
    <ul className="-mx-1 grid grid-cols-6">
      {ls.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => onPickLine(l.id)}
            className="flex size-control items-center justify-center transition-transform duration-(--duration-fast) ease-standard hover:scale-110"
            aria-label={`${l.nome}: ver estações`}
          >
            <LineBadge line={l.id} />
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-2">
      {grid(metro)}
      <Switch checked={showRail} onChange={onToggleRail} className="border-t border-rule">
        Trens metropolitanos (7 a 13)
      </Switch>
      {showRail && grid(rail)}
    </div>
  );
}

export function LineView({
  id,
  selectedStation,
  onBack,
  onPickStation,
}: {
  id: string;
  selectedStation: string | null;
  onBack: () => void;
  onPickStation: (slug: string) => void;
}) {
  const line = lineById.get(id)!;
  const seq = stationsOfLine(id);
  const branches = line.sequencias.length > 1;
  const note = lineNote(id);
  const hours = lineHoursSummary(schedule, id);
  return (
    <div className="flex flex-col gap-2">
      {/* Como no Live Subway Map: voltar à esquerda, ícone grande da linha no centro. */}
      <div className="relative flex justify-center pt-0.5">
        <span className="absolute left-0 top-0">
          <BackButton onClick={onBack} label="Voltar para as linhas" />
        </span>
        <LineBadge line={id} size="xl" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold">{line.nome}</h2>
        <p className="text-xs text-ink-muted">
          {TIPO[line.tipo]} · operação {line.operador} · {line.extensaoOperacionalKm.toLocaleString("pt-BR")} km
        </p>
      </div>
      <div className="border-t border-rule pt-2">
        <p className="text-base font-bold">{note.titulo}</p>
        <p className="text-base text-ink-muted">{note.texto}</p>
        {note.fonte && (
          <a className="text-xs text-ink-muted underline" href={note.fonte.url}>
            Fonte: {note.fonte.nome}
          </a>
        )}
      </div>
      <div className="border-t border-rule pt-2">
        <h3 className="text-xs font-semibold uppercase text-ink-muted">Horário de funcionamento</h3>
        {hours ? (
          <>
            <p className="text-sm">{hours.texto}</p>
            {hours.observacao && <p className="text-xs text-ink-muted">{hours.observacao}</p>}
            {hours.fonte && (
              <a className="text-xs text-ink-muted underline" href={hours.fonte.url}>
                Fonte: {hours.fonte.titulo} (consulta em {hours.fonte.consultadoEm.split("-").reverse().join("/")})
              </a>
            )}
          </>
        ) : (
          <p className="text-sm text-fg-warning">
            Horário não verificado em fonte oficial. Consulte a operadora ({line.operador}) antes de viajar.
          </p>
        )}
      </div>
      {branches && (
        <p className="text-xs text-ink-muted">
          Linha em “Y”: ramal a partir de {stationBySlug.get(line.sequencias[1][0])?.nome}.
        </p>
      )}
      {/* Régua de estações: a linha vertical na cor da linha, um ponto por estação. */}
      <ol className="relative mt-1" aria-label={`Estações da ${line.nome}`}>
        <span aria-hidden className="absolute bottom-3 left-[9px] top-3 w-1" style={{ backgroundColor: line.cor }} />
        {seq.map((slug) => {
          const st = stationBySlug.get(slug)!;
          const others = st.linhas.filter((l) => l !== id);
          const status = st.statusPorLinha[id];
          return (
            <li key={slug} className="relative">
              <button
                type="button"
                onClick={() => onPickStation(slug)}
                aria-current={slug === selectedStation ? "true" : undefined}
                className="flex min-h-control w-full items-center gap-2 pl-0 text-left hover:underline aria-[current=true]:font-bold"
              >
                <span
                  aria-hidden
                  className="relative z-10 ml-0.5 size-1.5 shrink-0 rounded-full border-2 border-surface bg-ink"
                  style={status === "em-obras" ? { background: "var(--surface)", borderColor: line.cor } : undefined}
                />
                <span className="flex-1 text-base">
                  {st.nome}
                  {status === "em-obras" && <span className="ml-1 text-xs text-ink-muted">em obras</span>}
                </span>
                <span className="flex gap-0.5">
                  {others.map((l) => (
                    <LineBadge key={l} line={l} size="sm" />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StationView({
  slug,
  onBack,
  onPickLine,
  onPickStation,
  walk,
}: {
  slug: string;
  onBack: () => void;
  onPickLine: (id: string) => void;
  onPickStation: (slug: string) => void;
  walk?: Nearby | null;
}) {
  const st = stationBySlug.get(slug)!;
  const nbs = neighborsOf(slug);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-1">
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{st.nome}</h2>
          {st.complemento && <p className="text-xs text-ink-muted">{st.complemento}</p>}
        </div>
      </div>
      <ul className="flex flex-wrap gap-1 pl-1" aria-label="Linhas">
        {st.linhas.map((l) => (
          <li key={l}>
            <button type="button" className="-m-1 flex size-control items-center justify-center" onClick={() => onPickLine(l)} aria-label={`Ver ${lineById.get(l)?.nome}`}>
              <LineBadge line={l} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1">
        {[...new Set(Object.values(st.statusPorLinha))].map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        {st.acessivel === "sim"
          ? "♿ Acessível, segundo o OpenStreetMap."
          : st.acessivel === "limitado"
            ? "♿ Acessibilidade parcial, segundo o OpenStreetMap."
            : "Acessibilidade: sem informação confirmada."}
      </p>
      {walk && (
        <p className="text-base">
          <strong>{formatDistance(walk.distanciaM)}</strong> de você · cerca de {walk.minutos} min a pé
        </p>
      )}
      {st.integracoes.length > 0 && (
        <p className="text-base">
          Passagem para{" "}
          {st.integracoes.map((o) => (
            <button key={o} type="button" className="inline-flex min-h-control items-center font-semibold underline underline-offset-2" onClick={() => onPickStation(o)}>
              {stationBySlug.get(o)?.nome}
            </button>
          ))}
        </p>
      )}
      <div className="border-t border-rule pt-2">
        <h3 className="text-xs font-semibold uppercase text-ink-muted">Estações vizinhas</h3>
        <ul className="mt-1 flex flex-col">
          {nbs.map((n, i) => (
            <li key={`${n.linha}-${i}`} className="flex items-center gap-1 text-base">
              <LineBadge line={n.linha} size="sm" />
              {[n.anterior, n.proxima].filter(Boolean).map((s, j) => (
                <span key={s} className="flex items-center gap-1">
                  {j > 0 && <span aria-hidden className="text-ink-muted">·</span>}
                  <button type="button" className="inline-flex min-h-control items-center hover:underline" onClick={() => onPickStation(s!)}>
                    {stationBySlug.get(s!)?.nome}
                  </button>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function NearView({
  geo,
  nearby,
  target,
  onPick,
  onRetry,
  onBack,
}: {
  geo: GeoState;
  nearby: Nearby[];
  target: string | null;
  onPick: (slug: string) => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-1">
        <BackButton onClick={onBack} />
        <h2 className="text-lg font-bold">Perto de você</h2>
      </div>
      {geo.status === "idle" && (
        <>
          <p className="text-base">Mostramos as três estações mais perto de você, com a distância e o tempo a pé estimados.</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-control items-center self-start bg-ink px-3 text-base font-semibold text-bg"
            style={{ borderRadius: "var(--radius-control)" }}
          >
            Usar minha localização
          </button>
          <p className="text-xs text-ink-muted">A localização fica só neste aparelho.</p>
        </>
      )}
      {geo.status === "locating" && <p className="text-base text-ink-muted">Procurando sua localização…</p>}
      {geo.status === "error" && (
        <>
          <p className="text-base">{GEO_MESSAGES[geo.reason]}</p>
          {geo.reason !== "unsupported" && (
            <button type="button" onClick={onRetry} className="inline-flex min-h-control items-center self-start text-base font-semibold underline underline-offset-4">
              Tentar de novo
            </button>
          )}
          <StationSearch onPick={onPick} autoFocus />
        </>
      )}
      {geo.status === "ok" && (
        <>
          {nearby[0] && nearby[0].distanciaM > 15000 && (
            <p className="text-xs text-ink-muted">Você parece estar fora da região metropolitana.</p>
          )}
          <ol className="flex flex-col">
            {nearby.map((n, i) => {
              const st = stationBySlug.get(n.slug)!;
              return (
                <li key={n.slug} className="border-b border-rule last:border-0">
                  <button
                    type="button"
                    onClick={() => onPick(n.slug)}
                    aria-current={target === n.slug ? "true" : undefined}
                    className="flex min-h-control w-full items-center gap-2 py-1 text-left aria-[current=true]:font-bold"
                  >
                    <span className="w-2 text-xs tabular-nums text-ink-muted">{i + 1}</span>
                    <span className="flex-1">
                      <span className="block text-base font-semibold">{st.nome}</span>
                      <span className="block text-xs text-ink-muted">
                        {formatDistance(n.distanciaM)} · {n.minutos} min a pé
                      </span>
                    </span>
                    <span className="flex gap-0.5">
                      {st.linhas.map((l) => (
                        <LineBadge key={l} line={l} size="sm" />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-ink-muted">
            Distância em linha reta; o tempo a pé é estimado. Sua localização fica só neste navegador.
          </p>
        </>
      )}
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Comunicados oficiais recentes (RSS da operadora). Nunca apresentados como status em tempo real. */
export function OfficialUpdates({ onlyLines, limit = 5 }: { onlyLines?: string[]; limit?: number }) {
  const ops = useOps();
  return (
    <section aria-labelledby="comunicados" className="flex flex-col gap-1" aria-busy={ops.status === "loading"}>
      <h3 id="comunicados" className="text-xs font-semibold uppercase text-ink-muted">
        Comunicados oficiais recentes
      </h3>
      {ops.status === "static" && (
        <p className="text-sm text-ink-muted">
          Comunicados oficiais estão disponíveis na{" "}
          <a className="font-semibold underline" href={FULL_SITE_URL}>
            versão completa
          </a>{" "}
          (precisa de servidor, que esta versão estática não tem).
        </p>
      )}
      {ops.status === "loading" && (
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          <Spinner /> Carregando comunicados…
        </p>
      )}
      {ops.status === "error" && (
        <p className="text-sm text-ink-muted">
          Não foi possível carregar os comunicados agora.{" "}
          <button type="button" onClick={ops.retry} className="inline-flex min-h-control items-center font-semibold underline">
            Tentar de novo
          </button>
        </p>
      )}
      {ops.status === "ok" &&
        (() => {
          const items = ops.data.itens
            .filter((i) => i.operacional && (!onlyLines || i.linhas.some((l) => onlyLines.includes(l))))
            .slice(0, limit);
          const failed = ops.data.fontes.filter((f) => !f.ok);
          const lastOk = ops.data.fontes.map((f) => f.ultimaColetaOkEm).filter(Boolean).sort().at(-1) ?? null;
          return (
            <>
              {items.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum comunicado operacional recente nas fontes acompanhadas.</p>
              ) : (
                <ul className="flex flex-col">
                  {items.map((i) => (
                    <li key={i.id} className="border-b border-rule py-1 last:border-0">
                      <a href={i.link} className="group flex min-h-control flex-col justify-center">
                        <span className="text-sm font-semibold group-hover:underline">{i.titulo}</span>
                        <span className="text-xs text-ink-muted">
                          {i.fonte.nome} · publicado em {dateFmt.format(new Date(i.publicadoEm))}
                          {i.linhas.length > 0 && ` · linhas ${i.linhas.join(", ")}`}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-ink-muted">
                Comunicados publicados pelas operadoras (a data de cada um é a de publicação). Lidos a cada 30 min no máximo;{" "}
                {lastOk ? <>última atualização bem-sucedida: {dateTimeFmt.format(new Date(lastOk))}.</> : "nenhuma leitura bem-sucedida ainda."}{" "}
                Não é situação em tempo real.
                {failed.length > 0 &&
                  ` Fonte indisponível agora: ${failed.map((f) => f.nome).join(", ")}${failed.some((f) => f.preservado) ? " — mostrando os últimos dados válidos" : ""}.`}
              </p>
            </>
          );
        })()}
    </section>
  );
}

/** Situação das linhas fora do normal (botão "!"). */
export function AlertsView({ onBack, onPickLine }: { onBack: () => void; onPickLine: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <BackButton onClick={onBack} />
        <h2 className="text-lg font-bold">Avisos</h2>
      </div>
      <h3 className="text-xs font-semibold uppercase text-ink-muted">Linhas fora da operação normal</h3>
      <ul className="flex flex-col">
        {notices().map((n) => (
          <li key={n.id} className="flex gap-2 border-b border-rule py-2 last:border-0">
            <button type="button" className="-m-1 flex size-control shrink-0 items-center justify-center" onClick={() => onPickLine(n.id)} aria-label={`Ver ${lineById.get(n.id)?.nome}`}>
              <LineBadge line={n.id} />
            </button>
            <div>
              <p className="text-base font-bold">
                {lineById.get(n.id)?.nome}: {n.titulo.toLowerCase()}
              </p>
              <p className="text-sm text-ink-muted">{n.texto}</p>
              {n.fonte && (
                <a className="text-xs text-ink-muted underline" href={n.fonte.url}>
                  Fonte: {n.fonte.nome}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <OfficialUpdates />
      <p className="text-xs text-ink-muted">
        Projeto conceitual. Para a situação das linhas agora, consulte{" "}
        <a className="underline" href="https://www.metro.sp.gov.br">
          metro.sp.gov.br
        </a>{" "}
        e os canais de cada operadora.
      </p>
    </div>
  );
}
