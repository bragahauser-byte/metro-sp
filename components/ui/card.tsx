import type { ComponentProps } from "react";

/** Superfície flutuante: sombra na direção A, fio na direção B. */
export function Card({ className = "", style, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={`bg-surface ${className}`}
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--card-border)",
        ...style,
      }}
      {...rest}
    />
  );
}
