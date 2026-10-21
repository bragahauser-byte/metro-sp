"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { IconButton, Icons, Spinner } from "@/components/ui/button";
import { LineBadge } from "@/components/ui/line-badge";
import { stationBySlug } from "@/components/map/network";
import { NEARBY, type NearbyKind, type Place } from "@/lib/geo/photon";
import type { LngLat } from "@/lib/geo/walk";
import { nearby } from "./geocoder";
import { type Option, PlaceResults, type Spot, optionsOf, spotName, usePlaceSearch } from "./place-search";
import { clearRecents, readRecents } from "./recents";

const toSpot = (o: Option): Spot | null =>
  o.type === "station"
    ? { kind: "station", slug: o.slug }
    : o.type === "place"
      ? { kind: "place", nome: o.place.nome, detalhe: o.place.detalhe, tipo: o.place.tipo, lngLat: o.place.lngLat }
      : null;

/** Grupo com fundo próprio e divisórias, como as listas do Apple Maps. */
function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col bg-ink/5 px-1.5" style={{ borderRadius: "var(--radius-card)" }}>
      {children}
    </ul>
  );
}

function Row({ icon, title, detail, onClick, trailing }: { icon: ReactNode; title: string; detail?: string; onClick: () => void; trailing?: ReactNode }) {
  return (
    <li className="border-b border-rule last:border-0">
      <button type="button" onClick={onClick} className="flex min-h-control-lg w-full items-center gap-1.5 py-1 text-left">
        <span aria-hidden className="flex size-3 shrink-0 items-center justify-center text-lg text-ink-muted">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-base">
          <span className="font-semibold">{title}</span>
          {detail && <span className="text-ink-muted"> · {detail}</span>}
        </span>
        {trailing}
      </button>
    </li>
  );
}

type NearbyState = { kind: NearbyKind; status: "loading" } | { kind: NearbyKind; status: "ok"; places: Place[] } | { kind: NearbyKind; status: "error" };

/**
 * Busca (botão de lupa): campo + fechar; vazio, mostra Recentes e Buscar por perto; digitando,
 * estações e lugares. Escolher algo leva à rota com esse destino.
 */
export function FindView({ near, onPick, onClose }: { near: LngLat | null; onPick: (s: Spot) => void; onClose: () => void }) {
  const id = useId();
  const listId = `${id}-lista`;
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<Spot[]>(() => (typeof window === "undefined" ? [] : readRecents()));
  const [cat, setCat] = useState<NearbyState | null>(null);
  const state = usePlaceSearch(q, near, true);
  const typed = q.trim().length > 0;
  const options = typed ? optionsOf(state, false) : [];

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  // Chave em texto (~1 km): o ponto muda a cada render, a busca não deve recomeçar por isso.
  const nearKey = near ? `${near[0].toFixed(2)},${near[1].toFixed(2)}` : "";
  const loadingKind = cat?.status === "loading" ? cat.kind : null;
  useEffect(() => {
    if (!loadingKind || !nearKey) return;
    const ctl = new AbortController();
    const point = nearKey.split(",").map(Number) as LngLat;
    // Tempo-limite: o Photon público às vezes demora; melhor dizer que falhou do que girar para sempre.
    nearby(loadingKind, point, AbortSignal.any([ctl.signal, AbortSignal.timeout(10_000)])).then(
      (places) => setCat({ kind: loadingKind, status: "ok", places }),
      () => !ctl.signal.aborted && setCat({ kind: loadingKind, status: "error" }),
    );
    return () => ctl.abort();
  }, [loadingKind, nearKey]);

  const pick = (o: Option) => {
    const s = toSpot(o);
    if (s) onPick(s);
  };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter" && options[active]) {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === "Escape" && (q || cat)) {
      // Primeiro limpa; o próximo Esc fecha a busca.
      e.preventDefault();
      e.stopPropagation();
      setQ("");
      setCat(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <h2 className="sr-only">Buscar</h2>
        <div className="flex h-control min-w-0 flex-1 items-center gap-1 bg-ink/5 px-1.5 focus-within:outline-2 focus-within:outline-(--focus)" style={{ borderRadius: 999 }}>
          <span aria-hidden className="text-ink-muted">
            {Icons.search}
          </span>
          <label htmlFor={`${id}-q`} className="sr-only">
            Buscar estação, endereço ou lugar
          </label>
          <input
            ref={input}
            id={`${id}-q`}
            type="search"
            role="combobox"
            aria-expanded={typed && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={typed && options[active] ? `${listId}-${active}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              setCat(null);
            }}
            onKeyDown={onKeyDown}
            placeholder="Estação, endereço ou lugar"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="field-bare h-full w-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <IconButton variant="plain" label="Fechar busca" onClick={onClose} className="rounded-full bg-ink/5" style={{ borderRadius: 999 }}>
          {Icons.close}
        </IconButton>
      </div>

      {typed ? (
        <PlaceResults listId={listId} label="Resultados" state={state} options={options} active={active} onPick={pick} onHover={setActive} />
      ) : cat ? (
        <section aria-labelledby={`${id}-cat`} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h3 id={`${id}-cat`} className="text-xl font-bold">
              {NEARBY[cat.kind].nome}
            </h3>
            <button type="button" onClick={() => setCat(null)} className="min-h-control text-sm font-semibold text-fg-link">
              Voltar
            </button>
          </div>
          <p className="text-xs text-ink-muted">Perto do centro do mapa, num raio de 2 km. Arraste o mapa para buscar em outro lugar.</p>
          {cat.status === "loading" && (
            <p className="flex items-center gap-1 text-sm text-ink-muted">
              <Spinner /> Buscando…
            </p>
          )}
          {cat.status === "error" && <p className="text-sm text-fg-warning">A busca de lugares está indisponível agora. As estações continuam funcionando.</p>}
          {cat.status === "ok" &&
            (cat.places.length === 0 ? (
              <p className="text-sm text-ink-muted">Nada encontrado aqui no OpenStreetMap.</p>
            ) : (
              <Group label={NEARBY[cat.kind].nome}>
                {cat.places.map((p) => (
                  <Row key={p.id} icon={NEARBY[cat.kind].icone} title={p.nome} detail={p.detalhe} onClick={() => pick({ type: "place", place: p })} />
                ))}
              </Group>
            ))}
          {cat.status === "ok" && cat.places.length > 0 && (
            <p className="text-xs text-ink-muted">
              <a className="underline" href="https://photon.komoot.io">
                Photon
              </a>{" "}
              ·{" "}
              <a className="underline" href="https://www.openstreetmap.org/copyright">
                © OpenStreetMap contributors
              </a>
            </p>
          )}
        </section>
      ) : (
        <>
          {recents.length > 0 && (
            <section aria-labelledby={`${id}-rec`} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <h3 id={`${id}-rec`} className="text-xl font-bold">
                  Recentes
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    clearRecents();
                    setRecents([]);
                  }}
                  className="min-h-control text-sm font-semibold text-fg-link"
                >
                  Limpar
                </button>
              </div>
              <Group label="Buscas recentes">
                {recents.map((s) => {
                  const st = s.kind === "station" ? stationBySlug.get(s.slug) : null;
                  return (
                    <Row
                      key={s.kind === "station" ? s.slug : `${s.lngLat.join(",")}${s.nome}`}
                      icon={Icons.search}
                      title={s.kind === "station" ? `Estação ${spotName(s)}` : spotName(s)}
                      detail={s.kind === "place" ? s.detalhe.split(",").slice(-2).join(",").trim() || undefined : undefined}
                      onClick={() => onPick(s)}
                      trailing={
                        st ? (
                          <span className="flex shrink-0 gap-0.5">
                            {st.linhas.map((l) => (
                              <LineBadge key={l} line={l} size="sm" />
                            ))}
                          </span>
                        ) : undefined
                      }
                    />
                  );
                })}
              </Group>
            </section>
          )}
          <section aria-labelledby={`${id}-perto`} className="flex flex-col gap-1">
            <h3 id={`${id}-perto`} className="text-xl font-bold">
              Buscar por perto
            </h3>
            {near ? (
              <Group label="Categorias">
                {(Object.keys(NEARBY) as NearbyKind[]).map((k) => (
                  <Row key={k} icon={NEARBY[k].icone} title={NEARBY[k].nome} onClick={() => setCat({ kind: k, status: "loading" })} />
                ))}
              </Group>
            ) : (
              <p className="text-sm text-ink-muted">Mova o mapa para a Grande São Paulo, no modo Real, para buscar lugares por perto.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
