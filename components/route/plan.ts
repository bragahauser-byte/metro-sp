// Liga o motor de rotas (lib/route/engine.ts) aos dados da rede e aos horários oficiais.
import edgesJson from "@/data/edges.json";
import horariosJson from "@/data/horarios.json";
import { lines, stations } from "@/components/map/network";
import { type NetworkData, type PlanRequest, type RouteOption, createPlanner } from "@/lib/route/engine";
import type { ScheduleData } from "@/lib/schedule/hours";

export type { Leg, Notice, PlanRequest, PlanResult, RouteOption } from "@/lib/route/engine";
export { segmentKey } from "@/lib/route/engine";

export const schedule = horariosJson as unknown as ScheduleData;

const planner = createPlanner(
  {
    lines,
    stations,
    trechos: edgesJson.trechos,
    transferencias: edgesJson.transferencias,
  } as unknown as NetworkData,
  schedule,
);

export const planRoutes = planner.plan;

/** Atalho: só a rota mais rápida, sem horário (mapa aberto por link ?de=&para=). */
export function planRoute(from: string, to: string, opts: Omit<PlanRequest, "from" | "to"> = {}): RouteOption | null {
  const r = planner.plan({ from, to, ...opts, max: 1 });
  return r.status === "ok" ? r.routes[0] : null;
}

/** Alias usado pelo mapa. */
export type Route = RouteOption;
