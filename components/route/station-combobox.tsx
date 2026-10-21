"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { LineBadge } from "@/components/ui/line-badge";
import { IconButton, Icons } from "@/components/ui/button";
import { stations } from "@/components/map/network";
import { normalize } from "@/lib/voice/parse-route";

/** Busca por nome sem acento, nome começando com o texto primeiro. Também procura no complemento. */
export function searchStations(q: string, limit = 8) {
  const n = normalize(q);
  if (n.length < 2) return [];
  return stations
    .filter((s) => normalize(s.nome).includes(n) || (s.complemento && normalize(s.complemento).includes(n)))
    .sort((a, b) => Number(!normalize(a.nome).startsWith(n)) - Number(!normalize(b.nome).startsWith(n)) || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limit);
}

/**
 * Campo de busca de estação no padrão combobox (WAI-ARIA): setas escolhem, Enter confirma,
 * Esc limpa. A quantidade de resultados é anunciada para leitores de tela.
 */
export function StationCombobox({
  label,
  hideLabel = false,
  placeholder = "Nome da estação",
  onPick,
  autoFocus = false,
  trailing,
}: {
  label: string;
  hideLabel?: boolean;
  placeholder?: string;
  onPick: (slug: string) => void;
  autoFocus?: boolean;
  trailing?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const results = useMemo(() => searchStations(q), [q]);
  const open = results.length > 0;
  const typed = normalize(q).length >= 2;

  const pick = (slug: string) => {
    onPick(slug);
    setQ("");
    setActive(0);
  };

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-xs font-semibold uppercase text-ink-muted"}>
        {label}
      </label>
      <div className="flex items-center gap-0.5 border-b border-rule focus-within:border-ink">
        <span aria-hidden className="text-ink-muted">
          {Icons.search}
        </span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-op-${active}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && open) {
              e.preventDefault();
              setActive((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp" && open) {
              e.preventDefault();
              setActive((i) => (i - 1 + results.length) % results.length);
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              pick(results[active].slug);
            } else if (e.key === "Escape" && q) {
              e.preventDefault();
              setQ("");
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          className="h-control min-w-0 flex-1 bg-transparent px-0.5 text-base text-ink placeholder:text-ink-muted focus:outline-none"
        />
        {q && (
          <IconButton variant="plain" label={`Limpar ${label.toLowerCase()}`} onClick={() => setQ("")}>
            {Icons.close}
          </IconButton>
        )}
        {trailing}
      </div>
      <ul id={`${id}-lista`} role="listbox" aria-label={`Estações para ${label.toLowerCase()}`} className={open ? "mt-0.5" : "hidden"}>
        {results.map((s, i) => (
          <li
            key={s.slug}
            id={`${id}-op-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(s.slug)}
            onMouseEnter={() => setActive(i)}
            className="flex min-h-control cursor-pointer items-center justify-between gap-1 px-0.5 text-left text-base aria-selected:bg-ink/5"
            style={{ borderRadius: 8 }}
          >
            <span>
              <span className="font-semibold">{s.nome}</span>
              {s.complemento && <span className="ml-0.5 text-xs text-ink-muted">{s.complemento}</span>}
            </span>
            <span className="flex gap-0.5">
              {s.linhas.map((l) => (
                <LineBadge key={l} line={l} size="sm" />
              ))}
            </span>
          </li>
        ))}
      </ul>
      {typed && !open && <p className="mt-1 text-sm text-ink-muted">Nenhuma estação com esse nome.</p>}
      <p className="sr-only" role="status">
        {typed ? (open ? `${results.length} estações encontradas. Use as setas para escolher.` : "Nenhuma estação encontrada.") : ""}
      </p>
    </div>
  );
}
