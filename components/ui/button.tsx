import type { ComponentProps } from "react";

// Botões. Toda área clicável tem no mínimo 48 × 48 px (token --spacing-control); o ícone de 24 px
// fica centralizado dentro dela. Estados: hover, foco visível (global), pressionado, desativado e
// carregando (aria-busy + indicador, sem mudar a largura).

const VARIANTS = {
  primary: "bg-ink text-bg hover:opacity-85 active:opacity-75",
  secondary: "bg-surface text-ink border border-rule-strong hover:bg-bg active:bg-rule",
  ghost: "text-ink underline-offset-4 hover:underline active:opacity-70",
} as const;

const SIZES = {
  md: "h-control px-3 text-base",
  lg: "h-control-lg px-4 text-base",
} as const;

type Props = ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
};

export function Spinner({ className = "size-icon-sm" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`motion-safe:animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({ variant = "primary", size = "md", loading = false, className = "", style, children, disabled, ...rest }: Props) {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`inline-flex min-w-control items-center justify-center gap-1 font-semibold transition-[opacity,background-color] duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-40 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      style={{ borderRadius: "var(--radius-control)", ...style }}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type IconButtonProps = ComponentProps<"button"> & {
  label: string;
  /** "floating": círculo com sombra (sobre o mapa). "plain": só o ícone, mesma área de toque. */
  variant?: "floating" | "plain";
};

/** Botão só com ícone: 48 × 48 px de área, ícone de 24 px, nome acessível obrigatório. */
export function IconButton({ label, variant = "floating", className = "", style, children, ...rest }: IconButtonProps) {
  const floating = variant === "floating";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-control shrink-0 items-center justify-center text-ink transition-[transform,background-color] duration-(--duration-fast) ease-standard active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        floating ? "bg-surface hover:-translate-y-px" : "hover:bg-ink/5"
      } ${className}`}
      style={{
        borderRadius: "var(--radius-control)",
        ...(floating ? { boxShadow: "var(--shadow-card)", border: "1px solid var(--card-border)" } : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Ícones de 24 px usados nos controles. */
export const Icons = {
  close: (
    <svg viewBox="0 0 24 24" className="size-icon-sm" aria-hidden>
      <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" className="size-icon" aria-hidden>
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" className="size-icon" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  swap: (
    <svg viewBox="0 0 24 24" className="size-icon" aria-hidden>
      <path d="M8 4v15M8 4L4 8M8 4l4 4M16 20V5M16 20l-4-4M16 20l4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mic: (
    <svg viewBox="0 0 24 24" className="size-icon" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  walk: (
    <svg viewBox="0 0 24 24" className="size-icon-sm" aria-hidden>
      <circle cx="13" cy="4" r="2" fill="currentColor" />
      <path d="M10 21l2-6 3 3v3M12 15l-1-5 4 1 2 3M11 10l-3 2-1 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" className="size-icon-sm" aria-hidden>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="10" r="2.3" fill="currentColor" />
    </svg>
  ),
  street: (
    <svg viewBox="0 0 24 24" className="size-icon-sm" aria-hidden>
      <path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  gps: (
    <svg viewBox="0 0 24 24" className="size-icon-sm" aria-hidden>
      <path d="M21 3L3 10.5l7.5 3 3 7.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  train: (
    <svg viewBox="0 0 24 24" className="size-icon-sm" aria-hidden>
      <rect x="5" y="3" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11h14M8 21l2-4M16 21l-2-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="size-icon" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="17" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
};
