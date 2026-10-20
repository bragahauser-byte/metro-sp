// Modelo da rede para o mapa: junta lines.json, stations.geojson, edges.json, tracks.geojson e
// schematic.json numa estrutura pronta para desenhar nos dois modos (real e esquemático).
import linesJson from "@/data/lines.json";
import stationsJson from "@/data/stations.geojson";
import tracksJson from "@/data/tracks.geojson";
import schematicJson from "@/data/schematic.json";
import edgesJson from "@/data/edges.json";
import entrancesJson from "@/data/entrances.geojson";
import type { Status } from "@/components/ui/status-chip";

export type LngLat = [number, number];

export type Line = {
  id: string;
  numero: number;
  nome: string;
  cor: string;
  tinta: string;
  operador: string;
  tipo: "metro" | "monotrilho" | "trem";
  status: Status;
  extensaoOperacionalKm: number;
  sequencias: string[][];
};

export type Station = {
  slug: string;
  nome: string;
  complemento: string | null;
  linhas: string[];
  status: Status;
  statusPorLinha: Record<string, Status>;
  /** Posição real da parada de cada linha. */
  paradas: Record<string, LngLat>;
  /** Centro da estação no mapa real. */
  geo: LngLat;
  /** Posição no diagrama esquemático. */
  schem: LngLat;
  integracoes: string[];
  /** Acessibilidade marcada no OpenStreetMap; null = sem informação. */
  acessivel: "sim" | "limitado" | "nao" | null;
};

export type Segment = {
  linha: string;
  de: string;
  para: string;
  status: Status;
  distanciaM: number;
  /** Traçado real, de → para. */
  geo: LngLat[];
  /** Traçado esquemático (octilinear), de → para. */
  schem: LngLat[];
  /** Deslocamento lateral em larguras de linha, à direita do sentido de → para. */
  faixaGeo: number;
  faixaSchem: number;
};

type Feature<P, G> = { properties: P; geometry: G };

export const RAIL_LINES = new Set(["7", "8", "9", "10", "11", "12", "13"]);

export const lines = linesJson as unknown as Line[];
export const lineById = new Map(lines.map((l) => [l.id, l]));

const schematic = schematicJson as unknown as { estacoes: Record<string, LngLat>; trechos: Record<string, LngLat[]> };

export const stations: Station[] = (
  stationsJson as unknown as { features: Feature<Omit<Station, "geo" | "schem">, { coordinates: LngLat }>[] }
).features.map((f) => ({
  ...f.properties,
  geo: f.geometry.coordinates,
  schem: schematic.estacoes[f.properties.slug],
}));
export const stationBySlug = new Map(stations.map((s) => [s.slug, s]));

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type TrackProps = { linha: string; de: string; para: string; status: Status; distanciaM: number; faixa: number };
const tracks = (tracksJson as unknown as { features: Feature<TrackProps, { coordinates: LngLat[] }>[] }).features;

// No esquemático, linhas que dividem o mesmo par de estações correm em faixas paralelas.
const schemBundles = new Map<string, string[]>();
for (const t of tracks) {
  const k = edgeKey(t.properties.de, t.properties.para);
  const list = schemBundles.get(k) ?? [];
  if (!list.includes(t.properties.linha)) list.push(t.properties.linha);
  schemBundles.set(k, list);
}
for (const list of schemBundles.values()) list.sort((a, b) => Number(a) - Number(b));

export const segments: Segment[] = tracks.map(({ properties: p, geometry }) => {
  const k = edgeKey(p.de, p.para);
  const path = schematic.trechos[k];
  // schematic.json guarda o caminho na orientação da primeira linha que usou o par (a → b do grafo);
  // vira se preciso para ficar de → para, como o traçado real.
  const startsAtDe = dist2(path[0], stationBySlug.get(p.de)!.schem) <= dist2(path.at(-1)!, stationBySlug.get(p.de)!.schem);
  const schem = startsAtDe ? path : [...path].reverse();
  const bundle = schemBundles.get(k)!;
  // Sentido de referência do feixe: do slug menor para o maior.
  const rank = bundle.indexOf(p.linha) - (bundle.length - 1) / 2;
  const faixaSchem = p.de < p.para ? rank : -rank;
  return {
    linha: p.linha,
    de: p.de,
    para: p.para,
    status: p.status,
    distanciaM: p.distanciaM,
    geo: geometry.coordinates,
    schem,
    faixaGeo: p.faixa ?? 0,
    faixaSchem,
  };
});

function dist2(a: LngLat, b: LngLat) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/** Vizinhos de uma estação em cada linha (para "estações vizinhas" e a lista da linha). */
export function neighborsOf(slug: string) {
  const out: { linha: string; anterior?: string; proxima?: string }[] = [];
  for (const l of lines) {
    for (const seq of l.sequencias) {
      const i = seq.indexOf(slug);
      if (i < 0) continue;
      out.push({ linha: l.id, anterior: seq[i - 1], proxima: seq[i + 1] });
    }
  }
  return out;
}

/** Estações da linha na ordem, sem repetir o ponto de bifurcação. */
export function stationsOfLine(id: string): string[] {
  const l = lineById.get(id);
  if (!l) return [];
  return [...new Set(l.sequencias.flat())];
}

export const transfers = edgesJson.transferencias as { estacao?: string; de: string; para: string; tipo: string }[];

export function boundsOf(points: LngLat[]): [LngLat, LngLat] {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/** Entradas das estações (OpenStreetMap), mostradas só no zoom máximo. */
export const entrances = (
  entrancesJson as unknown as { features: Feature<{ estacao: string; ref: string | null }, { coordinates: LngLat }>[] }
).features.map((f) => ({ estacao: f.properties.estacao, ref: f.properties.ref, lngLat: f.geometry.coordinates }));
