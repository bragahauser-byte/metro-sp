"use client";

import type { ReactNode } from "react";

/**
 * Interruptor no estilo iOS: trilho em pílula e botão circular. A linha inteira é o alvo de toque
 * (48 px de altura) e o nome acessível é o próprio texto. Desligado: trilho cinza-escuro; ligado:
 * verde. O botão usa a cor da superfície, então contrasta com o trilho nos dois temas (≥ 3:1).
 */
export function Switch({
  checked,
  onChange,
  children,
  hint,
  className = "",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`group flex min-h-control w-full items-center justify-between gap-2 text-left ${className}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{children}</span>
        {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className="relative inline-flex h-4 w-[52px] shrink-0 items-center rounded-full bg-ink-muted transition-colors duration-(--duration-base) ease-standard group-aria-checked:bg-fg-success"
      >
        <span className="absolute left-[3px] size-[26px] rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-(--duration-base) ease-standard group-aria-checked:translate-x-[20px]" />
      </span>
    </button>
  );
}
