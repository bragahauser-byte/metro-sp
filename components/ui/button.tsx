import type { ComponentProps } from "react";

const VARIANTS = {
  primary: "bg-ink text-bg hover:opacity-85",
  secondary: "bg-surface text-ink border border-rule-strong hover:bg-bg",
  ghost: "text-ink underline-offset-4 hover:underline",
} as const;

type Props = ComponentProps<"button"> & { variant?: keyof typeof VARIANTS };

export function Button({ variant = "primary", className = "", style, ...rest }: Props) {
  return (
    <button
      className={`inline-flex h-6 items-center justify-center gap-1 px-3 text-body font-semibold transition-[opacity,background-color] duration-(--duration-fast) ease-standard disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      style={{ borderRadius: "var(--radius-control)", ...style }}
      {...rest}
    />
  );
}

type IconButtonProps = ComponentProps<"button"> & { label: string };

/** Botão redondo flutuante do mapa (localização, zoom, acessibilidade). */
export function IconButton({ label, className = "", style, children, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex size-6 items-center justify-center bg-surface text-ink transition-transform duration-(--duration-fast) ease-standard hover:-translate-y-px active:scale-95 ${className}`}
      style={{
        borderRadius: "var(--radius-control)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--card-border)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
