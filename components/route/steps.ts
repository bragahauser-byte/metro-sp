// Liga o passo a passo puro (lib/route/steps) aos nomes da rede e às pontas escolhidas.
import { lineById, stationBySlug } from "@/components/map/network";
import type { Spot } from "@/components/search/place-search";
import { type Step, buildSteps } from "@/lib/route/steps";
import type { Walk } from "@/lib/geo/walk";
import type { Route } from "./plan";

export type { Step } from "@/lib/route/steps";

const names = {
  station: (slug: string) => stationBySlug.get(slug)?.nome ?? slug,
  line: (id: string) => lineById.get(id)?.nome ?? `Linha ${id}`,
};

const end = (s: Spot | null) =>
  !s
    ? null
    : s.kind === "station"
      ? { nome: `Estação ${names.station(s.slug)}`, lngLat: stationBySlug.get(s.slug)?.geo ?? null, isStation: true }
      : { nome: s.nome, lngLat: s.lngLat, isStation: false };

export function routeSteps(route: Route, o: { walkIn?: Walk | null; walkOut?: Walk | null; from: Spot | null; to: Spot | null }): Step[] {
  return buildSteps(route, names, { walkIn: o.walkIn, walkOut: o.walkOut, from: end(o.from), to: end(o.to) });
}
