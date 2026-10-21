"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { IconButton, Icons, Spinner } from "@/components/ui/button";
import { stationBySlug } from "@/components/map/network";
import { searchStations } from "@/components/route/station-combobox";
import type { LngLat } from "@/lib/geo/walk";
import type { Place, PlaceKind } from "@/lib/geo/photon";
import { MIN_GEOCODE_CHARS, type SearchResult, searchEverywhere } from "@/lib/geo/search";
import { geocode } from "./geocoder";

/** Uma ponta da viagem: estação da rede ou qualquer lugar (endereço, rua, CEP, loja…). */
export type Spot =
  | { kind: "station"; slug: string }
  | { kind: "place"; nome: string; detalhe: string; tipo: PlaceKind | "gps"; lngLat: LngLat };

export const spotName = (s: Spot | null) =>
  !s ? "" : s.kind === "station" ? `${stationBySlug.get(s.slug)?.nome ?? s.slug}` : s.nome;

/** Para o endereço da página: estação = slug; lugar = @lng,lat,nome. A localização do GPS nunca vai. */
export function encodeSpot(s: Spot | null): string | null {
  if (!s) return null;
  if (s.kind === "station") return s.slug;
  if (s.tipo === "gps") return null;
  return `@${s.lngLat[0].toFixed(5)},${s.lngLat[1].toFixed(5)},${s.nome}`;
}
export function decodeSpot(v: string | null): Spot | null {
  if (!v) return null;
  if (stationBySlug.has(v)) return { kind: "station", slug: v };
  const m = v.match(/^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(.{1,120})$/);
  if (!m) return null;
  const lngLat: LngLat = [Number(m[1]), Number(m[2])];
  if (lngLat[0] < -47.3 || lngLat[0] > -45.6 || lngLat[1] < -24.2 || lngLat[1] > -23) return null;
  return { kind: "place", nome: m[3], detalhe: "", tipo: "lugar", lngLat };
}

const KIND_LABEL: Record<PlaceKind | "gps", string> = {
  endereco: "Endereço",
  rua: "Rua",
  cep: "CEP",
  bairro: "Bairro",
  cidade: "Cidade",
  lugar: "Lugar",
  gps: "Localização",
};

export type Option =
  | { type: "gps" }
  | { type: "station"; slug: string }
  | { type: "place"; place: Place };

export type SearchState = SearchResult & { loading: boolean; q: string };

/** Estações na hora; lugares depois de 300 ms sem digitar, cancelando a busca anterior. */
export function usePlaceSearch(q: string, near: LngLat | null, enabled: boolean): SearchState {
  const estacoes = useMemo(() => searchStations(q, 6), [q]);
  const [remote, setRemote] = useState<{ q: string; lugares: Place[]; erro: SearchResult["erro"] }>({ q: "", lugares: [], erro: null });
  const wantsGeo = enabled && q.trim().length >= MIN_GEOCODE_CHARS;
  const nearKey = near ? `${near[0].toFixed(2)},${near[1].toFixed(2)}` : "";

  useEffect(() => {
    if (!wantsGeo) return;
    const ctl = new AbortController();
    const id = setTimeout(() => {
      const bias: LngLat | null = nearKey ? (nearKey.split(",").map(Number) as LngLat) : null;
      searchEverywhere(q, { stations: () => [], geocode, near: bias, signal: ctl.signal }).then(
        (r) => setRemote({ q, lugares: r.lugares, erro: r.erro }),
        () => {},
      );
    }, 300);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, wantsGeo, nearKey]);

  const fresh = remote.q === q;
  return {
    q,
    estacoes: fresh && remote.lugares.length ? estacoes.slice(0, 4) : estacoes,
    lugares: wantsGeo && fresh ? remote.lugares : [],
    erro: wantsGeo && fresh ? remote.erro : null,
    loading: wantsGeo && !fresh,
  };
}

export function optionsOf(s: SearchState, withGps: boolean): Option[] {
  return [
    ...(withGps ? [{ type: "gps" } as const] : []),
    ...s.estacoes.map((e) => ({ type: "station", slug: e.slug }) as const),
    ...s.lugares.map((p) => ({ type: "place", place: p }) as const),
  ];
}

/** Campo de uma ponta (origem ou destino), no padrão combobox. A lista fica fora, abaixo do bloco. */
export function PlaceField({
  id,
  label,
  placeholder,
  text,
  onText,
  onClear,
  onFocus,
  onKeyDown,
  expanded,
  listId,
  activeId,
  marker,
  inputRef,
  trailing,
  autoFocus = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  text: string;
  onText: (t: string) => void;
  onClear: () => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  expanded: boolean;
  listId: string;
  activeId?: string;
  marker: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  trailing?: ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex min-h-control min-w-0 items-center gap-1">
      <span aria-hidden className="flex w-3 shrink-0 justify-center">
        {marker}
      </span>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? activeId : undefined}
        value={text}
        placeholder={placeholder}
        onChange={(e) => onText(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        className="h-control w-full min-w-0 flex-1 truncate bg-transparent text-base text-ink placeholder:text-ink-muted focus:outline-none"
      />
      {text && (
        <IconButton variant="plain" label={`Limpar ${label.toLowerCase()}`} onClick={onClear} className="-mr-1">
          {Icons.close}
        </IconButton>
      )}
      {trailing}
    </div>
  );
}

function OptionIcon({ o }: { o: Option }) {
  const cls = "flex size-4 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink";
  if (o.type === "gps") return <span className={`${cls} !text-fg-link`}>{Icons.gps}</span>;
  if (o.type === "station") return <span className={cls}>{Icons.train}</span>;
  const t = o.place.tipo;
  return <span className={cls}>{t === "rua" || t === "endereco" || t === "cep" ? Icons.street : Icons.pin}</span>;
}

/** Lista de resultados mistos (estações + lugares), com tipo, nome e endereço. */
export function PlaceResults({
  listId,
  label,
  state,
  options,
  active,
  onPick,
  onHover,
  gpsLabel,
}: {
  listId: string;
  label: string;
  state: SearchState;
  options: Option[];
  active: number;
  onPick: (o: Option) => void;
  onHover: (i: number) => void;
  gpsLabel?: string;
}) {
  const typed = state.q.trim().length >= 2;
  const count = options.filter((o) => o.type !== "gps").length;
  return (
    <div className="flex flex-col gap-1">
      <ul id={listId} role="listbox" aria-label={label} className="flex flex-col">
        {options.map((o, i) => {
          const st = o.type === "station" ? stationBySlug.get(o.slug) : null;
          const name = o.type === "gps" ? (gpsLabel ?? "Usar minha localização") : st ? st.nome : o.type === "place" ? o.place.nome : "";
          const kind = o.type === "gps" ? "Sugestão" : o.type === "station" ? "Estação" : KIND_LABEL[o.place.tipo];
          const detail = o.type === "station" ? (st?.complemento ?? "") : o.type === "place" ? o.place.detalhe : "Localização deste aparelho, usada só aqui";
          return (
            <li
              key={o.type === "gps" ? "gps" : o.type === "station" ? `s-${o.slug}` : `p-${o.place.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              aria-label={`${kind}: ${name}${detail ? `, ${detail}` : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(o)}
              onMouseEnter={() => onHover(i)}
              className="flex min-h-control cursor-pointer items-center gap-1.5 px-1 py-1 aria-selected:bg-ink/5"
              style={{ borderRadius: 8 }}
            >
              <OptionIcon o={o} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold">{name}</span>
                <span className="truncate text-xs text-ink-muted">
                  {kind}
                  {detail ? ` · ${detail}` : ""}
                </span>
              </span>
              {st && (
                <span className="flex shrink-0 gap-0.5">
                  {st.linhas.map((l) => (
                    <LineBadge key={l} line={l} size="sm" />
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {state.loading && (
        <p className="flex items-center gap-1 px-1 text-sm text-ink-muted">
          <Spinner /> Buscando endereços e lugares…
        </p>
      )}
      {state.erro && (
        <p className="px-1 text-sm text-fg-warning">
          {state.erro === "tempo" ? "A busca de endereços demorou demais." : "A busca de endereços está indisponível agora."} As estações
          continuam funcionando.
        </p>
      )}
      {typed && !state.loading && !state.erro && count === 0 && (
        <p className="px-1 text-sm text-ink-muted">
          {state.q.trim().length < MIN_GEOCODE_CHARS
            ? "Continue digitando para buscar endereços."
            : `Nada encontrado para “${state.q.trim()}” na Grande São Paulo.`}
        </p>
      )}
      {state.lugares.length > 0 && (
        <p className="px-1 text-xs text-ink-muted">
          Endereços:{" "}
          <a className="underline" href="https://photon.komoot.io">
            Photon
          </a>{" "}
          ·{" "}
          <a className="underline" href="https://www.openstreetmap.org/copyright">
            © OpenStreetMap contributors
          </a>
        </p>
      )}
      <p className="sr-only" role="status">
        {state.loading ? "" : typed ? `${count} resultados. Use as setas para escolher.` : ""}
      </p>
    </div>
  );
}
