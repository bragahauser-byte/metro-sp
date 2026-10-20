"use client";

import { useId, useMemo, useState } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { StatusChip } from "@/components/ui/status-chip";
import { type Nearby, formatDistance } from "@/components/geo/nearest";
import { GEO_MESSAGES, type GeoState } from "@/components/geo/use-geolocation";
import Link from "next/link";
import { lineNote, notices } from "./line-notes";
import { RAIL_LINES, lineById, lines, neighborsOf, stationBySlug, stations, stationsOfLine } from "./network";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TIPO: Record<string, string> = { metro: "Linha de metrô", monotrilho: "Monotrilho", trem: "Trem metropolitano" };

export function BackButton({ onClick, label = "Voltar" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 inline-flex size-5 items-center justify-center text-ink"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" className="size-2.5" aria-hidden>
        <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Busca por nome — também é a alternativa quando a localização falha. */
export function StationSearch({ onPick, autoFocus = false }: { onPick: (slug: string) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const id = useId();
  const results = useMemo(() => {
    const n = normalize(q.trim());
    if (n.length < 2) return [];
    return stations
      .filter((s) => normalize(s.nome).includes(n) || (s.complemento && normalize(s.complemento).includes(n)))
      .sort((a, b) => Number(!normalize(a.nome).startsWith(n)) - Number(!normalize(b.nome).startsWith(n)) || a.nome.localeCompare(b.nome, "pt-BR"))
      .slice(0, 8);
  }, [q]);
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Buscar estação pelo nome
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar estação"
        autoFocus={autoFocus}
        autoComplete="off"
        className="h-5 w-full border-b border-rule bg-transparent text-body text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
      />
      {results.length > 0 && (
        <ul className="mt-1" aria-label="Resultados da busca">
          {results.map((s) => (
            <li key={s.slug}>
              <button
                type="button"
                onClick={() => {
                  onPick(s.slug);
                  setQ("");
                }}
                className="flex w-full items-center justify-between gap-1 py-1 text-left text-body hover:underline"
              >
                <span className="font-semibold">{s.nome}</span>
                <span className="flex gap-0.5">
                  {s.linhas.map((l) => (
                    <LineBadge key={l} line={l} size="sm" />
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1 text-caption text-ink-muted">Nenhuma estação com esse nome.</p>
      )}
    </div>
  );
}

export function LinesGrid({
  showRail,
  onToggleRail,
  onPickLine,
}: {
  showRail: boolean;
  onToggleRail: () => void;
  onPickLine: (id: string) => void;
}) {
  const metro = lines.filter((l) => !RAIL_LINES.has(l.id));
  const rail = lines.filter((l) => RAIL_LINES.has(l.id));
  const grid = (ls: typeof lines) => (
    <ul className="grid grid-cols-6 gap-1 md:grid-cols-6">
      {ls.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => onPickLine(l.id)}
            className="block transition-transform duration-(--duration-fast) ease-standard hover:scale-110"
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
      <label className="flex cursor-pointer items-center justify-between gap-2 border-t border-rule pt-2 text-caption font-semibold">
        <span>Trens metropolitanos (7 a 13)</span>
        <input type="checkbox" checked={showRail} onChange={onToggleRail} className="size-2 accent-[var(--ink)]" />
      </label>
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
        <h2 className="text-lead font-bold leading-tight tracking-tight">{line.nome}</h2>
        <p className="text-caption text-ink-muted">
          {TIPO[line.tipo]} · operação {line.operador} · {line.extensaoOperacionalKm.toLocaleString("pt-BR")} km
        </p>
      </div>
      <div className="border-t border-rule pt-2">
        <p className="text-body font-bold">{note.titulo}</p>
        <p className="text-body text-ink-muted">{note.texto}</p>
        {note.fonte && (
          <a className="text-caption text-ink-muted underline" href={note.fonte.url}>
            Fonte: {note.fonte.nome}
          </a>
        )}
      </div>
      <Link href={`/linhas/${id}`} className="text-caption font-semibold underline underline-offset-4">
        Página da {line.nome} →
      </Link>
      {branches && (
        <p className="text-caption text-ink-muted">
          Linha em “Y”: ramal a partir de {stationBySlug.get(line.sequencias[1][0])?.nome}.
        </p>
      )}
      {/* Régua de estações: a linha vertical na cor da linha, um ponto por estação. */}
      <ol className="relative mt-1" aria-label={`Estações da ${line.nome}`}>
        <span aria-hidden className="absolute bottom-2 left-[9px] top-2 w-1" style={{ backgroundColor: line.cor }} />
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
                className="flex w-full items-center gap-2 py-0.5 pl-0 text-left hover:underline aria-[current=true]:font-bold"
              >
                <span
                  aria-hidden
                  className="relative z-10 ml-0.5 size-1.5 shrink-0 rounded-full border-2 border-surface bg-ink"
                  style={status === "em-obras" ? { background: "var(--surface)", borderColor: line.cor } : undefined}
                />
                <span className="flex-1 text-body">
                  {st.nome}
                  {status === "em-obras" && <span className="ml-1 text-caption text-ink-muted">em obras</span>}
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
          <h2 className="text-title-s font-bold leading-tight tracking-tight">{st.nome}</h2>
          {st.complemento && <p className="text-caption text-ink-muted">{st.complemento}</p>}
        </div>
      </div>
      <ul className="flex flex-wrap gap-1" aria-label="Linhas">
        {st.linhas.map((l) => (
          <li key={l}>
            <button type="button" onClick={() => onPickLine(l)} aria-label={`Ver ${lineById.get(l)?.nome}`}>
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
      <p className="text-caption text-ink-muted">
        {st.acessivel === "sim"
          ? "♿ Acessível, segundo o OpenStreetMap."
          : st.acessivel === "limitado"
            ? "♿ Acessibilidade parcial, segundo o OpenStreetMap."
            : "Acessibilidade: sem informação confirmada."}
      </p>
      <Link href={`/estacoes/${slug}`} className="text-caption font-semibold underline underline-offset-4">
        Página da estação {st.nome} →
      </Link>
      {walk && (
        <p className="text-body">
          <strong>{formatDistance(walk.distanciaM)}</strong> de você · cerca de {walk.minutos} min a pé
        </p>
      )}
      {st.integracoes.length > 0 && (
        <p className="text-body">
          Passagem para{" "}
          {st.integracoes.map((o) => (
            <button key={o} type="button" className="font-semibold underline underline-offset-2" onClick={() => onPickStation(o)}>
              {stationBySlug.get(o)?.nome}
            </button>
          ))}
        </p>
      )}
      <div className="border-t border-rule pt-2">
        <h3 className="text-caption font-semibold uppercase tracking-widest text-ink-muted">Estações vizinhas</h3>
        <ul className="mt-1 flex flex-col gap-1">
          {nbs.map((n, i) => (
            <li key={`${n.linha}-${i}`} className="flex items-center gap-1 text-body">
              <LineBadge line={n.linha} size="sm" />
              {[n.anterior, n.proxima].filter(Boolean).map((s, j) => (
                <span key={s} className="flex items-center gap-1">
                  {j > 0 && <span aria-hidden className="text-ink-muted">·</span>}
                  <button type="button" className="hover:underline" onClick={() => onPickStation(s!)}>
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
        <h2 className="text-lead font-bold tracking-tight">Perto de você</h2>
      </div>
      {geo.status === "locating" && <p className="text-body text-ink-muted">Procurando sua localização…</p>}
      {geo.status === "error" && (
        <>
          <p className="text-body">{GEO_MESSAGES[geo.reason]}</p>
          {geo.reason !== "unsupported" && (
            <button type="button" onClick={onRetry} className="self-start text-body font-semibold underline underline-offset-4">
              Tentar de novo
            </button>
          )}
          <StationSearch onPick={onPick} autoFocus />
        </>
      )}
      {geo.status === "ok" && (
        <>
          {nearby[0] && nearby[0].distanciaM > 15000 && (
            <p className="text-caption text-ink-muted">Você parece estar fora da região metropolitana.</p>
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
                    className="flex w-full items-center gap-2 py-1.5 text-left aria-[current=true]:font-bold"
                  >
                    <span className="w-2 text-caption tabular-nums text-ink-muted">{i + 1}</span>
                    <span className="flex-1">
                      <span className="block text-body font-semibold">{st.nome}</span>
                      <span className="block text-caption text-ink-muted">
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
          <p className="text-caption text-ink-muted">
            Distância em linha reta; o tempo a pé é estimado. Sua localização fica só neste navegador.
          </p>
        </>
      )}
    </div>
  );
}

/** Situação das linhas fora do normal (botão "!"). */
export function AlertsView({ onBack, onPickLine }: { onBack: () => void; onPickLine: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <BackButton onClick={onBack} />
        <h2 className="text-lead font-bold tracking-tight">Avisos</h2>
      </div>
      <ul className="flex flex-col">
        {notices().map((n) => (
          <li key={n.id} className="flex gap-2 border-b border-rule py-2 last:border-0">
            <button type="button" onClick={() => onPickLine(n.id)} aria-label={`Ver ${lineById.get(n.id)?.nome}`}>
              <LineBadge line={n.id} />
            </button>
            <div>
              <p className="text-body font-bold">{n.titulo}</p>
              <p className="text-body text-ink-muted">{n.texto}</p>
              {n.fonte && (
                <a className="text-caption text-ink-muted underline" href={n.fonte.url}>
                  Fonte: {n.fonte.nome}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-caption text-ink-muted">
        Projeto conceitual: sem dados em tempo real. Situação conhecida em 20/10/2026 — confirme em{" "}
        <a className="underline" href="https://www.metro.sp.gov.br">
          metro.sp.gov.br
        </a>
        .
      </p>
    </div>
  );
}
