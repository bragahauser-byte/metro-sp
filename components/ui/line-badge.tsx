import { getLine } from "./lines";

const SIZES = {
  sm: "size-2.5 text-caption",
  md: "size-4 text-body",
  lg: "size-7 text-title-s",
  xl: "size-9 text-title-l",
} as const;

type Props = {
  line: string;
  size?: keyof typeof SIZES;
};

/** Ícone da linha: círculo na cor da linha com o número sempre branco e centralizado. */
export function LineBadge({ line, size = "md" }: Props) {
  const { nome, cor, tinta, id } = getLine(line);
  return (
    <span
      role="img"
      aria-label={nome}
      title={nome}
      className={`inline-flex shrink-0 items-center justify-center font-bold tabular-nums leading-none ${SIZES[size]}`}
      style={{
        backgroundColor: cor,
        color: tinta,
        borderRadius: "var(--radius-badge)",
        boxShadow: "inset 0 0 0 1px var(--badge-edge)",
      }}
    >
      {id}
    </span>
  );
}
