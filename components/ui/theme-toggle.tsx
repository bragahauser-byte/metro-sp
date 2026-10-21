"use client";

import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { type Prefs, DEFAULT_PREFS, applyPrefs, getPrefs, setPrefs, subscribePrefs } from "@/lib/prefs";
import Link from "next/link";
import { IconButton, Icons } from "./button";
import { Switch } from "./switch";

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
}

function Choice<K extends keyof Prefs>({
  name,
  legend,
  value,
  options,
  hint,
}: {
  name: K;
  legend: string;
  value: Prefs[K];
  options: { value: Prefs[K]; label: string }[];
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-1" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <label
            key={String(o.value)}
            className="inline-flex h-control cursor-pointer items-center gap-1 border border-rule px-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--focus)"
            style={{ borderRadius: "var(--radius-control)" }}
          >
            <input
              type="radio"
              name={`${id}-${name}`}
              className="sr-only"
              checked={value === o.value}
              onChange={() => setPrefs({ [name]: o.value } as Partial<Prefs>)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </fieldset>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Switch checked={checked} onChange={onChange} hint={hint}>
      {label}
    </Switch>
  );
}

/**
 * Botão de preferências (tema Claro / Escuro / Sistema, movimento, contraste, texto, voz e sons).
 * Abre um <dialog> modal: o foco fica preso nele, Esc fecha e o foco volta para o botão.
 */
export function ThemeToggle({ onAbout }: { onAbout?: () => void } = {}) {
  const prefs = usePrefs();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Reaplica a escolha salva: no modo dev o React limpa os atributos ao remontar o <html>.
  useLayoutEffect(() => applyPrefs(getPrefs()), []);

  return (
    <>
      <IconButton variant="plain" label="Ajustes: tema, acessibilidade, sobre e fontes" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {Icons.settings}
      </IconButton>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(100%-32px,480px)] bg-surface p-0 text-ink backdrop:bg-black/40"
        style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
        onClick={(e) => {
          // Clique fora da caixa (no fundo) fecha.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-rule py-1 pl-3 pr-1">
            <h2 id={titleId} className="text-lg font-bold">
              Ajustes
            </h2>
            <IconButton variant="plain" label="Fechar ajustes" onClick={() => dialog.current?.close()}>
              {Icons.close}
            </IconButton>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto p-3">
            <Choice
              name="tema"
              legend="Tema"
              value={prefs.tema}
              options={[
                { value: "claro", label: "Claro" },
                { value: "escuro", label: "Escuro" },
                { value: "sistema", label: "Sistema" },
              ]}
              hint="“Sistema” segue a configuração do aparelho. O tema nunca muda sozinho pelo horário."
            />
            <Choice
              name="texto"
              legend="Tamanho do texto"
              value={prefs.texto}
              options={[
                { value: "padrao", label: "Padrão" },
                { value: "maior", label: "Maior" },
              ]}
            />
            <Choice
              name="contraste"
              legend="Contraste"
              value={prefs.contraste}
              options={[
                { value: "padrao", label: "Padrão" },
                { value: "mais", label: "Mais contraste" },
              ]}
            />
            <Choice
              name="movimento"
              legend="Animações"
              value={prefs.movimento}
              options={[
                { value: "sistema", label: "Como no sistema" },
                { value: "reduzido", label: "Reduzir movimento" },
              ]}
            />
            <Toggle
              label="Ouvir a rota em voz alta"
              checked={prefs.voz}
              onChange={(voz) => setPrefs({ voz })}
              hint="Mostra os controles de leitura no resultado da rota. Usa a voz do próprio navegador."
            />
            {prefs.voz && (
              <Choice
                name="detalheVoz"
                legend="Detalhe da leitura"
                value={prefs.detalheVoz}
                options={[
                  { value: "resumido", label: "Resumido" },
                  { value: "completo", label: "Todas as estações" },
                ]}
              />
            )}
            <Toggle
              label="Sinal sonoro em avisos"
              checked={prefs.sons}
              onChange={(sons) => setPrefs({ sons })}
              hint="Um bipe curto quando a rota tiver restrição de horário ou operação."
            />
            <p className="text-xs text-ink-muted">Tudo fica salvo só neste navegador.</p>
            <section aria-labelledby={`${titleId}-sobre`} className="flex flex-col gap-1 border-t border-rule pt-3">
              <h3 id={`${titleId}-sobre`} className="text-sm font-semibold">
                Sobre este projeto
              </h3>
              <p className="text-sm text-ink-muted">
                Projeto conceitual independente, sem vínculo com a Companhia do Metropolitano de São Paulo nem com as
                concessionárias. Informações oficiais em{" "}
                <a className="underline" href="https://www.metro.sp.gov.br">
                  metro.sp.gov.br
                </a>
                .
              </p>
              <ul className="flex flex-col text-sm font-semibold">
                <li>
                  {onAbout ? (
                    <button
                      type="button"
                      className="inline-flex min-h-control items-center underline underline-offset-4"
                      onClick={() => {
                        dialog.current?.close();
                        onAbout();
                      }}
                    >
                      Sobre, fontes e créditos
                    </button>
                  ) : (
                    <Link className="inline-flex min-h-control items-center underline underline-offset-4" href="/?painel=sobre">
                      Sobre, fontes e créditos
                    </Link>
                  )}
                </li>
                <li>
                  <Link className="inline-flex min-h-control items-center underline underline-offset-4" href="/estilo">
                    Estilo (sistema visual)
                  </Link>
                </li>
                <li>
                  <a className="inline-flex min-h-control items-center underline underline-offset-4" href="https://github.com/bragahauser-byte/metro-sp/blob/main/data/sources.md">
                    Lista de fontes dos dados
                  </a>
                </li>
              </ul>
              <p className="text-xs text-ink-muted">
                Mapa: ©{" "}
                <a className="underline" href="https://www.openstreetmap.org/copyright">
                  OpenStreetMap contributors
                </a>{" "}
                ·{" "}
                <a className="underline" href="https://openfreemap.org">
                  OpenFreeMap
                </a>{" "}
                ·{" "}
                <a className="underline" href="https://www.openmaptiles.org">
                  © OpenMapTiles
                </a>
                . Busca de endereços:{" "}
                <a className="underline" href="https://photon.komoot.io">
                  Photon
                </a>{" "}
                (komoot), dados © OpenStreetMap.
              </p>
            </section>
          </div>
        </div>
      </dialog>
    </>
  );
}
