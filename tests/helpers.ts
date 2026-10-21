// Carrega os dados versionados para os testes (sem passar pelo bundler do Next).
import { readFileSync } from "node:fs";
import type { NetworkData } from "../lib/route/engine.ts";
import type { ScheduleData } from "../lib/schedule/hours.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../data/${p}`, import.meta.url), "utf8"));

export function loadNetwork(): NetworkData {
  const edges = read("edges.json");
  return {
    lines: read("lines.json"),
    stations: read("stations.geojson").features.map((f: { properties: unknown }) => f.properties),
    trechos: edges.trechos,
    transferencias: edges.transferencias,
  };
}

export const loadSchedule = (): ScheduleData => read("horarios.json");
