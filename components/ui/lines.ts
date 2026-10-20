import lineColors from "@/data/line-colors.json";

export type LineColor = (typeof lineColors)[number];
export type LineId = LineColor["id"];

export const LINES: readonly LineColor[] = lineColors;

export function getLine(id: string): LineColor {
  const line = LINES.find((l) => l.id === id);
  if (!line) throw new Error(`Linha desconhecida: ${id}`);
  return line;
}

export const METRO_LINE_IDS = ["1", "2", "3", "4", "5", "6", "15", "17"];
export const RAIL_LINE_IDS = ["7", "8", "9", "10", "11", "12", "13"];
