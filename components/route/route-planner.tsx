"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { lineById, stationBySlug, stations } from "@/components/map/network";
import { nearestStations } from "@/components/geo/nearest";
import { GEO_MESSAGES, useGeolocation } from "@/components/geo/use-geolocation";
import { type Route, planRoute } from "./plan";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Campo de estação: mostra a escolhida ou uma busca por nome. */
function StationPicker({
  label,
  value,
  onChange,
  extra,
}: {
  label: string;
  value: string | null;
  onChange: (slug: string | null) => void;
  extra?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const id = useId();
  const results = useMemo(() => {
    const n = normalize(q.trim());
    if (n.length < 2) return [];
    return stations
      .filter((s) => normalize(s.nome).includes(n))
      .sort((a, b) => Number(!normalize(a.nome).startsWith(n)) - Number(!normalize(b.nome).startsWith(n)) || a.nome.localeCompare(b.nome, "pt-BR"))
      .slice(0, 6);
  }, [q]);
  const st = value ? stationBySlug.get(value) : null;
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-caption font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </label>
      {st ? (
        <div className="flex h-5 items-center justify-between gap-1 border-b border-ink">
          <span className="flex items-center gap-1 truncate text-body font-bold">
            {st.nome}
            <span className="flex gap-0.5">
              {st.linhas.map((l) => (
                <LineBadge key={l} line={l} size="sm" />
              ))}
            </span>
          </span>
          <button id={id} type="button" onClick={() => onChange(null)} className="text-caption underline" aria-label={`Trocar ${label.toLowerCase()}`}>
            trocar
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome da estação"
            autoComplete="off"
            className="h-5 border-b border-rule bg-transparent text-body text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
          />
          {results.length > 0 && (
            <ul aria-label={`Estações para ${label.toLowerCase()}`}>
              {results.map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(s.slug);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between gap-1 py-0.5 text-left text-body hover:underline"
                  >
                    <span>{s.nome}</span>
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
          {extra}
        </>
      )}
    </div>
  );
}

export function RouteResult({ route }: { route: Route }) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="text-title-s font-bold tracking-tight">
        ~{route.minutos} min
        <span className="ml-1 text-body font-normal text-ink-muted">
          · {route.baldeacoes === 0 ? "sem baldeação" : `${route.baldeacoes} baldeaç${route.baldeacoes > 1 ? "ões" : "ão"}`}
        </span>
      </p>
      <ol className="flex flex-col">
        {route.legs.map((leg, i) => {
          const line = lineById.get(leg.linha)!;
          const first = stationBySlug.get(leg.estacoes[0])!;
          const last = stationBySlug.get(leg.estacoes[leg.estacoes.length - 1])!;
          return (
            <li key={i} className="relative flex gap-2 pb-2">
              <span aria-hidden className="absolute bottom-0 left-[15px] top-4 w-1" style={{ backgroundColor: line.cor }} />
              <LineBadge line={leg.linha} />
              <div className="flex-1">
                <p className="text-body">
                  {i === 0 ? "Embarque em" : "Baldeação em"} <strong>{first.nome}</strong>
                </p>
                <p className="text-caption text-ink-muted">
                  {line.nome}
                  {leg.sentido ? `, sentido ${leg.sentido}` : ""} · {leg.estacoes.length - 1} estaç
                  {leg.estacoes.length - 1 > 1 ? "ões" : "ão"} · ~{leg.minutos} min
                </p>
                <details className="text-caption">
                  <summary className="cursor-pointer text-ink-muted underline">ver estações</summary>
                  <ol className="mt-0.5 flex flex-col">
                    {leg.estacoes.map((s) => (
                      <li key={s}>{stationBySlug.get(s)?.nome}</li>
                    ))}
                  </ol>
                </details>
                {i === route.legs.length - 1 && (
                  <p className="mt-1 text-body">
                    Desembarque em <strong>{last.nome}</strong>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {route.avisos.map((a) => (
        <p key={a} className="border-l-4 border-line-4 pl-1 text-caption">
          {a}
        </p>
      ))}
      <p className="text-caption text-ink-muted">
        Tempo estimado pelo traçado (velocidade média e 30 s por parada; baldeação conta 5 min). Não considera horários nem
        lotação.
      </p>
    </div>
  );
}

/**
 * Planejador completo: origem, destino, inverter, "perto de mim" como origem e o resultado.
 * `onRoute` avisa o mapa para destacar o caminho.
 */
export function RoutePlanner({
  initialFrom = null,
  initialTo = null,
  onRoute,
  showMapLink = true,
}: {
  initialFrom?: string | null;
  initialTo?: string | null;
  onRoute?: (route: Route | null, from: string | null, to: string | null) => void;
  showMapLink?: boolean;
}) {
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  const route = useMemo(() => (from && to ? planRoute(from, to) : null), [from, to]);
  const { state: geo, request } = useGeolocation((lngLat) => {
    const first = nearestStations(lngLat, 1)[0];
    if (first) update(first.slug, to);
  });

  function update(f: string | null, t: string | null) {
    setFrom(f);
    setTo(t);
    onRoute?.(f && t ? planRoute(f, t) : null, f, t);
  }

  return (
    <div className="flex flex-col gap-2">
      <StationPicker
        label="De"
        value={from}
        onChange={(s) => update(s, to)}
        extra={
          <button type="button" onClick={request} className="self-start text-caption font-semibold underline">
            {geo.status === "locating" ? "Procurando…" : "Usar a estação mais perto de mim"}
          </button>
        }
      />
      {geo.status === "error" && <p className="text-caption text-ink-muted">{GEO_MESSAGES[geo.reason]}</p>}
      <button
        type="button"
        onClick={() => update(to, from)}
        className="self-end text-caption font-semibold underline"
        aria-label="Inverter origem e destino"
      >
        ⇅ inverter
      </button>
      <StationPicker label="Para" value={to} onChange={(s) => update(from, s)} />
      {from && to && !route && <p className="text-body">Não há caminho em operação entre essas estações.</p>}
      {route && <RouteResult route={route} />}
      {route && showMapLink && (
        <Link
          href={`/mapa?de=${from}&para=${to}`}
          className="self-start bg-ink px-3 py-1.5 text-body font-bold text-bg"
          style={{ borderRadius: 999 }}
        >
          Ver no mapa
        </Link>
      )}
    </div>
  );
}
