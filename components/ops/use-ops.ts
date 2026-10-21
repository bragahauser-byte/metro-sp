"use client";

import { useEffect, useState } from "react";
import type { OpsSnapshot } from "@/lib/ops/types";
import { IS_STATIC, withBase } from "@/lib/env";

export type OpsState = { status: "loading" } | { status: "ok"; data: OpsSnapshot } | { status: "error" } | { status: "static" };

/** Mesmo intervalo do servidor: a cada 15 min a página pergunta de novo se há novidade. */
export const POLL_MS = 15 * 60 * 1000;

// Uma leitura por vez: todos os componentes dividem a mesma promessa até ela vencer.
let pending: { at: number; promise: Promise<OpsSnapshot> } | null = null;

function load(force = false): Promise<OpsSnapshot> {
  if (pending && !force && Date.now() - pending.at < POLL_MS) return pending.promise;
  const promise = fetch(withBase("/api/avisos"), { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<OpsSnapshot>;
    })
    .catch((e) => {
      pending = null; // deixa tentar de novo depois
      throw e;
    });
  pending = { at: Date.now(), promise };
  return promise;
}

export function useOps(enabled = true): OpsState & { retry: () => void } {
  // Na versão estática (GitHub Pages) não há /api: diz isso em vez de tentar e falhar.
  const [state, setState] = useState<OpsState>(IS_STATIC ? { status: "static" } : { status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || IS_STATIC) return;
    let alive = true;
    const run = (force = false) =>
      load(force).then(
        (data) => alive && setState({ status: "ok", data }),
        // Falha numa atualização não apaga o que já está na tela.
        () => alive && setState((s) => (s.status === "ok" ? s : { status: "error" })),
      );
    run(attempt > 0);
    const id = setInterval(() => document.visibilityState === "visible" && run(), POLL_MS);
    // Voltou para a aba depois de muito tempo: confere na hora.
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, attempt]);
  return {
    ...state,
    retry: () => {
      setState({ status: "loading" });
      setAttempt((n) => n + 1);
    },
  };
}
