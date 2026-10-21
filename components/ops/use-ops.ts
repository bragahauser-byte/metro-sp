"use client";

import { useEffect, useState } from "react";
import type { OpsSnapshot } from "@/lib/ops/types";
import { IS_STATIC, withBase } from "@/lib/env";

export type OpsState = { status: "loading" } | { status: "ok"; data: OpsSnapshot } | { status: "error" } | { status: "static" };

// Uma leitura por visita: todos os componentes dividem a mesma promessa.
let pending: Promise<OpsSnapshot> | null = null;

function load(): Promise<OpsSnapshot> {
  pending ??= fetch(withBase("/api/avisos"))
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<OpsSnapshot>;
    })
    .catch((e) => {
      pending = null; // deixa tentar de novo depois
      throw e;
    });
  return pending;
}

export function useOps(enabled = true): OpsState & { retry: () => void } {
  // Na versão estática (GitHub Pages) não há /api: diz isso em vez de tentar e falhar.
  const [state, setState] = useState<OpsState>(IS_STATIC ? { status: "static" } : { status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || IS_STATIC) return;
    let alive = true;
    load().then(
      (data) => alive && setState({ status: "ok", data }),
      () => alive && setState({ status: "error" }),
    );
    return () => {
      alive = false;
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
