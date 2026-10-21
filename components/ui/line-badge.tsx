import { getLine } from "./lines";

const SIZES = {
  sm: "size-2.5",
  md: "size-4",
  lg: "size-7",
  xl: "size-9",
} as const;

type Props = {
  line: string;
  size?: keyof typeof SIZES;
};

/**
 * Ícone da linha: círculo na cor da linha com o número sempre branco e centralizado.
 * É uma imagem (SVG) com o nome da linha como texto alternativo — o número branco nas cores claras
 * não chega a 4,5:1, então o ícone nunca é a única forma de identificar a linha.
 */
export function LineBadge({ line, size = "md" }: Props) {
  const { nome, cor, tinta, id } = getLine(line);
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={nome} className={`inline-block shrink-0 ${SIZES[size]}`}>
      <title>{nome}</title>
      <circle cx="16" cy="16" r="16" fill={cor} />
      <circle cx="16" cy="16" r="15.5" fill="none" stroke="var(--badge-edge)" />
      <text
        x="16"
        y="16"
        dy="0.36em"
        textAnchor="middle"
        fill={tinta}
        fontWeight="700"
        fontSize={id.length > 1 ? 14 : 17}
        style={{ fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}
      >
        {id}
      </text>
    </svg>
  );
}
